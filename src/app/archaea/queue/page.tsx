'use client';

/**
 * Archaea Curation Queue
 *
 * Paginated, filterable list of proteins pending curation
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { CurationQueueItem, QueueResponse } from '@/lib/archaea-types';

const PAGE_SIZE = 50;

// Filter options
const NOVELTY_OPTIONS = [
  { value: 'all', label: 'All Novelty' },
  { value: 'dark', label: 'Dark (no homologs)' },
  { value: 'sequence-orphan', label: 'Sequence Orphan' },
  { value: 'divergent', label: 'Divergent' },
  { value: 'known', label: 'Known' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'all', label: 'All Status' },
  { value: 'in_review', label: 'In Review' },
  { value: 'classified', label: 'Classified' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'rejected', label: 'Rejected' },
];

const SORT_OPTIONS = [
  { value: 'priority_rank', label: 'Priority (P1 → P2, then rank)' },
  { value: 'quality_score', label: 'Quality Score' },
  { value: 'mean_plddt', label: 'pLDDT' },
  { value: 'sequence_length', label: 'Sequence Length' },
];

export default function ArchaeaQueuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State from URL params
  const [noveltyFilter, setNoveltyFilter] = useState(searchParams.get('novelty') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'pending');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'priority_rank');
  const [sortOrder, setSortOrder] = useState(searchParams.get('order') || 'ASC');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Data state
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update URL when filters change
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (noveltyFilter !== 'all') params.set('novelty', noveltyFilter);
    if (statusFilter !== 'pending') params.set('status', statusFilter);
    if (sortBy !== 'priority_rank') params.set('sort', sortBy);
    if (sortOrder !== 'ASC') params.set('order', sortOrder);
    if (page > 1) params.set('page', String(page));

    const queryString = params.toString();
    router.replace(`/archaea/queue${queryString ? `?${queryString}` : ''}`);
  }, [noveltyFilter, statusFilter, sortBy, sortOrder, page, router]);

  // Fetch data
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        novelty: noveltyFilter,
        status: statusFilter,
        sort: sortBy,
        order: sortOrder,
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
        has_structure: 'true', // Only show proteins with structures
      });

      const response = await fetch(`/api/archaea/queue?${params}`);
      if (!response.ok) throw new Error('Failed to fetch queue');

      const result: QueueResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [noveltyFilter, statusFilter, sortBy, sortOrder, page]);

  // Fetch on filter changes
  useEffect(() => {
    fetchQueue();
    updateUrl();
  }, [fetchQueue, updateUrl]);

  // Handle filter changes
  const handleFilterChange = (filter: string, value: string) => {
    setPage(1); // Reset to first page
    switch (filter) {
      case 'novelty':
        setNoveltyFilter(value);
        break;
      case 'status':
        setStatusFilter(value);
        break;
      case 'sort':
        setSortBy(value);
        break;
      case 'order':
        setSortOrder(value);
        break;
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archaea Curation Queue</h1>
          <p className="text-gray-600">
            {data ? `${data.total.toLocaleString()} proteins` : 'Loading...'}
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
          {/* Novelty Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Novelty:</label>
            <select
              value={noveltyFilter}
              onChange={(e) => handleFilterChange('novelty', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              {NOVELTY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => handleFilterChange('order', sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              {sortOrder === 'ASC' ? '↑' : '↓'}
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchQueue}
            className="ml-auto text-sm text-green-600 hover:text-green-800"
          >
            Refresh
          </button>
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Protein ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UniProt
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Length
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Novelty
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  pLDDT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cluster
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    No proteins found matching filters
                  </td>
                </tr>
              ) : (
                data?.items.map((item) => (
                  <QueueRow key={item.protein_id} item={item} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, data?.total || 0)} of {data?.total.toLocaleString()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
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

// Queue Row Component
function QueueRow({ item }: { item: CurationQueueItem }) {
  const noveltyColors: Record<string, string> = {
    dark: 'bg-red-100 text-red-800',
    'sequence-orphan': 'bg-orange-100 text-orange-800',
    divergent: 'bg-yellow-100 text-yellow-800',
    known: 'bg-green-100 text-green-800',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    in_review: 'bg-blue-100 text-blue-800',
    classified: 'bg-green-100 text-green-800',
    deferred: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-mono text-sm">{item.protein_id}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {item.uniprot_acc || '-'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {item.sequence_length}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`px-2 py-1 text-xs font-medium rounded ${noveltyColors[item.novelty_category] || 'bg-gray-100'}`}>
          {item.novelty_category}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm">
        <PriorityBadge category={item.priority_category} rank={item.priority_rank} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm">
        {item.mean_plddt ? (
          <span className={item.mean_plddt >= 70 ? 'text-green-600' : item.mean_plddt >= 50 ? 'text-yellow-600' : 'text-red-600'}>
            {item.mean_plddt.toFixed(1)}
          </span>
        ) : '-'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {item.quality_score?.toFixed(2) || '-'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {item.structural_cluster_size || '-'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[item.curation_status] || 'bg-gray-100'}`}>
          {item.curation_status}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Link
          href={`/archaea/protein/${item.protein_id}`}
          className="text-green-600 hover:text-green-800 text-sm font-medium"
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

// Priority Badge - shows "P1-15" or "P2-42" format
function PriorityBadge({ category, rank }: { category: string; rank: number | null }) {
  // Extract priority number from category (e.g., "priority_1_dark_singleton" -> "1")
  const match = category.match(/priority_(\d+)/);
  const priorityNum = match ? match[1] : '?';

  const colors: Record<string, string> = {
    '1': 'bg-red-100 text-red-800',
    '2': 'bg-orange-100 text-orange-800',
    '3': 'bg-yellow-100 text-yellow-800',
    '4': 'bg-green-100 text-green-800',
  };

  return (
    <span className={`px-2 py-1 text-xs font-mono font-medium rounded ${colors[priorityNum] || 'bg-gray-100 text-gray-800'}`}>
      P{priorityNum}-{rank || '?'}
    </span>
  );
}
