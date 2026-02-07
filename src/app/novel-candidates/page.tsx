'use client';

/**
 * Novel Candidate Clusters Dashboard
 *
 * Lists clusters of domains with no Pfam hit and varying degrees of ECOD structural match.
 * Supports pagination, filtering, and sorting for 3,000+ clusters.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface NovelCluster {
  id: number;
  cluster_name: string;
  member_count: number;
  best_ecod_xgroup: string | null;
  xgroup_name: string | null;
  avg_best_lddt: number | null;
  max_best_lddt: number | null;
  xgroup_consistency: number | null;
  avg_plddt: number | null;
  avg_domain_length: number | null;
  status: string;
  assigned_xgroup: string | null;
  curated_by: string | null;
  lddt_classification: string;
  has_foldseek_results: boolean;
  pct_members_with_lddt: number | null;
  pct_members_lddt_07: number | null;
}

interface ApiResponse {
  clusters: NovelCluster[];
  total: number;
  limit: number;
  offset: number;
  status_summary: Record<string, number>;
  lddt_classification_summary: Record<string, number>;
}

const PAGE_SIZE = 50;

export default function NovelCandidatesPage() {
  const [clusters, setClusters] = useState<NovelCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});
  const [lddtSummary, setLddtSummary] = useState<Record<string, number>>({});

  // Pagination
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [lddtFilter, setLddtFilter] = useState('all');
  const [minSize, setMinSize] = useState(2);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('member_count');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        lddt_classification: lddtFilter,
        min_size: String(minSize),
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });

      if (search) {
        params.set('search', search);
      }

      const response = await fetch(`/api/curation/novel-candidates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clusters');

      const data: ApiResponse = await response.json();
      setClusters(data.clusters);
      setTotal(data.total);
      setStatusSummary(data.status_summary);
      setLddtSummary(data.lddt_classification_summary || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, lddtFilter, minSize, sortBy, sortOrder, page, search]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, lddtFilter, minSize, sortBy, sortOrder, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_review: 'bg-blue-100 text-blue-800',
      curated: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getLddtClassBadge = (classification: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      ECOD_ASSIGNABLE: { bg: 'bg-green-100', text: 'text-green-800', label: 'ECOD Assignable' },
      MODERATE_SIMILARITY: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Moderate' },
      WEAK_SIMILARITY: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Weak' },
      NOVEL: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Novel' },
    };
    const style = styles[classification] || { bg: 'bg-gray-100', text: 'text-gray-800', label: classification };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const getLddtBar = (lddt: number | null) => {
    if (lddt === null) return <span className="text-gray-400">-</span>;

    const width = Math.min(lddt * 100, 100);
    const color = lddt >= 0.7 ? 'bg-green-500' : lddt >= 0.5 ? 'bg-yellow-500' : lddt >= 0.3 ? 'bg-orange-500' : 'bg-red-500';

    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 rounded overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${width}%` }} />
        </div>
        <span className="text-sm">{lddt.toFixed(2)}</span>
      </div>
    );
  };

  const getConsistencyBar = (consistency: number | null) => {
    if (consistency === null) return <span className="text-gray-400">-</span>;

    const pct = consistency * 100;
    const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';

    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 rounded overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm">{pct.toFixed(0)}%</span>
      </div>
    );
  };

  const handleSortClick = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Novel Candidate Clusters</h1>
        <p className="text-gray-600 mt-1">
          Domains with no Pfam hit, classified by structural similarity to ECOD
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-2xl font-bold text-gray-900">{Object.values(statusSummary).reduce((a, b) => a + b, 0)}</div>
          <div className="text-sm text-gray-500">Total Clusters</div>
        </div>
        <div className="bg-purple-50 rounded-lg shadow border p-4 cursor-pointer hover:ring-2 ring-purple-300" onClick={() => setLddtFilter(lddtFilter === 'NOVEL' ? 'all' : 'NOVEL')}>
          <div className="text-2xl font-bold text-purple-700">{lddtSummary.NOVEL || 0}</div>
          <div className="text-sm text-purple-600">Novel</div>
        </div>
        <div className="bg-orange-50 rounded-lg shadow border p-4 cursor-pointer hover:ring-2 ring-orange-300" onClick={() => setLddtFilter(lddtFilter === 'WEAK_SIMILARITY' ? 'all' : 'WEAK_SIMILARITY')}>
          <div className="text-2xl font-bold text-orange-700">{lddtSummary.WEAK_SIMILARITY || 0}</div>
          <div className="text-sm text-orange-600">Weak Similarity</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow border p-4 cursor-pointer hover:ring-2 ring-yellow-300" onClick={() => setLddtFilter(lddtFilter === 'MODERATE_SIMILARITY' ? 'all' : 'MODERATE_SIMILARITY')}>
          <div className="text-2xl font-bold text-yellow-700">{lddtSummary.MODERATE_SIMILARITY || 0}</div>
          <div className="text-sm text-yellow-600">Moderate</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow border p-4 cursor-pointer hover:ring-2 ring-green-300" onClick={() => setLddtFilter(lddtFilter === 'ECOD_ASSIGNABLE' ? 'all' : 'ECOD_ASSIGNABLE')}>
          <div className="text-2xl font-bold text-green-700">{lddtSummary.ECOD_ASSIGNABLE || 0}</div>
          <div className="text-sm text-green-600">ECOD Assignable</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow border p-4">
          <div className="text-2xl font-bold text-blue-700">{statusSummary.curated || 0}</div>
          <div className="text-sm text-blue-600">Curated</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cluster name or X-group..."
              className="border border-gray-300 rounded px-3 py-1.5 w-48"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LDDT Classification</label>
            <select
              value={lddtFilter}
              onChange={(e) => setLddtFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5"
            >
              <option value="all">All</option>
              <option value="NOVEL">Novel</option>
              <option value="WEAK_SIMILARITY">Weak Similarity</option>
              <option value="MODERATE_SIMILARITY">Moderate Similarity</option>
              <option value="ECOD_ASSIGNABLE">ECOD Assignable</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Curation Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in_review">In Review</option>
              <option value="curated">Curated</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Size</label>
            <select
              value={minSize}
              onChange={(e) => setMinSize(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-3 py-1.5"
            >
              <option value="2">≥2</option>
              <option value="5">≥5</option>
              <option value="10">≥10</option>
              <option value="20">≥20</option>
              <option value="50">≥50</option>
            </select>
          </div>
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            Showing {clusters.length} of {total} clusters
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading clusters...</span>
        </div>
      )}

      {/* Clusters Table */}
      {!loading && !error && (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortClick('cluster_name')}
                  >
                    Cluster <SortIcon column="cluster_name" />
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortClick('member_count')}
                  >
                    Members <SortIcon column="member_count" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best X-group</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortClick('avg_best_lddt')}
                  >
                    Avg LDDT <SortIcon column="avg_best_lddt" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortClick('xgroup_consistency')}
                  >
                    Consistency <SortIcon column="xgroup_consistency" />
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortClick('avg_plddt')}
                  >
                    pLDDT <SortIcon column="avg_plddt" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clusters.map((cluster) => (
                  <tr key={cluster.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/novel-candidates/${cluster.id}`}
                        className="text-blue-600 hover:underline font-mono"
                      >
                        {cluster.cluster_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{cluster.member_count}</td>
                    <td className="px-4 py-3">{getLddtClassBadge(cluster.lddt_classification)}</td>
                    <td className="px-4 py-3">
                      {cluster.best_ecod_xgroup ? (
                        <div>
                          <span className="font-mono text-sm">{cluster.best_ecod_xgroup}</span>
                          {cluster.xgroup_name && (
                            <span className="text-gray-500 text-xs ml-2">({cluster.xgroup_name})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getLddtBar(cluster.avg_best_lddt)}</td>
                    <td className="px-4 py-3">{getConsistencyBar(cluster.xgroup_consistency)}</td>
                    <td className="px-4 py-3 text-right">
                      {cluster.avg_plddt ? cluster.avg_plddt.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(cluster.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {clusters.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No clusters found matching your filters
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              First
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Understanding LDDT Classifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <span className="font-medium text-purple-700">Novel:</span> LDDT &lt; 0.3 - No detectable structural similarity to ECOD domains. These are the best candidates for truly new folds.
          </div>
          <div>
            <span className="font-medium text-orange-700">Weak Similarity:</span> LDDT 0.3-0.5 - Some distant structural similarity detected. May represent remote homologs or convergent structures.
          </div>
          <div>
            <span className="font-medium text-yellow-700">Moderate Similarity:</span> LDDT 0.5-0.7 - Clear structural similarity. Likely belongs to an existing ECOD family but may need curator verification.
          </div>
          <div>
            <span className="font-medium text-green-700">ECOD Assignable:</span> LDDT ≥ 0.7 for &gt;80% of members - Strong structural match. Can likely be auto-assigned to existing ECOD groups.
          </div>
        </div>
      </div>
    </div>
  );
}
