'use client';

/**
 * Archaea Cluster Detail Page
 *
 * View cluster members and representative structure
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { ArchaeaCluster, ClusterMember } from '@/lib/archaea-types';

interface ClusterResponse {
  cluster: ArchaeaCluster;
  members: ClusterMember[];
}

export default function ArchaeaClusterDetailPage() {
  const params = useParams();
  const clusterId = params.id as string;

  const [data, setData] = useState<ClusterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clusterId) return;

    const fetchCluster = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/archaea/cluster/${clusterId}`);
        if (!response.ok) {
          if (response.status === 404) throw new Error('Cluster not found');
          throw new Error('Failed to fetch cluster');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cluster');
      } finally {
        setLoading(false);
      }
    };

    fetchCluster();
  }, [clusterId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-medium text-lg">Error</h2>
          <p className="text-red-600 mt-2">{error || 'Failed to load cluster'}</p>
          <Link
            href="/archaea/clusters"
            className="mt-4 inline-block text-red-700 hover:text-red-900 font-medium"
          >
            ← Back to Clusters
          </Link>
        </div>
      </div>
    );
  }

  const { cluster, members } = data;
  const representative = members.find(m => m.is_representative);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Cluster {clusterId}
          </h1>
          <p className="text-gray-600">
            {cluster.cluster_size} members | Representative:{' '}
            <Link
              href={`/archaea/protein/${cluster.cluster_rep_id}`}
              className="text-green-600 hover:text-green-800 font-mono"
            >
              {cluster.cluster_rep_id}
            </Link>
          </p>
        </div>
        <Link
          href="/archaea/clusters"
          className="text-green-600 hover:text-green-800 font-medium"
        >
          ← Back to Clusters
        </Link>
      </div>

      {/* Cluster Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Members" value={cluster.member_count} />
        <StatCard label="Dark Proteins" value={cluster.dark_count} highlight={cluster.dark_count > 0} />
        <StatCard label="Pending" value={cluster.pending_count} />
        <StatCard label="Avg pLDDT" value={cluster.avg_plddt?.toFixed(1) || '-'} />
        <StatCard label="Avg Quality" value={cluster.avg_quality_score?.toFixed(2) || '-'} />
      </div>

      {/* Members Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Cluster Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Protein ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  UniProt
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Length
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  pLDDT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quality
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Novelty
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((member) => (
                <tr
                  key={member.protein_id}
                  className={`hover:bg-gray-50 ${member.is_representative ? 'bg-green-50' : ''}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-sm">
                      {member.protein_id}
                      {member.is_representative && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                          REP
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {member.uniprot_acc || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {member.sequence_length || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {member.mean_plddt ? (
                      <span className={getPlddtColor(member.mean_plddt)}>
                        {member.mean_plddt.toFixed(1)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {member.quality_score?.toFixed(2) || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {member.novelty_category && (
                      <NoveltyBadge category={member.novelty_category} />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {member.curation_status && (
                      <StatusBadge status={member.curation_status} />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/archaea/protein/${member.protein_id}`}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-red-700' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function NoveltyBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    dark: 'bg-red-100 text-red-800',
    'sequence-orphan': 'bg-orange-100 text-orange-800',
    divergent: 'bg-yellow-100 text-yellow-800',
    known: 'bg-green-100 text-green-800',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[category] || 'bg-gray-100'}`}>
      {category}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    in_review: 'bg-blue-100 text-blue-800',
    classified: 'bg-green-100 text-green-800',
    deferred: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}

function getPlddtColor(plddt: number): string {
  if (plddt >= 90) return 'text-blue-600';
  if (plddt >= 70) return 'text-cyan-600';
  if (plddt >= 50) return 'text-yellow-600';
  return 'text-orange-600';
}
