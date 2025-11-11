'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StructureViewer from '@/components/StructureViewer';

interface Evidence {
  evidence_type: string;
  hit_ecod_domain_id?: string;
  hit_ecod_uid?: number;
  evalue: number;
  query_range?: string;
  hit_range?: string;
  ref_t_group?: string;
  ref_f_group?: string;
  identity?: number;
  query_coverage?: number;
}

interface Domain {
  id: number;
  domain_number: number;
  start_pos: number;
  end_pos: number;
  automated_start_pos?: number;
  automated_end_pos?: number;
  assigned_t_group: string;
  assigned_h_group?: string;
  assigned_x_group?: string;
  assigned_f_group?: string;
  confidence: number;
  curator_decision?: string;
  evidence: Evidence[];
}

interface Protein {
  id: number;
  source_id: string;
  pdb_id: string;
  chain_id: string;
  sequence: string;
  sequence_length: number;
  partition_coverage: number;
  domain_count: number;
  partition_quality: string;
  curation_status: string;
}

interface Metadata {
  pdb_title?: string;
  entity_description?: string;
  entity_id?: number;
  pdb_deposition_date?: string;
  pdb_release_date?: string;
  experimental_method?: string;
  resolution_angstrom?: number;
  biological_assembly_count?: number;
  uniprot_accession?: string;
  uniprot_id?: string;
  uniprot_range?: string;
}

export default function ProteinPage() {
  const params = useParams();
  const router = useRouter();
  const sourceId = params.id as string;

  const [protein, setProtein] = useState<Protein | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Boundary edit state
  const [editedBoundaries, setEditedBoundaries] = useState<{[key: number]: {start: number, end: number}}>({});

  // Breakpoint collection state
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [isCollectingBreakpoints, setIsCollectingBreakpoints] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'reject' | 'flag'>('reject');
  const [modalNotes, setModalNotes] = useState('');

  useEffect(() => {
    fetch(`/api/protein/${sourceId}`)
      .then(res => res.json())
      .then(data => {
        setProtein(data.protein);
        setDomains(data.domains);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load protein:', err);
        setLoading(false);
      });
  }, [sourceId]);

  // Fetch metadata
  useEffect(() => {
    fetch(`/api/protein/${sourceId}/metadata`)
      .then(res => res.json())
      .then(data => {
        if (data.metadata) {
          setMetadata(data.metadata);
        }
      })
      .catch(err => {
        console.warn('Failed to load metadata:', err);
      });
  }, [sourceId]);

  const handleBoundaryChange = (domainId: number, field: 'start' | 'end', value: number) => {
    setEditedBoundaries(prev => ({
      ...prev,
      [domainId]: {
        ...prev[domainId],
        start: field === 'start' ? value : (prev[domainId]?.start || domains.find(d => d.id === domainId)?.start_pos || 0),
        end: field === 'end' ? value : (prev[domainId]?.end || domains.find(d => d.id === domainId)?.end_pos || 0),
      }
    }));
  };

  const handleBreakpointClick = (position: number) => {
    setBreakpoints(prev => {
      // Toggle if already exists
      if (prev.includes(position)) {
        return prev.filter(p => p !== position);
      }
      // Add and sort
      return [...prev, position].sort((a, b) => a - b);
    });
  };

  const removeBreakpoint = (position: number) => {
    setBreakpoints(prev => prev.filter(p => p !== position));
  };

  const submitCuration = async (decision: string, notes: string, breakpointsToSubmit?: number[]) => {
    if (!protein) return;

    setSubmitting(true);

    const curationData = {
      protein_id: protein.id,
      curator: 'rschaeff',
      decision: decision,
      domains: domains.map(domain => ({
        domain_id: domain.id,
        start_pos: editedBoundaries[domain.id]?.start || domain.start_pos,
        end_pos: editedBoundaries[domain.id]?.end || domain.end_pos,
        curator_decision: decision === 'rejected' ? 'rejected' :
                         (editedBoundaries[domain.id] ? 'modified' : 'accepted')
      })),
      notes: notes,
      breakpoints: breakpointsToSubmit && breakpointsToSubmit.length > 0 ? breakpointsToSubmit : undefined
    };

    try {
      const response = await fetch('/api/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(curationData)
      });

      const result = await response.json();

      if (result.success) {
        // Navigate to next protein or back to queue
        if (result.next_protein) {
          router.push(`/protein/${result.next_protein}`);
        } else {
          router.push('/queue');
        }
      } else {
        alert('Curation failed: ' + result.message);
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Curation error:', error);
      alert('Curation failed');
      setSubmitting(false);
    }
  };

  const handleApprove = () => submitCuration('approved', 'Approved via pyecod_vis');

  const handleReject = () => {
    setModalType('reject');
    setModalNotes('');
    setShowModal(true);
  };

  const handleFlag = () => {
    setModalType('flag');
    setModalNotes('');
    setShowModal(true);
  };

  const handleModalSubmit = () => {
    const decision = modalType === 'reject' ? 'rejected' : 'needs_review';
    const defaultNotes = modalType === 'reject'
      ? 'Rejected via pyecod_vis'
      : 'Flagged for expert review via pyecod_vis';

    submitCuration(decision, modalNotes || defaultNotes, breakpoints.length > 0 ? breakpoints : undefined);
    setShowModal(false);
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading protein...</div>
      </main>
    );
  }

  if (!protein) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-red-500">Protein not found</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/queue"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Queue
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-2xl font-bold text-gray-900">
                {protein.source_id}
              </h1>
              <span className={`px-3 py-1 rounded text-sm ${
                protein.partition_quality === 'good'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {protein.partition_quality}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {protein.sequence_length} residues • {protein.domain_count} domain{protein.domain_count !== 1 ? 's' : ''} • {(protein.partition_coverage * 100).toFixed(0)}% coverage
            </div>
          </div>

          {/* Entity/Chain Description */}
          {metadata?.entity_description && (
            <div className="text-base text-gray-700 font-medium">
              Chain {protein.chain_id}: {metadata.entity_description}
            </div>
          )}

          {/* PDB Title */}
          {metadata?.pdb_title && (
            <div className="text-sm text-gray-600 italic">
              {metadata.pdb_title}
            </div>
          )}
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-12 gap-6 p-6 max-w-[1800px] mx-auto">

        {/* LEFT COLUMN: Domain Information */}
        <div className="col-span-4 space-y-4">
          {/* Protein Summary */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Protein Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">PDB ID</dt>
                <dd className="font-medium">{protein.pdb_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Chain</dt>
                <dd className="font-medium">{protein.chain_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Length</dt>
                <dd className="font-medium">{protein.sequence_length} aa</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Coverage</dt>
                <dd className={`font-medium ${
                  protein.partition_coverage >= 0.9 ? 'text-green-600' :
                  protein.partition_coverage >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {(protein.partition_coverage * 100).toFixed(0)}%
                </dd>
              </div>

              {/* PDB Metadata */}
              {metadata?.experimental_method && (
                <>
                  <div className="border-t pt-2 mt-2" />
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Method</dt>
                    <dd className="font-medium text-xs">
                      {metadata.experimental_method}
                    </dd>
                  </div>
                </>
              )}
              {metadata?.resolution_angstrom && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Resolution</dt>
                  <dd className="font-medium">{metadata.resolution_angstrom.toFixed(2)} Å</dd>
                </div>
              )}
              {metadata?.pdb_release_date && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Released</dt>
                  <dd className="font-medium text-xs">
                    {new Date(metadata.pdb_release_date).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {metadata?.uniprot_accession && (
                <>
                  <div className="border-t pt-2 mt-2" />
                  <div className="flex justify-between">
                    <dt className="text-gray-600">UniProt</dt>
                    <dd className="font-medium">
                      <a
                        href={`https://www.uniprot.org/uniprotkb/${metadata.uniprot_accession}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {metadata.uniprot_accession}
                      </a>
                    </dd>
                  </div>
                  {metadata.uniprot_range && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 text-xs">UP Range</dt>
                      <dd className="font-mono text-xs text-gray-600">{metadata.uniprot_range}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>

          {/* Domain Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">
                Domains ({domains.length})
              </h2>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Range</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">T-Group</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Conf.</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {domains.map((domain) => (
                    <tr key={domain.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-900">
                        {domain.domain_number}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        <div className="space-y-1">
                          <div className="text-gray-900">
                            {editedBoundaries[domain.id]?.start ?? domain.start_pos}-
                            {editedBoundaries[domain.id]?.end ?? domain.end_pos}
                          </div>
                          {domain.automated_start_pos && (
                            <div className="text-gray-400">
                              auto: {domain.automated_start_pos}-{domain.automated_end_pos}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs">
                          <div className="font-medium text-gray-900">{domain.assigned_t_group}</div>
                          {domain.assigned_f_group && (
                            <div className="text-gray-500 truncate max-w-[100px]" title={domain.assigned_f_group}>
                              {domain.assigned_f_group}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className={`text-xs font-medium ${
                          domain.confidence >= 0.8 ? 'text-green-600' :
                          domain.confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {(domain.confidence * 100).toFixed(0)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sequence (Collapsible) */}
          <details className="bg-white rounded-lg shadow">
            <summary className="px-4 py-3 cursor-pointer font-semibold text-sm text-gray-700 hover:bg-gray-50">
              Sequence
            </summary>
            <div className="px-4 pb-4">
              <div className="font-mono text-xs bg-gray-50 p-3 rounded overflow-x-auto max-h-[300px] overflow-y-auto">
                {protein.sequence.match(/.{1,60}/g)?.map((chunk, i) => (
                  <div key={i} className="mb-1">
                    <span className="text-gray-400 mr-3">{(i * 60 + 1).toString().padStart(4, ' ')}</span>
                    {chunk}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>

        {/* CENTER COLUMN: 3D Structure */}
        <div className="col-span-5">
          <div className="bg-white rounded-lg shadow p-4 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">3D Structure</h2>
            <StructureViewer
              proteinId={sourceId}
              domains={domains}
              editedBoundaries={editedBoundaries}
              breakpoints={breakpoints}
              isCollectingBreakpoints={isCollectingBreakpoints}
              onBreakpointClick={handleBreakpointClick}
              height="600px"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Curation Decision Panel */}
        <div className="col-span-3 space-y-4">
          {/* Breakpoint Collection Panel */}
          <div className="bg-white rounded-lg shadow p-4 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Mark Breakpoints</h2>

            <button
              onClick={() => setIsCollectingBreakpoints(!isCollectingBreakpoints)}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                isCollectingBreakpoints
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {isCollectingBreakpoints ? '✓ Collecting Breakpoints (click structure)' : '📍 Start Marking Breakpoints'}
            </button>

            {breakpoints.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 rounded">
                <div className="text-xs font-medium text-gray-700 mb-2">
                  Collected Breakpoints ({breakpoints.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {breakpoints.map(pos => (
                    <div
                      key={pos}
                      className="flex items-center gap-1 bg-white border rounded px-2 py-0.5 text-xs"
                    >
                      <span className="font-mono">{pos}</span>
                      <button
                        onClick={() => removeBreakpoint(pos)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setBreakpoints([])}
                  className="mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="mt-2 text-xs text-gray-500">
              💡 Mark positions where you see domain splits
            </div>
          </div>

          {/* Decision Panel */}
          <div className="bg-white rounded-lg shadow p-4 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Curation Decision</h2>

            <div className="space-y-3 mb-6">
              <button
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-left disabled:opacity-50"
                onClick={handleApprove}
                disabled={submitting}
              >
                <div className="flex items-center justify-between">
                  <span>{submitting ? 'Saving...' : '✓ Approve All Domains'}</span>
                </div>
                <div className="text-xs text-green-100 mt-1">
                  Accept all domain boundaries and classifications
                </div>
              </button>

              <button
                className="w-full px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-left"
                onClick={handleReject}
                disabled={submitting}
              >
                <div className="flex items-center justify-between">
                  <span>✗ Reject Partitioning</span>
                </div>
                <div className="text-xs text-red-600 mt-1">
                  Mark domains as incorrect (needs repartitioning)
                </div>
              </button>

              <button
                className="w-full px-4 py-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors font-medium text-left"
                onClick={handleFlag}
                disabled={submitting}
              >
                <div className="flex items-center justify-between">
                  <span>⚠ Flag for Review</span>
                </div>
                <div className="text-xs text-yellow-700 mt-1">
                  Mark as needing expert attention
                </div>
              </button>

              <button
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                onClick={() => router.push('/queue')}
              >
                Skip (Return Later)
              </button>
            </div>

            <div className="pt-4 border-t text-xs text-gray-500">
              <p className="mb-2 font-medium">Keyboard shortcuts:</p>
              <ul className="space-y-1">
                <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded">A</kbd> Approve</li>
                <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded">R</kbd> Reject</li>
                <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded">F</kbd> Flag</li>
                <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded">S</kbd> Skip</li>
              </ul>
            </div>
          </div>

          {/* Domain Details (expandable per domain) */}
          <div className="space-y-2">
            {domains.map((domain) => (
              <details key={domain.id} className="bg-white rounded-lg shadow">
                <summary className="px-4 py-3 cursor-pointer font-medium text-sm hover:bg-gray-50">
                  Domain {domain.domain_number} Details
                </summary>
                <div className="px-4 pb-4 text-sm space-y-3">
                  {/* Boundary Editor */}
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-2">Manual Boundaries</div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        className="w-20 px-2 py-1 border rounded text-sm"
                        value={editedBoundaries[domain.id]?.start ?? domain.start_pos}
                        onChange={(e) => handleBoundaryChange(domain.id, 'start', parseInt(e.target.value) || 0)}
                      />
                      <span>-</span>
                      <input
                        type="number"
                        className="w-20 px-2 py-1 border rounded text-sm"
                        value={editedBoundaries[domain.id]?.end ?? domain.end_pos}
                        onChange={(e) => handleBoundaryChange(domain.id, 'end', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Evidence */}
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      Top Evidence ({domain.evidence.length} total)
                    </div>
                    <div className="space-y-2">
                      {domain.evidence.slice(0, 2).map((ev, i) => (
                        <div key={i} className="text-xs bg-gray-50 p-2 rounded">
                          <div className="font-medium text-blue-600">{ev.hit_ecod_domain_id}</div>
                          <div className="text-gray-600">
                            {ev.evidence_type} • e={ev.evalue.toExponential(1)}
                          </div>
                          {ev.ref_f_group && (
                            <div className="text-gray-500 truncate" title={ev.ref_f_group}>
                              {ev.ref_f_group}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Reject/Flag Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalType === 'reject' ? 'Reject Partitioning' : 'Flag for Review'}
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Breakpoints Section */}
              {breakpoints.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Breakpoints Collected ({breakpoints.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {breakpoints.map(pos => (
                      <div
                        key={pos}
                        className="flex items-center gap-1 bg-white border border-blue-300 rounded px-2 py-1 text-sm"
                      >
                        <span className="font-mono text-blue-700">{pos}</span>
                        <button
                          onClick={() => removeBreakpoint(pos)}
                          className="text-gray-400 hover:text-red-600 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    These positions will be included for downstream repartitioning
                  </div>
                </div>
              )}

              {/* Notes Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder={
                    modalType === 'reject'
                      ? 'Describe why the partitioning is incorrect...'
                      : 'Describe what needs expert attention...'
                  }
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                />
              </div>

              {/* Explanation */}
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                {modalType === 'reject' ? (
                  <>
                    <strong>Reject</strong> when domain boundaries are objectively wrong.
                    {breakpoints.length > 0
                      ? ' The breakpoints you marked will guide repartitioning.'
                      : ' Consider marking breakpoints on the structure if you see where domains should split.'}
                  </>
                ) : (
                  <>
                    <strong>Flag for Review</strong> when classification is uncertain or needs expert judgment.
                    This keeps the current partitioning but marks it for expert attention.
                  </>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                className={`px-4 py-2 text-white rounded-lg ${
                  modalType === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : modalType === 'reject' ? 'Reject' : 'Flag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
