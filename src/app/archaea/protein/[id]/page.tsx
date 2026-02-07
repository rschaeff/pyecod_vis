'use client';

/**
 * Archaea Protein Detail Page
 *
 * Structure viewer with quality metrics and curation controls
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ArchaeaProteinDetail, ClusterMember, ArchaeaCurationDecision } from '@/lib/archaea-types';

// We'll dynamically load 3Dmol to avoid SSR issues
let $3Dmol: typeof import('3dmol') | null = null;

interface ProteinDetailResponse {
  protein: ArchaeaProteinDetail;
  cluster_members?: ClusterMember[];
}

export default function ArchaeaProteinPage() {
  const params = useParams();
  const router = useRouter();
  const proteinId = params.id as string;

  const [data, setData] = useState<ProteinDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Curation state
  const [curatorName, setCuratorName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Structure viewer
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<$3Dmol.GLViewer | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  // Fetch protein data
  useEffect(() => {
    if (!proteinId) return;

    const fetchProtein = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/archaea/protein/${proteinId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Protein not found');
          }
          throw new Error('Failed to fetch protein');
        }

        const result: ProteinDetailResponse = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load protein');
      } finally {
        setLoading(false);
      }
    };

    fetchProtein();
  }, [proteinId]);

  // Initialize 3Dmol viewer
  const initViewer = useCallback(async () => {
    if (!viewerRef.current || !data?.protein.has_structure) return;

    setStructureLoading(true);
    setStructureError(null);

    try {
      // Dynamically load 3Dmol
      if (!$3Dmol) {
        $3Dmol = await import('3dmol');
      }

      // Clean up existing viewer
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.clear();
      }

      // Create viewer
      const viewer = $3Dmol.createViewer(viewerRef.current, {
        backgroundColor: 'white',
      });
      viewerInstanceRef.current = viewer;

      // Fetch structure
      const structureResponse = await fetch(`/api/archaea/structure/${proteinId}`);
      if (!structureResponse.ok) {
        throw new Error('Failed to load structure');
      }

      const structureContent = await structureResponse.text();

      // Add model (CIF format)
      viewer.addModel(structureContent, 'cif');

      // Style by pLDDT confidence (stored in B-factor for AF structures)
      viewer.setStyle({}, {
        cartoon: {
          colorfunc: (atom: { b: number }) => {
            const plddt = atom.b;
            if (plddt >= 90) return 'blue';
            if (plddt >= 70) return 'cyan';
            if (plddt >= 50) return 'yellow';
            return 'orange';
          },
        },
      });

      viewer.zoomTo();
      viewer.render();

    } catch (err) {
      setStructureError(err instanceof Error ? err.message : 'Failed to load structure');
    } finally {
      setStructureLoading(false);
    }
  }, [data?.protein.has_structure, proteinId]);

  // Initialize viewer when data loads
  useEffect(() => {
    if (data?.protein.has_structure) {
      initViewer();
    }

    return () => {
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.clear();
        viewerInstanceRef.current = null;
      }
    };
  }, [data?.protein.has_structure, initViewer]);

  // Handle curation decision
  const handleCurationDecision = async (decisionType: ArchaeaCurationDecision['decision_type']) => {
    if (!curatorName.trim()) {
      setSubmitError('Please enter your name');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const decision: ArchaeaCurationDecision = {
        protein_id: proteinId,
        curator: curatorName.trim(),
        decision_type: decisionType,
        is_novel_fold: decisionType === 'flag_novel',
        notes: notes.trim() || undefined,
      };

      const response = await fetch('/api/archaea/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit decision');
      }

      // Navigate to next protein or back to queue
      if (result.next_protein) {
        router.push(`/archaea/protein/${result.next_protein}`);
      } else {
        router.push('/archaea/queue');
      }

    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-medium text-lg">Error</h2>
          <p className="text-red-600 mt-2">{error || 'Failed to load protein'}</p>
          <Link
            href="/archaea/queue"
            className="mt-4 inline-block text-red-700 hover:text-red-900 font-medium"
          >
            ← Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  const protein = data.protein;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{protein.protein_id}</h1>
          <div className="flex items-center gap-3 mt-1">
            {protein.uniprot_acc && (
              <a
                href={`https://www.uniprot.org/uniprotkb/${protein.uniprot_acc}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                UniProt: {protein.uniprot_acc}
              </a>
            )}
            <span className="text-gray-500">|</span>
            <span className="text-gray-600">{protein.sequence_length} residues</span>
            {protein.novelty_category && (
              <>
                <span className="text-gray-500">|</span>
                <NoveltyBadge category={protein.novelty_category} />
              </>
            )}
          </div>
        </div>
        <Link
          href="/archaea/queue"
          className="text-green-600 hover:text-green-800 font-medium"
        >
          ← Back to Queue
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Info */}
        <div className="space-y-6">
          {/* Taxonomy */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Taxonomy</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Class</dt>
                <dd className="text-gray-900">{protein.class_name || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Phylum</dt>
                <dd className="text-gray-900">{protein.phylum || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Organism</dt>
                <dd className="text-gray-900 text-right max-w-[200px] truncate" title={protein.organism_name || ''}>
                  {protein.organism_name || '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Source</dt>
                <dd className="text-gray-900">{protein.source}</dd>
              </div>
            </dl>
          </div>

          {/* Quality Metrics */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Structure Quality</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Mean pLDDT</dt>
                <dd className={`font-medium ${getPlddtColor(protein.mean_plddt)}`}>
                  {protein.mean_plddt?.toFixed(1) || '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">pTM</dt>
                <dd className="text-gray-900">{protein.ptm?.toFixed(3) || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Quality Score</dt>
                <dd className="text-gray-900">{protein.quality_score?.toFixed(2) || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Quality Category</dt>
                <dd className="text-gray-900">{protein.af3_quality_category || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Disordered</dt>
                <dd className="text-gray-900">
                  {protein.fraction_disordered ? `${(protein.fraction_disordered * 100).toFixed(1)}%` : '-'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Secondary Structure */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Secondary Structure</h3>
            <div className="space-y-2">
              <SSBar label="Helix" fraction={protein.helix_fraction} color="bg-red-500" />
              <SSBar label="Sheet" fraction={protein.sheet_fraction} color="bg-blue-500" />
              <SSBar label="Coil" fraction={protein.coil_fraction} color="bg-gray-400" />
            </div>
            {protein.ss_category && (
              <p className="mt-3 text-sm text-gray-600">
                Category: <span className="font-medium">{protein.ss_category}</span>
              </p>
            )}
          </div>
        </div>

        {/* Center Column - Structure Viewer */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden sticky top-6">
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Structure</h3>
              <p className="text-xs text-gray-500 mt-1">
                Colored by pLDDT: <span className="text-blue-600">blue=90+</span>,{' '}
                <span className="text-cyan-600">cyan=70-90</span>,{' '}
                <span className="text-yellow-600">yellow=50-70</span>,{' '}
                <span className="text-orange-600">orange=&lt;50</span>
              </p>
            </div>
            <div
              ref={viewerRef}
              className="w-full h-[400px] relative"
            >
              {structureLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <span className="text-gray-500">Loading structure...</span>
                </div>
              )}
              {structureError && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                  <span className="text-red-600">{structureError}</span>
                </div>
              )}
              {!protein.has_structure && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <span className="text-gray-500">No structure available</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Curation */}
        <div className="space-y-6">
          {/* Curation Status */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Curation Status</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <StatusBadge status={protein.curation_status || 'pending'} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Priority</dt>
                <dd className="text-gray-900">{protein.priority_rank || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Novel Fold?</dt>
                <dd className="text-gray-900">
                  {protein.is_novel_fold === true ? 'Yes' : protein.is_novel_fold === false ? 'No' : '-'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Cluster Info */}
          {protein.structural_cluster_id && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Structural Cluster</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Cluster Size</dt>
                  <dd className="text-gray-900">{protein.actual_cluster_size || protein.structural_cluster_size || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Representative</dt>
                  <dd className="text-gray-900">
                    {protein.is_representative ? 'Yes' : 'No'}
                  </dd>
                </div>
              </dl>
              {data.cluster_members && data.cluster_members.length > 1 && (
                <details className="mt-3">
                  <summary className="text-sm text-green-600 cursor-pointer hover:text-green-800">
                    View {data.cluster_members.length} cluster members
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {data.cluster_members.map(member => (
                      <li key={member.protein_id} className="text-xs">
                        <Link
                          href={`/archaea/protein/${member.protein_id}`}
                          className={`hover:text-green-600 ${member.protein_id === proteinId ? 'font-bold' : ''}`}
                        >
                          {member.protein_id}
                          {member.is_representative && ' (rep)'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Curation Controls */}
          {protein.curation_status === 'pending' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Curation Decision</h3>

              {/* Curator Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Curator Name
                </label>
                <input
                  type="text"
                  value={curatorName}
                  onChange={(e) => setCuratorName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Your name"
                />
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Any observations..."
                />
              </div>

              {/* Error */}
              {submitError && (
                <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                  {submitError}
                </div>
              )}

              {/* Decision Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCurationDecision('approve')}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleCurationDecision('flag_novel')}
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Flag Novel
                </button>
                <button
                  onClick={() => handleCurationDecision('defer')}
                  disabled={submitting}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Defer
                </button>
                <button
                  onClick={() => handleCurationDecision('skip')}
                  disabled={submitting}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sequence */}
      {protein.sequence && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Sequence</h3>
          <div className="font-mono text-xs text-gray-700 break-all whitespace-pre-wrap bg-gray-50 p-3 rounded max-h-48 overflow-y-auto">
            {protein.sequence}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
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

function SSBar({ label, fraction, color }: { label: string; fraction: number | null; color: string }) {
  const pct = fraction ? (fraction * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-12">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-12 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function getPlddtColor(plddt: number | null): string {
  if (plddt === null) return 'text-gray-600';
  if (plddt >= 90) return 'text-blue-600';
  if (plddt >= 70) return 'text-cyan-600';
  if (plddt >= 50) return 'text-yellow-600';
  return 'text-orange-600';
}
