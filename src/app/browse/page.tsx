'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CuratedProtein {
  source_id: string;
  pdb_id: string;
  chain_id: string;
  domain_count: number;
  partition_coverage: number;
  curation_status: string;
  entity_description?: string;
  decision: {
    accepted: boolean;
    modified: boolean;
    rejected: boolean;
    flagged: boolean;
    notes: string;
    breakpoints?: number[];
    curator: string;
  };
}

interface BrowseData {
  total: number;
  proteins: CuratedProtein[];
  summary: {
    approved: number;
    rejected: number;
    flagged: number;
    withBreakpoints: number;
  };
}

export default function BrowsePage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/browse/curated?${params}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch curated proteins:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (sourceId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId);
      } else {
        newSet.add(sourceId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (protein: CuratedProtein) => {
    if (protein.decision.accepted) {
      return <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 font-medium">✓ Approved</span>;
    } else if (protein.decision.rejected) {
      return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800 font-medium">✗ Rejected</span>;
    } else if (protein.decision.flagged) {
      return <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800 font-medium">⚠ Flagged</span>;
    }
    return <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">Unknown</span>;
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading...</div>
      </main>
    );
  }

  if (!data || !data.summary) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-red-500">Failed to load curated proteins</div>
      </main>
    );
  }

  const totalCurated = (data.summary.approved || 0) + (data.summary.rejected || 0) + (data.summary.flagged || 0);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Browse Curated Proteins</h1>
            <Link
              href="/queue"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Queue
            </Link>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Total Curated</div>
              <div className="text-2xl font-bold text-gray-900">{totalCurated}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-sm text-green-700">Approved</div>
              <div className="text-2xl font-bold text-green-800">
                {data.summary.approved}
                <span className="text-sm font-normal ml-2">
                  ({totalCurated > 0 ? Math.round((data.summary.approved / totalCurated) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-sm text-red-700">Rejected</div>
              <div className="text-2xl font-bold text-red-800">
                {data.summary.rejected}
                <span className="text-sm font-normal ml-2">
                  ({totalCurated > 0 ? Math.round((data.summary.rejected / totalCurated) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-sm text-yellow-700">Flagged</div>
              <div className="text-2xl font-bold text-yellow-800">
                {data.summary.flagged}
                <span className="text-sm font-normal ml-2">
                  ({totalCurated > 0 ? Math.round((data.summary.flagged / totalCurated) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All ({totalCurated})</option>
              <option value="approved">Approved ({data.summary.approved})</option>
              <option value="rejected">Rejected ({data.summary.rejected})</option>
              <option value="flagged">Flagged ({data.summary.flagged})</option>
            </select>

            <div className="text-sm text-gray-600 ml-auto">
              {data.summary.withBreakpoints} proteins with breakpoints
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Protein
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domains
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coverage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.proteins.map((protein) => {
                const isExpanded = expandedRows.has(protein.source_id);
                return (
                  <tr key={protein.source_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <Link
                          href={`/protein/${protein.source_id}`}
                          className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {protein.source_id}
                        </Link>
                        {protein.entity_description && (
                          <div className="text-xs text-gray-500 mt-1">
                            {protein.entity_description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(protein)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {protein.domain_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {(protein.partition_coverage * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {protein.decision.breakpoints && protein.decision.breakpoints.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className="text-xs font-medium text-blue-700">Breakpoints:</span>
                            {protein.decision.breakpoints.map(bp => (
                              <span key={bp} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                                {bp}
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => toggleRow(protein.source_id)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? '▼ Hide' : '▶ Show'} notes
                        </button>
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                            {protein.decision.notes || 'No notes'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/protein/${protein.source_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data.proteins.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No curated proteins found with current filters
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
