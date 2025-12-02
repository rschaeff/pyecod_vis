'use client';

/**
 * Problematic H-Groups Dashboard
 *
 * Lists H-groups containing reference domains that act as "structural attractors"
 * pulling in many low-confidence assignments from unrelated families.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ProblematicHGroup {
  h_group_id: string;
  h_group_name: string | null;
  x_group_id: string;
  x_group_name: string | null;
  total_reps: number;
  avg_consistency: number;
  stddev_consistency: number;
  issue_type: string;
  swissprot_domain_count: number;
  low_conf_domain_count: number;
  low_conf_rate: number;
  problematic_ref_count: number;
  top_problematic_ref: string | null;
}

export default function ProblematicHGroupsPage() {
  const [hgroups, setHgroups] = useState<ProblematicHGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [minLowConfRate, setMinLowConfRate] = useState(0.4);
  const [minDomains, setMinDomains] = useState(50);
  const [sortBy, setSortBy] = useState('low_conf_count');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);

  useEffect(() => {
    fetchHGroups();
  }, [minLowConfRate, minDomains, sortBy, page]);

  const fetchHGroups = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('min_low_conf_rate', String(minLowConfRate));
      params.append('min_domains', String(minDomains));
      params.append('sort_by', sortBy);
      params.append('limit', String(pageSize));
      params.append('offset', String(page * pageSize));

      const response = await fetch(`/api/curation/problematic-hgroups?${params}`);
      if (!response.ok) throw new Error('Failed to fetch H-groups');

      const data = await response.json();
      setHgroups(data.hgroups || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load H-groups');
    } finally {
      setLoading(false);
    }
  };

  const getConsistencyBadge = (consistency: number) => {
    if (consistency < 0.3) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Very Low</span>;
    } else if (consistency < 0.5) {
      return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">Low</span>;
    } else if (consistency < 0.7) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Medium</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">OK</span>;
  };

  const getLowConfBar = (rate: number) => {
    const width = Math.min(rate * 100, 100);
    const color = rate >= 0.6 ? 'bg-red-500' : rate >= 0.4 ? 'bg-orange-400' : 'bg-yellow-400';
    return (
      <div className="flex items-center gap-2">
        <div className="w-24 bg-gray-200 rounded-full h-2">
          <div className={`${color} h-2 rounded-full`} style={{ width: `${width}%` }} />
        </div>
        <span className="text-sm">{(rate * 100).toFixed(0)}%</span>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Problematic H-Groups</h1>
        <p className="text-gray-600 mt-1">
          H-groups with reference domains acting as &quot;structural attractors&quot; - pulling in low-confidence assignments from unrelated families
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Low-Conf Rate
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.1"
                value={minLowConfRate}
                onChange={(e) => { setMinLowConfRate(parseFloat(e.target.value)); setPage(0); }}
                className="w-32"
              />
              <span className="text-sm font-medium w-12">{(minLowConfRate * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Domains
            </label>
            <input
              type="number"
              min="10"
              max="1000"
              step="10"
              value={minDomains}
              onChange={(e) => { setMinDomains(parseInt(e.target.value)); setPage(0); }}
              className="border border-gray-300 rounded-md px-3 py-1.5 w-24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-md px-3 py-1.5"
            >
              <option value="low_conf_count">Low-Conf Count</option>
              <option value="low_conf_rate">Low-Conf Rate</option>
              <option value="total_domains">Total Domains</option>
            </select>
          </div>

          <button
            onClick={() => { setMinLowConfRate(0.4); setMinDomains(50); setSortBy('low_conf_count'); setPage(0); }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Reset filters
          </button>
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
          <span className="ml-3 text-gray-600">Loading H-groups...</span>
        </div>
      )}

      {/* Results Table */}
      {!loading && !error && (
        <>
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    H-Group
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reps
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Low-Conf
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Consistency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Top Problematic
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {hgroups.map((hg) => (
                  <tr
                    key={hg.h_group_id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => window.location.href = `/problematic-hgroups/${hg.h_group_id}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/problematic-hgroups/${hg.h_group_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {hg.h_group_id}
                      </Link>
                      <div className="text-xs text-gray-500">
                        X: {hg.x_group_id} {hg.x_group_name && `(${hg.x_group_name})`}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-48">
                      <div className="truncate text-sm text-gray-900" title={hg.h_group_name || ''}>
                        {hg.h_group_name || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap text-sm">
                      {hg.total_reps}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-red-600 font-medium">{hg.low_conf_domain_count.toLocaleString()}</span>
                      <span className="text-gray-400 text-sm"> / {hg.swissprot_domain_count.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getLowConfBar(hg.low_conf_rate)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {getConsistencyBadge(hg.avg_consistency)}
                      <div className="text-xs text-gray-500 mt-1">
                        {(hg.avg_consistency * 100).toFixed(0)}%
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {hg.top_problematic_ref ? (
                        <Link
                          href={`/reference-domains/${hg.top_problematic_ref}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-mono"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {hg.top_problematic_ref}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      {hg.problematic_ref_count > 1 && (
                        <span className="text-xs text-gray-500 ml-1">
                          (+{hg.problematic_ref_count - 1} more)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total}
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
                disabled={hgroups.length < pageSize}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>

          {/* Empty State */}
          {hgroups.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No problematic H-groups found matching the filters.
            </div>
          )}
        </>
      )}
    </div>
  );
}
