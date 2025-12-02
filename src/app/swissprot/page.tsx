'use client';

/**
 * SwissProt Novel Domain Curation Queue
 *
 * Displays prioritized list of novel domain candidates for curation
 * Candidates have high structure confidence (DPAM >= 0.7) but poor
 * sequence similarity to known ECOD domains (HH < 0.5)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SwissProtProtein {
  protein_id: number;
  source_id: string;
  unp_acc: string;
  cluster_size: number;
  plddt: number;
  dpam_prob: number;
  hh_prob: number;
  assigned_t_group: string;
  t_group_name: string | null;
  h_group_name: string | null;
  x_group_name: string | null;
  priority: number;
  // Protein context fields
  protein_name: string | null;
  gene_name: string | null;
  organism: string | null;
  total_sibling_count: number;
  ecod_sibling_count: number;
  has_ecod_siblings: boolean;
}

interface QueueStats {
  total: number;
  curated: number;
  remaining: number;
  rejected: number;
  priority_breakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

export default function SwissProtQueuePage() {
  const [proteins, setProteins] = useState<SwissProtProtein[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [hasEcodSiblings, setHasEcodSiblings] = useState<string>('');
  const [isMultidomain, setIsMultidomain] = useState<string>('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);

  useEffect(() => {
    fetchQueue();
  }, [filter, hasEcodSiblings, isMultidomain, page]);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('filter', filter);
      if (hasEcodSiblings) params.append('has_ecod_siblings', hasEcodSiblings);
      if (isMultidomain) params.append('is_multidomain', isMultidomain);
      params.append('limit', String(pageSize));
      params.append('offset', String(page * pageSize));

      const response = await fetch(`/api/swissprot/queue?${params}`);
      if (!response.ok) throw new Error('Failed to fetch queue');

      const data = await response.json();
      setProteins(data.proteins || []);
      setStats({
        total: data.total,
        curated: data.curated,
        remaining: data.remaining,
        rejected: data.rejected,
        priority_breakdown: data.priority_breakdown
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">High</span>;
      case 2:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Medium</span>;
      case 3:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Low</span>;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number, threshold: number, inverse: boolean = false) => {
    if (inverse) {
      return score < threshold ? 'text-green-600' : 'text-gray-600';
    }
    return score >= threshold ? 'text-green-600' : 'text-gray-600';
  };

  const getSiblingBadge = (protein: SwissProtProtein) => {
    const { total_sibling_count, ecod_sibling_count, has_ecod_siblings } = protein;

    if (total_sibling_count === 0) {
      // Single domain protein
      return (
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
          Single
        </span>
      );
    } else if (has_ecod_siblings) {
      // Has siblings with some in ECOD
      return (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
          {ecod_sibling_count}/{total_sibling_count} ECOD
        </span>
      );
    } else {
      // Has siblings but none in ECOD
      return (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
          0/{total_sibling_count} ECOD
        </span>
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SwissProt Novel Domain Curation</h1>
        <p className="text-gray-600 mt-1">
          Novel domain candidates with high structure confidence (DPAM &ge; 0.7) but poor sequence similarity (HH &lt; 0.5)
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-blue-600">{stats.total.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Candidates</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-green-600">{stats.curated.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Curated</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-orange-600">{stats.remaining.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Remaining</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-red-600">{stats.rejected.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-sm font-medium text-gray-700">
              {stats.total > 0 ? ((stats.curated / stats.total) * 100).toFixed(1) : 0}% Complete
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${stats.total > 0 ? (stats.curated / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Priority Breakdown */}
      {stats && (
        <div className="bg-white p-4 rounded-lg shadow border mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Priority Breakdown (Pending)</h3>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">High</span>
              <span className="text-gray-900 font-medium">{stats.priority_breakdown.high}</span>
              <span className="text-gray-500 text-sm">(&ge;10 members)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Medium</span>
              <span className="text-gray-900 font-medium">{stats.priority_breakdown.medium}</span>
              <span className="text-gray-500 text-sm">(5-9 members)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Low</span>
              <span className="text-gray-900 font-medium">{stats.priority_breakdown.low}</span>
              <span className="text-gray-500 text-sm">(1-4 members)</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Priority:</label>
            <select
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Pending</option>
              <option value="high_priority">High Priority (&ge;10 members)</option>
              <option value="medium_priority">Medium Priority (5-9 members)</option>
              <option value="low_priority">Low Priority (1-4 members)</option>
              <option value="large_clusters">Large Clusters (&ge;5 members)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Domain Type:</label>
            <select
              value={isMultidomain}
              onChange={(e) => { setIsMultidomain(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All</option>
              <option value="false">Single Domain</option>
              <option value="true">Multidomain</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">ECOD Siblings:</label>
            <select
              value={hasEcodSiblings}
              onChange={(e) => { setHasEcodSiblings(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All</option>
              <option value="true">Has ECOD Siblings</option>
              <option value="false">No ECOD Siblings</option>
            </select>
          </div>

          {(filter !== 'all' || hasEcodSiblings || isMultidomain) && (
            <button
              onClick={() => { setFilter('all'); setHasEcodSiblings(''); setIsMultidomain(''); setPage(0); }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading queue...</span>
        </div>
      )}

      {/* Queue Table */}
      {!loading && !error && (
        <>
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Protein Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gene
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Siblings
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cluster
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    pLDDT
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DPAM
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    HH
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    T-group
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proteins.map((protein) => (
                  <tr
                    key={protein.protein_id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => window.location.href = `/swissprot/${protein.source_id}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/swissprot/${protein.source_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {protein.source_id}
                      </Link>
                      <div className="text-xs text-gray-500">
                        <a
                          href={`https://www.uniprot.org/uniprotkb/${protein.unp_acc}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {protein.unp_acc}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-48">
                      <div className="truncate text-sm text-gray-900" title={protein.protein_name || ''}>
                        {protein.protein_name || '-'}
                      </div>
                      {protein.organism && (
                        <div className="text-xs text-gray-500 truncate" title={protein.organism}>
                          {protein.organism}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {protein.gene_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {getSiblingBadge(protein)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`font-medium ${protein.cluster_size >= 10 ? 'text-red-600' : protein.cluster_size >= 5 ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {protein.cluster_size}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={getScoreColor(Number(protein.plddt), 80)}>
                        {Number(protein.plddt).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={getScoreColor(Number(protein.dpam_prob), 0.7)}>
                        {Number(protein.dpam_prob).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={getScoreColor(Number(protein.hh_prob), 0.5, true)}>
                        {Number(protein.hh_prob).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-56">
                      {protein.assigned_t_group ? (
                        <div>
                          <div className="font-medium">{protein.assigned_t_group}</div>
                          <div className="text-xs text-gray-500 truncate" title={[protein.x_group_name, protein.h_group_name, protein.t_group_name].filter(Boolean).join(' > ')}>
                            {protein.x_group_name && <span>{protein.x_group_name}</span>}
                            {protein.x_group_name && protein.t_group_name && <span className="text-gray-400"> &gt; </span>}
                            {protein.t_group_name && <span>{protein.t_group_name}</span>}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {getPriorityBadge(protein.priority)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {proteins.length > 0 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-600">
                Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, stats?.remaining || 0)} of {stats?.remaining || 0} pending
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={proteins.length < pageSize}
                  className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {proteins.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No pending proteins found for the selected filter.
            </div>
          )}
        </>
      )}
    </div>
  );
}
