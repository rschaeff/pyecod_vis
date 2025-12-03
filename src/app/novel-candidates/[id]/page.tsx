'use client';

/**
 * Novel Candidate Cluster Detail View
 *
 * Shows all member domains in a cluster with Foldseek hits,
 * structure viewer for representative, and curation controls.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ClusterMember {
  id: number;
  domain_id: number | null;
  unp_acc: string;
  domain_range: string;
  sequence_length: number | null;
  plddt: number | null;
  best_ecod_uid: number | null;
  best_ecod_lddt: number | null;
  best_ecod_tgroup: string | null;
  best_ecod_xgroup: string | null;
  tgroup_name: string | null;
  ecod_domain_id: string | null;
  helix_pct: number | null;
  strand_pct: number | null;
  coil_pct: number | null;
  is_representative: boolean;
  domain_domain_id: string | null;
}

interface Cluster {
  id: number;
  cluster_name: string;
  source: string;
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
  assigned_hgroup: string | null;
  assigned_tgroup: string | null;
  curator_notes: string | null;
  curated_by: string | null;
  curated_at: string | null;
}

interface XgroupDist {
  xgroup: string;
  name: string | null;
  count: number;
}

export default function NovelCandidateDetailPage() {
  const params = useParams();
  const clusterId = params.id as string;

  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [xgroupDist, setXgroupDist] = useState<XgroupDist[]>([]);
  const [lddtDist, setLddtDist] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Structure viewer state
  const [selectedMember, setSelectedMember] = useState<ClusterMember | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(null);

  // Curation state
  const [curatorNotes, setCuratorNotes] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null);

  const viewerRef = useCallback((element: HTMLDivElement | null) => {
    setViewerElement(element);
  }, []);

  useEffect(() => {
    if (!clusterId) return;
    fetchClusterDetail();
  }, [clusterId]);

  useEffect(() => {
    if (cluster?.curator_notes) {
      setCuratorNotes(cluster.curator_notes);
    }
  }, [cluster]);

  // Load structure for selected member
  useEffect(() => {
    if (!viewerElement || !selectedMember) return;

    let isMounted = true;
    setStructureLoading(true);

    async function loadStructure() {
      try {
        // @ts-ignore
        const module = await import('3dmol/build/3Dmol.js');
        const $3Dmol = (module as any).default || module;

        if (!isMounted || !viewerElement) return;

        // Fetch AlphaFold structure using UniProt accession
        const url = `https://alphafold.ebi.ac.uk/files/AF-${selectedMember!.unp_acc}-F1-model_v4.pdb`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Structure not available');
        }

        const pdbData = await response.text();
        if (!isMounted || !viewerElement) return;

        const viewer = $3Dmol.createViewer(viewerElement, {
          backgroundColor: 'white',
        });

        viewer.addModel(pdbData, 'pdb');

        // Parse range to highlight domain
        const range = selectedMember!.domain_range;
        const rangeMatch = range?.match(/(\d+)-(\d+)/);

        // Style whole protein in gray
        viewer.setStyle({}, { cartoon: { color: 'gray', opacity: 0.5 } });

        // Highlight domain range in red if we have it
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          viewer.setStyle(
            { resi: `${start}-${end}` },
            { cartoon: { color: 'red' } }
          );
          viewer.zoomTo({ resi: `${start}-${end}` });
        } else {
          viewer.zoomTo();
        }

        viewer.render();
        setStructureLoading(false);
      } catch (err) {
        if (isMounted) {
          setStructureLoading(false);
        }
      }
    }

    loadStructure();

    return () => {
      isMounted = false;
    };
  }, [viewerElement, selectedMember]);

  const fetchClusterDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/curation/novel-candidates/${clusterId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Cluster not found');
        throw new Error('Failed to fetch cluster');
      }

      const data = await response.json();
      setCluster(data.cluster);
      setMembers(data.members);
      setXgroupDist(data.xgroup_distribution);
      setLddtDist(data.lddt_distribution);

      // Auto-select representative
      const rep = data.members.find((m: ClusterMember) => m.is_representative);
      if (rep) setSelectedMember(rep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setUpdateLoading(true);
    setUpdateMessage(null);

    try {
      const response = await fetch(`/api/curation/novel-candidates/${clusterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          curator_notes: curatorNotes,
          curator: 'rschaeff', // TODO: Get from session
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update');
      }

      setUpdateMessage({ type: 'success', text: `Status updated to ${newStatus}` });
      fetchClusterDetail();
    } catch (err) {
      setUpdateMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update'
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const getLddtBadge = (lddt: number | null) => {
    if (lddt === null) return <span className="text-gray-400">-</span>;

    const color = lddt >= 0.7 ? 'bg-green-100 text-green-800' :
                  lddt >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800';

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {lddt.toFixed(2)}
      </span>
    );
  };

  const getSSBar = (helix: number | null, strand: number | null, coil: number | null) => {
    if (helix === null && strand === null) return <span className="text-gray-400">-</span>;

    const h = helix || 0;
    const s = strand || 0;
    const c = coil || 0;

    return (
      <div className="flex h-3 w-20 rounded overflow-hidden" title={`H:${h.toFixed(0)}% S:${s.toFixed(0)}% C:${c.toFixed(0)}%`}>
        <div className="bg-red-400" style={{ width: `${h}%` }} />
        <div className="bg-blue-400" style={{ width: `${s}%` }} />
        <div className="bg-gray-300" style={{ width: `${c}%` }} />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading cluster...</span>
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          {error || 'Cluster not found'}
        </div>
        <Link href="/novel-candidates" className="mt-4 inline-block text-blue-600 hover:underline">
          &larr; Back to Clusters
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/novel-candidates" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          &larr; Back to Clusters
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{cluster.cluster_name}</h1>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-gray-600">{cluster.member_count} members</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            cluster.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            cluster.status === 'in_review' ? 'bg-blue-100 text-blue-800' :
            cluster.status === 'curated' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {cluster.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats and X-group distribution */}
        <div className="space-y-6">
          {/* Cluster Stats */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">Cluster Statistics</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Best LDDT:</span>
                <span className="font-medium">
                  {cluster.avg_best_lddt?.toFixed(3) || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Best LDDT:</span>
                <span className="font-medium">
                  {cluster.max_best_lddt?.toFixed(3) || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">X-group Consistency:</span>
                <span className="font-medium">
                  {cluster.xgroup_consistency ? `${(cluster.xgroup_consistency * 100).toFixed(0)}%` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg pLDDT:</span>
                <span className="font-medium">
                  {cluster.avg_plddt?.toFixed(1) || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Length:</span>
                <span className="font-medium">
                  {cluster.avg_domain_length || '-'} aa
                </span>
              </div>
            </div>
          </div>

          {/* X-group Distribution */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">X-group Hits</h2>
            </div>
            <div className="p-4">
              {xgroupDist.length === 0 ? (
                <p className="text-gray-500 text-sm">No X-group hits</p>
              ) : (
                <div className="space-y-2">
                  {xgroupDist.map((xg) => (
                    <div key={xg.xgroup} className="flex items-center gap-2">
                      <div className="w-20 h-4 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${(xg.count / cluster.member_count) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-sm">{xg.xgroup}</span>
                      <span className="text-gray-500 text-sm">({xg.count})</span>
                      {xg.name && (
                        <span className="text-gray-400 text-xs truncate">{xg.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* LDDT Distribution */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">LDDT Distribution</h2>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {Object.entries(lddtDist).map(([bucket, count]) => (
                  <div key={bucket} className="flex items-center gap-2">
                    <div className="w-20 h-4 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                      <div
                        className={`h-full ${
                          bucket === '0.7+' ? 'bg-green-500' :
                          bucket === '0.5-0.7' ? 'bg-yellow-500' :
                          bucket === '0.3-0.5' ? 'bg-orange-500' :
                          bucket === 'no_hit' ? 'bg-gray-400' : 'bg-red-500'
                        }`}
                        style={{ width: `${(count / cluster.member_count) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm">{bucket}</span>
                    <span className="text-gray-500 text-sm">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column: Structure Viewer */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">
                Structure: {selectedMember?.unp_acc || 'Select a member'}
              </h2>
            </div>
            <div className="relative">
              <div
                ref={viewerRef}
                style={{ width: '100%', height: '400px', position: 'relative' }}
              />
              {structureLoading && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <div className="text-gray-600">Loading structure...</div>
                  </div>
                </div>
              )}
              {!selectedMember && !structureLoading && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <div className="text-gray-500">Select a member to view structure</div>
                </div>
              )}
            </div>
            {selectedMember && (
              <div className="p-3 border-t bg-gray-50 text-sm">
                <div className="flex justify-between">
                  <span>Range: {selectedMember.domain_range}</span>
                  <span>pLDDT: {selectedMember.plddt?.toFixed(1) || '-'}</span>
                </div>
                {selectedMember.best_ecod_lddt && (
                  <div className="mt-1 text-gray-600">
                    Best ECOD hit: {selectedMember.ecod_domain_id || selectedMember.best_ecod_uid}
                    (LDDT: {selectedMember.best_ecod_lddt.toFixed(2)})
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Curation Actions */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">Curation</h2>
            </div>
            <div className="p-4">
              {updateMessage && (
                <div className={`mb-4 p-3 rounded ${
                  updateMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {updateMessage.text}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={curatorNotes}
                  onChange={(e) => setCuratorNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Add curation notes..."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateStatus('in_review')}
                  disabled={updateLoading}
                  className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-sm font-medium disabled:opacity-50"
                >
                  Mark In Review
                </button>
                <button
                  onClick={() => updateStatus('curated')}
                  disabled={updateLoading}
                  className="px-3 py-1.5 bg-green-100 text-green-800 rounded hover:bg-green-200 text-sm font-medium disabled:opacity-50"
                >
                  Mark Curated
                </button>
                <button
                  onClick={() => updateStatus('rejected')}
                  disabled={updateLoading}
                  className="px-3 py-1.5 bg-red-100 text-red-800 rounded hover:bg-red-200 text-sm font-medium disabled:opacity-50"
                >
                  Reject
                </button>
              </div>

              {cluster.curated_by && (
                <div className="mt-4 text-xs text-gray-500">
                  Last updated by {cluster.curated_by}
                  {cluster.curated_at && ` on ${new Date(cluster.curated_at).toLocaleString()}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Members Table */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">Members ({members.length})</h2>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">UniProt</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">LDDT</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        selectedMember?.id === member.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedMember(member)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {member.is_representative && (
                            <span className="text-yellow-500" title="Representative">★</span>
                          )}
                          <a
                            href={`https://www.uniprot.org/uniprotkb/${member.unp_acc}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {member.unp_acc}
                          </a>
                        </div>
                        <div className="text-xs text-gray-500">{member.domain_range}</div>
                      </td>
                      <td className="px-3 py-2">{getLddtBadge(member.best_ecod_lddt)}</td>
                      <td className="px-3 py-2">
                        {getSSBar(member.helix_pct, member.strand_pct, member.coil_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
