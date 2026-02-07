'use client';

/**
 * Archaea Structural Clusters Browser
 *
 * Browse and filter structural clusters
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { ArchaeaCluster } from '@/lib/archaea-types';

const PAGE_SIZE = 50;

export default function ArchaeaClustersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters from URL
  const [minSize, setMinSize] = useState(parseInt(searchParams.get('min_size') || '2'));
  const [hasDark, setHasDark] = useState(searchParams.get('has_dark') === 'true');
  const [hasPending, setHasPending] = useState(searchParams.get('has_pending') !== 'false');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'cluster_size');
  const [sortOrder, setSortOrder] = useState(searchParams.get('order') || 'DESC');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Data
  const [clusters, setClusters] = useState<ArchaeaCluster[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch clusters
  const fetchClusters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        min_size: String(minSize),
        sort: sortBy,
        order: sortOrder,
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });

      if (hasDark) params.set('has_dark', 'true');
      if (hasPending) params.set('has_pending', 'true');

      const response = await fetch(`/api/archaea/cluster?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clusters');

      const data = await response.json();
      setClusters(data.clusters);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
    } finally {
      setLoading(false);
    }
  }, [minSize, hasDark, hasPending, sortBy, sortOrder, page]);

  // Update URL
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (minSize !== 2) params.set('min_size', String(minSize));
    if (hasDark) params.set('has_dark', 'true');
    if (!hasPending) params.set('has_pending', 'false');
    if (sortBy !== 'cluster_size') params.set('sort', sortBy);
    if (sortOrder !== 'DESC') params.set('order', sortOrder);
    if (page > 1) params.set('page', String(page));

    const queryString = params.toString();
    router.replace(`/archaea/clusters${queryString ? `?${queryString}` : ''}`);
  }, [minSize, hasDark, hasPending, sortBy, sortOrder, page, router]);

  useEffect(() => {
    fetchClusters();
    updateUrl();
  }, [fetchClusters, updateUrl]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Structural Clusters</h1>
          <p className="text-gray-600">
            {loading ? 'Loading...' : `${total.toLocaleString()} clusters`}
          </p>
        </div>
        <Link
          href="/archaea"
          className="text-green-600 hover:text-green-800 font-medium"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Min Size:</label>
            <input
              type="number"
              value={minSize}
              onChange={(e) => {
                setMinSize(parseInt(e.target.value) || 1);
                setPage(1);
              }}
              className="w-20 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              min="1"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasDark}
              onChange={(e) => {
                setHasDark(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Has dark proteins</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPending}
              onChange={(e) => {
                setHasPending(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Has pending</span>
          </label>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="cluster_size">Cluster Size</option>
              <option value="dark_count">Dark Count</option>
              <option value="pending_count">Pending Count</option>
              <option value="avg_quality_score">Avg Quality</option>
            </select>
            <button
              onClick={() => setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC')}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              {sortOrder === 'ASC' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Representative
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Size
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Dark
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Pending
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Avg pLDDT
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Avg Quality
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : clusters.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No clusters found
                </td>
              </tr>
            ) : (
              clusters.map((cluster) => (
                <tr key={cluster.cluster_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/archaea/protein/${cluster.cluster_rep_id}`}
                      className="font-mono text-sm text-green-600 hover:text-green-800"
                    >
                      {cluster.cluster_rep_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {cluster.cluster_size}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {cluster.dark_count > 0 ? (
                      <span className="text-red-600 font-medium">{cluster.dark_count}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {cluster.pending_count > 0 ? (
                      <span className="text-orange-600 font-medium">{cluster.pending_count}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {cluster.avg_plddt?.toFixed(1) || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {cluster.avg_quality_score?.toFixed(2) || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/archaea/clusters/${cluster.cluster_id}`}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      View Members →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-100"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
