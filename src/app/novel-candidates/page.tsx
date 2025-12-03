'use client';

/**
 * Novel Candidate Clusters Dashboard
 *
 * Lists clusters of domains with no Pfam hit and no confident ECOD structural match.
 * These are true novel domain candidates requiring curator attention.
 */

import { useState, useEffect } from 'react';
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
}

interface ApiResponse {
  clusters: NovelCluster[];
  total: number;
  limit: number;
  offset: number;
  status_summary: Record<string, number>;
}

export default function NovelCandidatesPage() {
  const [clusters, setClusters] = useState<NovelCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('member_count');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchClusters();
  }, [statusFilter, sortBy, sortOrder]);

  const fetchClusters = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: '50',
      });

      const response = await fetch(`/api/curation/novel-candidates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clusters');

      const data: ApiResponse = await response.json();
      setClusters(data.clusters);
      setTotal(data.total);
      setStatusSummary(data.status_summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
    } finally {
      setLoading(false);
    }
  };

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

  const getLddtBar = (lddt: number | null) => {
    if (lddt === null) return <span className="text-gray-400">-</span>;

    const width = Math.min(lddt * 100, 100);
    const color = lddt >= 0.7 ? 'bg-green-500' : lddt >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';

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

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Novel Candidate Clusters</h1>
        <p className="text-gray-600 mt-1">
          Domains with no Pfam hit and no confident ECOD structural match (LDDT &lt; 0.7)
        </p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-sm text-gray-500">Total Clusters</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow border p-4">
          <div className="text-2xl font-bold text-yellow-700">{statusSummary.pending || 0}</div>
          <div className="text-sm text-yellow-600">Pending</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow border p-4">
          <div className="text-2xl font-bold text-blue-700">{statusSummary.in_review || 0}</div>
          <div className="text-sm text-blue-600">In Review</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow border p-4">
          <div className="text-2xl font-bold text-green-700">{statusSummary.curated || 0}</div>
          <div className="text-sm text-green-600">Curated</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5"
            >
              <option value="member_count">Member Count</option>
              <option value="avg_best_lddt">Avg LDDT</option>
              <option value="xgroup_consistency">X-group Consistency</option>
              <option value="avg_plddt">Avg pLDDT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cluster</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Members</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best X-group</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg LDDT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">X-group Consistency</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg pLDDT</th>
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
                  <td className="px-4 py-3">
                    {cluster.best_ecod_xgroup ? (
                      <div>
                        <span className="font-mono">{cluster.best_ecod_xgroup}</span>
                        {cluster.xgroup_name && (
                          <span className="text-gray-500 text-sm ml-2">({cluster.xgroup_name})</span>
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

          {clusters.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No clusters found matching your filters
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">What are Novel Candidates?</h3>
        <p className="text-sm text-blue-700">
          These clusters contain domains that have <strong>no Pfam sequence match</strong> and
          <strong> no confident ECOD structural match</strong> (Foldseek LDDT &lt; 0.7).
          They represent potentially novel protein folds or families not yet in ECOD.
        </p>
        <p className="text-sm text-blue-700 mt-2">
          Weak LDDT hits (0.3-0.6) may suggest possible X-group placement based on distant
          structural similarity.
        </p>
      </div>
    </div>
  );
}
