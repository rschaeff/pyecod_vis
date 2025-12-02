'use client';

/**
 * SwissProt Novel Domain Detail Page
 *
 * Shows protein/domain details with structure viewer and curation controls
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface DomainSegment {
  start: number;
  end: number;
}

interface ClusterInfo {
  id: number;
  cluster_name: string;
  member_count: number;
  representative_domain_id: string;
  avg_plddt: number;
  avg_dpam: number;
  avg_hh: number;
}

interface ClusterMember {
  domain_id: string;
  unp_acc: string;
  is_representative: boolean;
  plddt: number;
  dpam_prob: number;
  hh_prob: number;
}

interface SiblingDomain {
  domain_id: string;
  range: string;
  judge: string;
  t_group: string | null;
  dpam_prob: number;
  accession_status: string | null;
}

/**
 * Domain Architecture Visualization Component
 * Shows a linear representation of domains on a protein
 */
function DomainArchitecture({
  currentDomain,
  siblingDomains,
}: {
  currentDomain: {
    domain_id: string;
    range: string;
    t_group: string | null;
    dpam_prob: number;
    accession_status: string | null;
    judge: string;
  };
  siblingDomains: SiblingDomain[];
}) {
  // Combine current domain with siblings and sort by start position
  const allDomains = [
    { ...currentDomain, isCurrent: true },
    ...siblingDomains.map(d => ({ ...d, isCurrent: false })),
  ];

  // Parse range strings to get start positions
  const parseRangeStart = (range: string): number => {
    if (!range) return 0;
    const match = range.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  const parseRangeEnd = (range: string): number => {
    if (!range) return 0;
    // Handle complex ranges like "26-100,150-200"
    const parts = range.split(',');
    const lastPart = parts[parts.length - 1];
    const match = lastPart.match(/(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  };

  // Sort domains by start position
  const sortedDomains = [...allDomains].sort((a, b) =>
    parseRangeStart(a.range) - parseRangeStart(b.range)
  );

  // Calculate max position for scaling
  const maxPos = Math.max(...sortedDomains.map(d => parseRangeEnd(d.range)), 100);

  // Get color based on ECOD status
  const getDomainColor = (domain: typeof allDomains[0]) => {
    if (domain.isCurrent) return 'bg-red-500 border-red-600'; // Current candidate
    if (domain.accession_status === 'approved') return 'bg-green-500 border-green-600';
    if (domain.accession_status === 'pending' || domain.accession_status === 'deferred') return 'bg-orange-400 border-orange-500';
    return 'bg-gray-400 border-gray-500'; // Not in ECOD
  };

  const getDomainLabel = (domain: typeof allDomains[0]) => {
    if (domain.isCurrent) return 'candidate';
    if (domain.accession_status === 'approved') return 'in ECOD';
    if (domain.accession_status === 'pending' || domain.accession_status === 'deferred') return 'staging';
    return 'not in ECOD';
  };

  return (
    <div className="space-y-2">
      {/* Track with domains */}
      <div className="relative h-8 bg-gray-100 rounded border">
        {sortedDomains.map((domain, idx) => {
          const start = parseRangeStart(domain.range);
          const end = parseRangeEnd(domain.range);
          const left = (start / maxPos) * 100;
          const width = Math.max(((end - start) / maxPos) * 100, 2); // Min 2% width

          return (
            <div
              key={domain.domain_id || idx}
              className={`absolute top-1 bottom-1 rounded border ${getDomainColor(domain)} cursor-pointer`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
              }}
              title={`${domain.domain_id}\n${domain.range}\nT-group: ${domain.t_group || 'unknown'}\nDPAM: ${domain.dpam_prob.toFixed(2)}\n${getDomainLabel(domain)}`}
            >
              {domain.isCurrent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">*</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded border border-red-600"></span>
          <span className="text-gray-600">Current (candidate)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500 rounded border border-green-600"></span>
          <span className="text-gray-600">Approved in ECOD</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-orange-400 rounded border border-orange-500"></span>
          <span className="text-gray-600">Staging</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-gray-400 rounded border border-gray-500"></span>
          <span className="text-gray-600">Not in ECOD</span>
        </div>
      </div>

      {/* Domain list */}
      <div className="mt-2 text-xs">
        <table className="w-full">
          <thead>
            <tr className="text-gray-500 text-left">
              <th className="py-1 pr-2">Domain</th>
              <th className="py-1 pr-2">Range</th>
              <th className="py-1 pr-2">T-group</th>
              <th className="py-1 pr-2">DPAM</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {sortedDomains.map((domain, idx) => (
              <tr key={domain.domain_id || idx} className={domain.isCurrent ? 'bg-red-50' : ''}>
                <td className="py-1 pr-2 font-medium">
                  {domain.domain_id}
                  {domain.isCurrent && <span className="ml-1 text-red-600">*</span>}
                </td>
                <td className="py-1 pr-2">{domain.range}</td>
                <td className="py-1 pr-2">{domain.t_group || '-'}</td>
                <td className="py-1 pr-2">{domain.dpam_prob.toFixed(2)}</td>
                <td className="py-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    domain.isCurrent ? 'bg-red-100 text-red-800' :
                    domain.accession_status === 'approved' ? 'bg-green-100 text-green-800' :
                    domain.accession_status === 'pending' || domain.accession_status === 'deferred' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {getDomainLabel(domain)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SwissProtProtein {
  id: number;
  source_id: string;
  unp_acc: string;
  domain_range: string;
  sequence: string;
  sequence_length: number;
  plddt: number;
  dpam_prob: number;
  hh_prob: number;
  assigned_t_group: string;
  t_group_name: string | null;
  h_group_name: string | null;
  x_group_name: string | null;
  cluster_id: number;
  cluster_size: number;
  curation_status: string;
  curator_decision: string;
  curator_name: string;
  curator_notes: string;
  curated_at: string;
  domain_segments: DomainSegment[];
  cluster_info: ClusterInfo | null;
  cluster_members: ClusterMember[];
  // Protein context fields
  protein_name: string | null;
  gene_name: string | null;
  organism: string | null;
  total_sibling_count: number;
  ecod_sibling_count: number;
  has_ecod_siblings: boolean;
  sibling_domains: SiblingDomain[] | null;
}

export default function SwissProtProteinPage() {
  const params = useParams();
  const router = useRouter();
  const sourceId = params.id as string;

  const [protein, setProtein] = useState<SwissProtProtein | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structureLoading, setStructureLoading] = useState(true);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(null);
  const [viewer, setViewer] = useState<any>(null);

  // Callback ref - called when element is attached to DOM
  const viewerRef = useCallback((element: HTMLDivElement | null) => {
    console.log('[SwissProtViewer] Callback ref called with:', element);
    setViewerElement(element);
  }, []);

  // Curation state
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch protein data
  useEffect(() => {
    if (!sourceId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/swissprot/protein/${sourceId}`)
      .then(res => {
        if (!res.ok) throw new Error('Protein not found');
        return res.json();
      })
      .then(data => {
        setProtein(data.protein);
        setNotes(data.protein.curator_notes || '');
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sourceId]);

  // Initialize structure viewer
  useEffect(() => {
    if (!viewerElement) {
      console.log('[SwissProtViewer] No viewer element yet');
      return;
    }

    if (!sourceId) {
      console.log('[SwissProtViewer] No sourceId yet');
      return;
    }

    let isMounted = true;

    async function loadStructure() {
      try {
        console.log(`[SwissProtViewer] Loading structure for ${sourceId}...`);

        // @ts-ignore - 3dmol types not available
        const module = await import('3dmol/build/3Dmol.js');
        const $3Dmol = (module as any).default || module;
        console.log('[SwissProtViewer] 3Dmol.js loaded');

        if (!isMounted) return;

        // Fetch structure
        console.log(`[SwissProtViewer] Fetching from /api/swissprot/structure/${sourceId}...`);
        const response = await fetch(`/api/swissprot/structure/${sourceId}`);

        if (!response.ok) {
          console.error(`[SwissProtViewer] API error: ${response.status}`);
          if (response.status === 404) {
            throw new Error('Structure file not found');
          }
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to load structure');
        }

        const pdbData = await response.text();
        console.log(`[SwissProtViewer] Structure data size: ${pdbData.length} bytes`);

        if (!isMounted || !viewerElement) return;

        // Initialize viewer directly on the element
        console.log('[SwissProtViewer] Initializing viewer...');
        const viewerInstance = $3Dmol.createViewer(viewerElement, {
          backgroundColor: 'white',
        });

        // Add model and style
        viewerInstance.addModel(pdbData, 'pdb');
        viewerInstance.setStyle({}, { cartoon: { color: 'spectrum' } });
        viewerInstance.zoomTo();
        viewerInstance.render();
        console.log('[SwissProtViewer] Render complete!');

        setViewer(viewerInstance);
        setStructureLoading(false);
      } catch (err) {
        console.error('[SwissProtViewer] Error:', err);
        if (isMounted) {
          setStructureError(err instanceof Error ? err.message : 'Failed to load structure');
          setStructureLoading(false);
        }
      }
    }

    loadStructure();

    return () => {
      isMounted = false;
    };
  }, [viewerElement, sourceId]);

  // Handle curation submission
  const handleCurate = async (decision: 'approved' | 'rejected' | 'needs_review') => {
    if (!protein) return;

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/swissprot/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protein_id: protein.id,
          curator: 'rschaeff', // TODO: Get from auth
          decision,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save curation');
      }

      // Navigate to next protein or back to queue
      if (data.next_protein) {
        router.push(`/swissprot/${data.next_protein}`);
      } else {
        router.push('/swissprot');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading protein...</span>
      </div>
    );
  }

  // Error state
  if (error || !protein) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          {error || 'Protein not found'}
        </div>
        <Link href="/swissprot" className="mt-4 inline-block text-blue-600 hover:underline">
          &larr; Back to Queue
        </Link>
      </div>
    );
  }

  const isCurated = protein.curation_status !== 'pending';

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/swissprot" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            &larr; Back to Queue
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{protein.source_id}</h1>
          <p className="text-gray-600">
            UniProt:{' '}
            <a
              href={`https://www.uniprot.org/uniprotkb/${protein.unp_acc}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {protein.unp_acc}
            </a>
          </p>
        </div>
        {isCurated && (
          <div className={`px-4 py-2 rounded-lg ${
            protein.curator_decision === 'approved' ? 'bg-green-100 text-green-800' :
            protein.curator_decision === 'rejected' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            <div className="font-medium capitalize">{protein.curator_decision}</div>
            <div className="text-sm">by {protein.curator_name}</div>
          </div>
        )}
      </div>

      {/* Protein Context Section */}
      <div className="bg-white rounded-lg shadow border mb-6">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-medium text-gray-900">Protein Context</h2>
        </div>
        <div className="p-4">
          {/* Basic protein info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <dt className="text-sm text-gray-500">Protein Name</dt>
              <dd className="font-medium text-gray-900">
                {protein.protein_name || <span className="text-gray-400">Not available</span>}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Gene</dt>
              <dd className="font-medium text-gray-900">
                {protein.gene_name || <span className="text-gray-400">-</span>}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Organism</dt>
              <dd className="font-medium text-gray-900">
                {protein.organism || <span className="text-gray-400">-</span>}
              </dd>
            </div>
          </div>

          {/* Domain Architecture */}
          {(protein.sibling_domains && protein.sibling_domains.length > 0) || protein.domain_range ? (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Domain Architecture</h3>
              <DomainArchitecture
                currentDomain={{
                  domain_id: protein.source_id,
                  range: protein.domain_range,
                  t_group: protein.assigned_t_group,
                  dpam_prob: Number(protein.dpam_prob),
                  accession_status: null,
                  judge: 'candidate',
                }}
                siblingDomains={protein.sibling_domains || []}
              />
              <div className="mt-2 text-sm text-gray-600">
                {protein.total_sibling_count === 0 ? (
                  <span className="text-green-600">Single domain protein</span>
                ) : (
                  <>
                    {protein.total_sibling_count} sibling domain{protein.total_sibling_count !== 1 ? 's' : ''}, {' '}
                    {protein.ecod_sibling_count > 0 ? (
                      <span className="text-blue-600">{protein.ecod_sibling_count} in ECOD</span>
                    ) : (
                      <span className="text-yellow-600">none in ECOD yet</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No domain architecture data available</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Structure Viewer */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-medium text-gray-900">3D Structure</h2>
          </div>
          <div className="relative">
            {/* Always render the viewer div so the ref gets attached */}
            <div
              ref={viewerRef}
              style={{ width: '100%', height: '500px', position: 'relative' }}
            />

            {/* Overlay loading state */}
            {structureLoading && (
              <div
                style={{ width: '100%', height: '500px' }}
                className="absolute top-0 left-0 bg-gray-100 flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <div className="text-gray-600">Loading structure...</div>
                </div>
              </div>
            )}

            {/* Overlay error state */}
            {structureError && (
              <div
                style={{ width: '100%', height: '500px' }}
                className="absolute top-0 left-0 bg-gray-100 flex items-center justify-center"
              >
                <div className="text-center text-gray-600">
                  <div className="text-4xl mb-3">🧬</div>
                  <div className="font-medium">{structureError}</div>
                  <div className="text-sm mt-2">Structure visualization unavailable</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Metadata and Curation */}
        <div className="space-y-6">
          {/* Protein Metadata */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">Domain Information</h2>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Domain Range</dt>
                  <dd className="font-medium">{protein.domain_range || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Sequence Length</dt>
                  <dd className="font-medium">{protein.sequence_length} aa</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">pLDDT Score</dt>
                  <dd className={`font-medium ${Number(protein.plddt) >= 80 ? 'text-green-600' : Number(protein.plddt) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {Number(protein.plddt).toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">DPAM Probability</dt>
                  <dd className={`font-medium ${Number(protein.dpam_prob) >= 0.7 ? 'text-green-600' : 'text-gray-600'}`}>
                    {Number(protein.dpam_prob).toFixed(3)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">HH Probability</dt>
                  <dd className={`font-medium ${Number(protein.hh_prob) < 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(protein.hh_prob).toFixed(3)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm text-gray-500">ECOD Classification</dt>
                  <dd className="font-medium">
                    {protein.assigned_t_group ? (
                      <div>
                        <div>{protein.assigned_t_group}</div>
                        <div className="text-xs text-gray-500 font-normal mt-1">
                          {protein.x_group_name && (
                            <div><span className="text-gray-400">X:</span> {protein.x_group_name}</div>
                          )}
                          {protein.h_group_name && (
                            <div><span className="text-gray-400">H:</span> {protein.h_group_name}</div>
                          )}
                          {protein.t_group_name && (
                            <div><span className="text-gray-400">T:</span> {protein.t_group_name}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Cluster Size</dt>
                  <dd className={`font-medium ${protein.cluster_size >= 10 ? 'text-red-600' : protein.cluster_size >= 5 ? 'text-yellow-600' : 'text-gray-600'}`}>
                    {protein.cluster_size} members
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Cluster Members */}
          {protein.cluster_members.length > 1 && (
            <div className="bg-white rounded-lg shadow border">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-medium text-gray-900">
                  Cluster Members ({protein.cluster_members.length})
                </h2>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Domain</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">UniProt</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">pLDDT</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">DPAM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {protein.cluster_members.map((member) => (
                      <tr
                        key={member.domain_id}
                        className={member.is_representative ? 'bg-blue-50' : ''}
                      >
                        <td className="px-3 py-2">
                          {member.domain_id}
                          {member.is_representative && (
                            <span className="ml-1 text-xs text-blue-600">(rep)</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={`https://www.uniprot.org/uniprotkb/${member.unp_acc}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {member.unp_acc}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-center">{Number(member.plddt).toFixed(1)}</td>
                        <td className="px-3 py-2 text-center">{Number(member.dpam_prob).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Curation Panel */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">Curation</h2>
            </div>
            <div className="p-4">
              {isCurated ? (
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg ${
                    protein.curator_decision === 'approved' ? 'bg-green-50 text-green-800' :
                    protein.curator_decision === 'rejected' ? 'bg-red-50 text-red-800' :
                    'bg-yellow-50 text-yellow-800'
                  }`}>
                    <div className="font-medium capitalize">{protein.curator_decision}</div>
                    <div className="text-sm mt-1">
                      Curated by {protein.curator_name} on {new Date(protein.curated_at).toLocaleDateString()}
                    </div>
                    {protein.curator_notes && (
                      <div className="mt-2 text-sm border-t border-current/20 pt-2">
                        {protein.curator_notes}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Add any notes about this domain..."
                      disabled={saving}
                    />
                  </div>

                  {saveError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                      {saveError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCurate('approved')}
                      disabled={saving}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {saving ? 'Saving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleCurate('rejected')}
                      disabled={saving}
                      className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {saving ? 'Saving...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleCurate('needs_review')}
                      disabled={saving}
                      className="flex-1 bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {saving ? 'Saving...' : 'Needs Review'}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    Is this a real domain or a prediction artifact?
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sequence Display */}
      {protein.sequence && (
        <div className="mt-6 bg-white rounded-lg shadow border">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-medium text-gray-900">Sequence ({protein.sequence_length} aa)</h2>
          </div>
          <div className="p-4">
            <div className="font-mono text-xs break-all bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
              {protein.sequence}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
