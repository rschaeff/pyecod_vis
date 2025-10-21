'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface QueueProtein {
  source_id: string;
  domain_count: number;
  partition_coverage: number;
  partition_quality: string;
  curation_status: string;
  sequence_length: number;
  is_representative?: boolean;
  cluster_size?: number;
  pdb_release_date?: string;
  experimental_method?: string;
  resolution_angstrom?: number;
  priority_score?: number;
}

interface ClusterMember {
  source_id: string;
  pdb_id: string;
  chain_id: string;
  sequence_length?: number;
  curation_status?: string;
  is_representative: boolean;
  sequence_identity_to_rep?: number;
}

interface ClusterInfo {
  cluster_id: number | null;
  representative: string;
  cluster_size: number;
  members: ClusterMember[];
}

type SortField = 'source_id' | 'sequence_length' | 'domain_count' | 'partition_coverage';
type SortDirection = 'asc' | 'desc';

export default function QueuePage() {
  const [proteins, setProteins] = useState<QueueProtein[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('source_id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showAll, setShowAll] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [clusterData, setClusterData] = useState<Map<string, ClusterInfo>>(new Map());
  const [loadingClusters, setLoadingClusters] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/queue/all?show_all=${showAll}`)
      .then(res => res.json())
      .then(data => {
        setProteins(data.proteins || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load queue:', err);
        setLoading(false);
      });
  }, [showAll]);

  // Filter proteins
  const filteredProteins = proteins.filter(p => {
    if (filter === 'low_coverage') return p.partition_coverage < 0.8;
    if (filter === 'good') return p.partition_quality === 'good';
    if (filter === 'failed') return p.partition_quality === 'failed';
    return true; // 'all'
  });

  // Sort proteins
  const sortedProteins = [...filteredProteins].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Paginate
  const totalPages = Math.ceil(sortedProteins.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedProteins = sortedProteins.slice(startIdx, startIdx + pageSize);

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Toggle cluster expansion
  const toggleCluster = async (sourceId: string, clusterSize?: number) => {
    // Don't expand if not in a cluster
    if (!clusterSize || clusterSize === 1) return;

    const newExpanded = new Set(expandedRows);

    if (expandedRows.has(sourceId)) {
      newExpanded.delete(sourceId);
      setExpandedRows(newExpanded);
    } else {
      newExpanded.add(sourceId);
      setExpandedRows(newExpanded);

      // Fetch cluster data if not already loaded
      if (!clusterData.has(sourceId) && !loadingClusters.has(sourceId)) {
        setLoadingClusters(new Set(loadingClusters).add(sourceId));

        try {
          const res = await fetch(`/api/cluster/${sourceId}`);
          const data = await res.json();

          setClusterData(new Map(clusterData).set(sourceId, data));
          setLoadingClusters(prev => {
            const next = new Set(prev);
            next.delete(sourceId);
            return next;
          });
        } catch (err) {
          console.error(`Failed to load cluster for ${sourceId}:`, err);
          setLoadingClusters(prev => {
            const next = new Set(prev);
            next.delete(sourceId);
            return next;
          });
        }
      }
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400">↕</span>;
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading queue...</div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Curation Queue
        </h1>
        <p className="text-gray-600">
          Showing {paginatedProteins.length} of {filteredProteins.length} proteins
          {filteredProteins.length !== proteins.length && ` (${proteins.length} total)`}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        {/* Show all toggle */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded border border-gray-300">
          <input
            type="checkbox"
            id="showAll"
            checked={showAll}
            onChange={(e) => {
              setShowAll(e.target.checked);
              setCurrentPage(1);
              setExpandedRows(new Set()); // Clear expanded rows on toggle
            }}
            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <label htmlFor="showAll" className="text-sm text-gray-700 cursor-pointer select-none">
            Show all chains
          </label>
        </div>

        <div className="h-8 w-px bg-gray-300" />

        <button
          onClick={() => { setFilter('all'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({proteins.length})
        </button>
        <button
          onClick={() => { setFilter('low_coverage'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded ${
            filter === 'low_coverage'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Low Coverage ({proteins.filter(p => p.partition_coverage < 0.8).length})
        </button>
        <button
          onClick={() => { setFilter('good'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded ${
            filter === 'good'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Good ({proteins.filter(p => p.partition_quality === 'good').length})
        </button>
        <button
          onClick={() => { setFilter('failed'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded ${
            filter === 'failed'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Failed ({proteins.filter(p => p.partition_quality === 'failed').length})
        </button>

        {/* Page size selector */}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-600">Per page:</label>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded bg-white"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Protein Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleSort('source_id')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center gap-2">
                  Protein
                  <SortIndicator field="source_id" />
                </div>
              </th>
              <th
                onClick={() => handleSort('sequence_length')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center gap-2">
                  Length
                  <SortIndicator field="sequence_length" />
                </div>
              </th>
              <th
                onClick={() => handleSort('domain_count')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center gap-2">
                  Domains
                  <SortIndicator field="domain_count" />
                </div>
              </th>
              <th
                onClick={() => handleSort('partition_coverage')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center gap-2">
                  Coverage
                  <SortIndicator field="partition_coverage" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quality
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProteins.map((protein) => {
              const isExpanded = expandedRows.has(protein.source_id);
              const hasCluster = (protein.cluster_size ?? 1) > 1;
              const cluster = clusterData.get(protein.source_id);
              const isLoading = loadingClusters.has(protein.source_id);

              return (
                <>
                  <tr
                    key={protein.source_id}
                    className={`hover:bg-gray-50 ${hasCluster ? 'cursor-pointer' : ''}`}
                    onClick={() => hasCluster && toggleCluster(protein.source_id, protein.cluster_size)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {hasCluster && (
                          <span className="text-gray-400 text-xs select-none">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                        <span>{protein.source_id}</span>
                        {hasCluster && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            n={protein.cluster_size}
                          </span>
                        )}
                        {protein.is_representative === false && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            member
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {protein.sequence_length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {protein.domain_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={protein.partition_coverage >= 0.9 ? 'text-green-600' : protein.partition_coverage >= 0.7 ? 'text-yellow-600' : 'text-red-600'}>
                        {(protein.partition_coverage * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded text-xs ${
                        protein.partition_quality === 'good'
                          ? 'bg-green-100 text-green-800'
                          : protein.partition_quality === 'low_coverage'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {protein.partition_quality}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {protein.curation_status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Link
                        href={`/protein/${protein.source_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Curate →
                      </Link>
                    </td>
                  </tr>

                  {/* Expanded cluster members */}
                  {isExpanded && (
                    <tr key={`${protein.source_id}-expanded`}>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        {isLoading ? (
                          <div className="text-sm text-gray-500 italic">Loading cluster members...</div>
                        ) : cluster ? (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-gray-700 uppercase mb-2">
                              Cluster Members ({cluster.cluster_size} total)
                            </div>
                            <div className="grid grid-cols-1 gap-1">
                              {cluster.members.map((member) => (
                                <div
                                  key={member.source_id}
                                  className="flex items-center gap-4 text-sm py-1 px-2 hover:bg-gray-100 rounded"
                                >
                                  <span className={`font-mono ${member.is_representative ? 'font-semibold' : ''}`}>
                                    {member.source_id}
                                  </span>
                                  {member.is_representative && (
                                    <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs font-medium">
                                      REP
                                    </span>
                                  )}
                                  {member.sequence_identity_to_rep !== undefined && !member.is_representative && (
                                    <span className="text-xs text-gray-500">
                                      {(member.sequence_identity_to_rep * 100).toFixed(1)}% identity
                                    </span>
                                  )}
                                  {member.sequence_length && (
                                    <span className="text-xs text-gray-500">
                                      {member.sequence_length} aa
                                    </span>
                                  )}
                                  {member.curation_status && (
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                                      member.curation_status === 'curated'
                                        ? 'bg-green-100 text-green-700'
                                        : member.curation_status === 'pending'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {member.curation_status}
                                    </span>
                                  )}
                                  <Link
                                    href={`/protein/${member.source_id}`}
                                    className="ml-auto text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    View →
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">Failed to load cluster members</div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-gray-600">
              Showing {startIdx + 1}-{Math.min(startIdx + pageSize, sortedProteins.length)} of {sortedProteins.length}
            </div>
          </div>
        )}
      </div>

      {filteredProteins.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No proteins found matching filter
        </div>
      )}
    </main>
  );
}
