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

export default function ProteinPage() {
  const params = useParams();
  const router = useRouter();
  const sourceId = params.id as string;

  const [protein, setProtein] = useState<Protein | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Boundary edit state
  const [editedBoundaries, setEditedBoundaries] = useState<{[key: number]: {start: number, end: number}}>({});

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

  const handleApprove = async () => {
    if (!protein) return;

    setSubmitting(true);

    const curationData = {
      protein_id: protein.id,
      curator: 'rschaeff',
      decision: 'approved',
      domains: domains.map(domain => ({
        domain_id: domain.id,
        start_pos: editedBoundaries[domain.id]?.start || domain.start_pos,
        end_pos: editedBoundaries[domain.id]?.end || domain.end_pos,
        curator_decision: editedBoundaries[domain.id] ? 'modified' : 'approved'
      })),
      notes: 'Curated via pyecod_vis'
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
              height="600px"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Curation Decision Panel */}
        <div className="col-span-3 space-y-4">
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
    </main>
  );
}
