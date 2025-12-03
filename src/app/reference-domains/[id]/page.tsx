'use client';

/**
 * Reference Domain Detail View
 *
 * Full detail view for a problematic ECOD reference domain including:
 * - 3D structure visualization
 * - Classification hierarchy
 * - Usage statistics
 * - Attracted Pfam families
 * - Curation actions
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Classification {
  x_group: { id: string; name: string | null };
  h_group: { id: string; name: string | null };
  t_group: { id: string; name: string | null };
  f_group: { id: string | null; name: string | null; pfam: string | null };
}

interface RepresentativeStatus {
  is_manual_rep: boolean;
  is_f_rep: boolean;
  is_t_rep: boolean;
  is_h_rep: boolean;
}

interface UsageStats {
  total_swissprot_uses: number;
  by_judge: {
    good_domain: number;
    low_confidence: number;
    simple_topology: number;
    partial_domain: number;
  };
  avg_dpam_prob: number;
  avg_hh_prob: number;
  dpam_prob_distribution: {
    '0.7-0.8': number;
    '0.8-0.9': number;
    '0.9-1.0': number;
  };
}

interface AttractedPfam {
  pfam_acc: string;
  pfam_name: string;
  expected_t_group: string | null;
  domain_count: number;
  avg_dpam: number;
}

interface ReferenceDomainDetail {
  ecod_domain_id: string;
  ecod_uid: string;
  pdb_id: string;
  chain: string;
  pdb_range: string;
  seqid_range: string;
  sequence: string;
  sequence_length: number;
  classification: Classification;
  representative_status: RepresentativeStatus;
  usage_stats: UsageStats;
  attracted_pfams: AttractedPfam[];
  family_context: {
    f_group_size: number;
    t_group_size: number;
  };
  structure_url: string;
  cif_url: string;
}

export default function ReferenceDomainDetailPage() {
  const params = useParams();
  const domainId = params.id as string;

  const [domain, setDomain] = useState<ReferenceDomainDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Structure viewer state
  const [structureLoading, setStructureLoading] = useState(true);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(null);

  // Curation action state
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null);
  const [actionHistory, setActionHistory] = useState<Array<{
    id: number;
    action: string;
    reason: string;
    curator: string;
    created_at: string;
  }>>([]);

  const viewerRef = useCallback((element: HTMLDivElement | null) => {
    setViewerElement(element);
  }, []);

  useEffect(() => {
    if (!domainId) return;
    fetchDomainDetail();
    fetchActionHistory();
  }, [domainId]);

  const fetchActionHistory = async () => {
    try {
      const response = await fetch(`/api/curation/reference-domains/${domainId}/action`);
      if (response.ok) {
        const data = await response.json();
        setActionHistory(data.actions || []);
      }
    } catch (err) {
      console.error('Failed to fetch action history:', err);
    }
  };

  const submitAction = async (action: 'mask_from_search' | 'remove' | 'reclassify' | 'flag_review') => {
    if (!actionReason.trim()) {
      setActionMessage({ type: 'error', text: 'Please provide a reason for this action' });
      return;
    }

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/curation/reference-domains/${domainId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: actionReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit action');
      }

      setActionMessage({ type: 'success', text: data.message });
      setActionReason('');
      fetchActionHistory();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit action'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Parse domain range segments from seqid_range or pdb_range
  // Format examples: "A:274-560", "A:5-39,A:60-342", "B:1-24,A:1-97", "10-50,100-150"
  const parseDomainRanges = (rangeStr: string | null, defaultChain: string): { chain: string; start: number; end: number }[] => {
    if (!rangeStr) return [];

    const segments: { chain: string; start: number; end: number }[] = [];
    const parts = rangeStr.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      // Check if segment has chain prefix (e.g., "A:274-560")
      const colonIdx = trimmed.indexOf(':');
      let chain = defaultChain;
      let rangeOnly = trimmed;

      if (colonIdx !== -1) {
        chain = trimmed.substring(0, colonIdx);
        rangeOnly = trimmed.substring(colonIdx + 1);
      }

      const match = rangeOnly.match(/(\d+)-(\d+)/);
      if (match) {
        segments.push({
          chain,
          start: parseInt(match[1]),
          end: parseInt(match[2])
        });
      }
    }
    return segments;
  };

  // Initialize structure viewer
  useEffect(() => {
    if (!viewerElement || !domain) return;

    let isMounted = true;
    const pdbId = domain.pdb_id;
    const chainId = domain.chain;

    // Parse domain range segments from seqid_range or pdb_range
    const domainSegments = parseDomainRanges(domain.seqid_range || domain.pdb_range, chainId);

    async function loadStructure() {
      try {
        // @ts-ignore
        const module = await import('3dmol/build/3Dmol.js');
        const $3Dmol = (module as any).default || module;

        if (!isMounted) return;

        // Fetch structure from RCSB
        const response = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
        if (!response.ok) throw new Error('Failed to load structure');

        const pdbData = await response.text();
        if (!isMounted || !viewerElement) return;

        const viewer = $3Dmol.createViewer(viewerElement, {
          backgroundColor: 'white',
        });

        viewer.addModel(pdbData, 'pdb');

        // Style the whole structure in transparent gray
        viewer.setStyle({}, { cartoon: { color: 'gray', opacity: 0.3 } });

        // Style the primary chain in gray (more opaque)
        viewer.setStyle(
          { chain: chainId },
          { cartoon: { color: 'gray', opacity: 0.8 } }
        );

        // Highlight each domain segment in red
        if (domainSegments.length > 0) {
          for (const seg of domainSegments) {
            viewer.setStyle(
              { chain: seg.chain, resi: `${seg.start}-${seg.end}` },
              { cartoon: { color: 'red' } }
            );
          }
          // Zoom to all domain segments
          const allSelections = domainSegments.map(seg => ({
            chain: seg.chain,
            resi: `${seg.start}-${seg.end}`
          }));
          viewer.zoomTo(allSelections[0]); // Zoom to first segment
        } else {
          // No range info - show whole chain in red as fallback
          viewer.setStyle(
            { chain: chainId },
            { cartoon: { color: 'red' } }
          );
          viewer.zoomTo({ chain: chainId });
        }

        viewer.render();
        setStructureLoading(false);
      } catch (err) {
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
  }, [viewerElement, domain]);

  const fetchDomainDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/curation/reference-domains/${domainId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Reference domain not found');
        throw new Error('Failed to fetch domain details');
      }

      const data = await response.json();
      setDomain(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domain');
    } finally {
      setLoading(false);
    }
  };

  const getJudgeBar = (stats: UsageStats) => {
    const total = stats.total_swissprot_uses;
    if (total === 0) return null;

    const segments = [
      { key: 'good_domain', count: stats.by_judge.good_domain, color: 'bg-green-500', label: 'Good' },
      { key: 'low_confidence', count: stats.by_judge.low_confidence, color: 'bg-red-500', label: 'Low Conf' },
      { key: 'simple_topology', count: stats.by_judge.simple_topology, color: 'bg-yellow-400', label: 'Simple' },
      { key: 'partial_domain', count: stats.by_judge.partial_domain, color: 'bg-gray-400', label: 'Partial' },
    ];

    return (
      <div className="space-y-2">
        <div className="flex h-6 rounded-full overflow-hidden">
          {segments.map(seg => {
            const width = (seg.count / total) * 100;
            if (width < 1) return null;
            return (
              <div
                key={seg.key}
                className={`${seg.color}`}
                style={{ width: `${width}%` }}
                title={`${seg.label}: ${seg.count}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {segments.map(seg => (
            <div key={seg.key} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded ${seg.color}`}></span>
              <span>{seg.label}: {seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading domain...</span>
      </div>
    );
  }

  if (error || !domain) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          {error || 'Domain not found'}
        </div>
        <Link href="/problematic-hgroups" className="mt-4 inline-block text-blue-600 hover:underline">
          &larr; Back to H-Groups
        </Link>
      </div>
    );
  }

  const lowConfRate = domain.usage_stats.total_swissprot_uses > 0
    ? (domain.usage_stats.by_judge.low_confidence / domain.usage_stats.total_swissprot_uses)
    : 0;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/problematic-hgroups/${domain.classification.h_group.id}`}
          className="text-blue-600 hover:underline text-sm mb-2 inline-block"
        >
          &larr; Back to H-Group {domain.classification.h_group.id}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{domain.ecod_domain_id}</h1>
        <div className="flex items-center gap-3 mt-2">
          <a
            href={`https://www.rcsb.org/structure/${domain.pdb_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            PDB: {domain.pdb_id}
          </a>
          <span className="text-gray-400">|</span>
          <span>Chain: {domain.chain}</span>
          <span className="text-gray-400">|</span>
          <span>Range: {domain.pdb_range}</span>
          <span className="text-gray-400">|</span>
          <span>{domain.sequence_length} aa</span>
        </div>

        {/* Representative badges */}
        <div className="flex gap-2 mt-2">
          {domain.representative_status.is_manual_rep && (
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">Manual Representative</span>
          )}
          {domain.representative_status.is_f_rep && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">F-group Representative</span>
          )}
          {domain.representative_status.is_t_rep && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">T-group Representative</span>
          )}
          {domain.representative_status.is_h_rep && (
            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm">H-group Representative</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Structure and Classification */}
        <div className="space-y-6">
          {/* Structure Viewer */}
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">3D Structure</h2>
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
              {structureError && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <div className="text-center text-gray-600">
                    <div className="text-4xl mb-3">🧬</div>
                    <div className="font-medium">{structureError}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t bg-gray-50 flex gap-3">
              <a
                href={domain.cif_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Download CIF
              </a>
              <a
                href={`https://www.rcsb.org/3d-view/${domain.pdb_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View in RCSB
              </a>
            </div>
          </div>

          {/* Classification */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">ECOD Classification</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-8 text-gray-400 font-medium">X:</span>
                <span className="font-mono">{domain.classification.x_group.id}</span>
                {domain.classification.x_group.name && (
                  <span className="text-gray-600">({domain.classification.x_group.name})</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 text-gray-400 font-medium">H:</span>
                <Link
                  href={`/problematic-hgroups/${domain.classification.h_group.id}`}
                  className="font-mono text-blue-600 hover:underline"
                >
                  {domain.classification.h_group.id}
                </Link>
                {domain.classification.h_group.name && (
                  <span className="text-gray-600">({domain.classification.h_group.name})</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 text-gray-400 font-medium">T:</span>
                <span className="font-mono">{domain.classification.t_group.id}</span>
                {domain.classification.t_group.name && (
                  <span className="text-gray-600">({domain.classification.t_group.name})</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 text-gray-400 font-medium">F:</span>
                <span className="font-mono">{domain.classification.f_group.id || '-'}</span>
                {domain.classification.f_group.name && (
                  <span className="text-gray-600">({domain.classification.f_group.name})</span>
                )}
                {domain.classification.f_group.pfam && (
                  <a
                    href={`https://www.ebi.ac.uk/interpro/entry/pfam/${domain.classification.f_group.pfam}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    [{domain.classification.f_group.pfam}]
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Family Context */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">Family Context</h2>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">F-group Size</dt>
                  <dd className="font-medium">{domain.family_context.f_group_size} domains</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">T-group Size</dt>
                  <dd className="font-medium">{domain.family_context.t_group_size} domains</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Right Column: Usage Stats and Attracted Pfams */}
        <div className="space-y-6">
          {/* Usage Statistics */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">Usage Statistics</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total SwissProt Uses:</span>
                <span className="text-2xl font-bold">{domain.usage_stats.total_swissprot_uses}</span>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">By Judge Category</h4>
                {getJudgeBar(domain.usage_stats)}
              </div>

              <div className="border-t pt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Avg DPAM Prob</dt>
                  <dd className="font-medium">{domain.usage_stats.avg_dpam_prob.toFixed(3)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Avg HH Prob</dt>
                  <dd className="font-medium">{domain.usage_stats.avg_hh_prob.toFixed(3)}</dd>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">DPAM Distribution</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>0.7 - 0.8:</span>
                    <span className="font-medium">{domain.usage_stats.dpam_prob_distribution['0.7-0.8']}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>0.8 - 0.9:</span>
                    <span className="font-medium">{domain.usage_stats.dpam_prob_distribution['0.8-0.9']}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>0.9 - 1.0:</span>
                    <span className="font-medium">{domain.usage_stats.dpam_prob_distribution['0.9-1.0']}</span>
                  </div>
                </div>
              </div>

              {/* Low-conf rate highlight */}
              <div className={`border-t pt-4 p-3 rounded-lg ${lowConfRate >= 0.5 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Low-Confidence Rate:</span>
                  <span className={`text-2xl font-bold ${lowConfRate >= 0.5 ? 'text-red-600' : 'text-gray-600'}`}>
                    {(lowConfRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Attracted Pfam Families */}
          {domain.attracted_pfams.length > 0 && (
            <div className="bg-white rounded-lg shadow border">
              <div className="px-4 py-3 border-b bg-orange-50">
                <h2 className="font-medium text-orange-800">
                  Incorrectly Attracted Pfam Families ({domain.attracted_pfams.length})
                </h2>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  This domain pulls in sequences from unrelated families:
                </p>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-gray-500 text-left">
                      <th className="py-2 pr-3">Pfam</th>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Expected T</th>
                      <th className="py-2 pr-3 text-right">Count</th>
                      <th className="py-2 text-right">Avg DPAM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {domain.attracted_pfams.map((ap) => (
                      <tr key={ap.pfam_acc}>
                        <td className="py-2 pr-3">
                          <a
                            href={`https://www.ebi.ac.uk/interpro/entry/pfam/${ap.pfam_acc}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono"
                          >
                            {ap.pfam_acc}
                          </a>
                        </td>
                        <td className="py-2 pr-3">{ap.pfam_name}</td>
                        <td className="py-2 pr-3 font-mono text-gray-500">
                          {ap.expected_t_group || '-'}
                        </td>
                        <td className="py-2 pr-3 text-right font-medium">{ap.domain_count}</td>
                        <td className="py-2 text-right">{ap.avg_dpam.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Curation Actions */}
          <div className="bg-white rounded-lg shadow border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium text-gray-900">Curation Actions</h2>
            </div>
            <div className="p-4">
              {actionMessage && (
                <div className={`mb-4 p-3 rounded ${
                  actionMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {actionMessage.text}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes *</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Describe the reason for this action..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  disabled={actionLoading}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => submitAction('mask_from_search')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-orange-100 text-orange-800 rounded hover:bg-orange-200 font-medium disabled:opacity-50"
                >
                  Mask from Search
                </button>
                <button
                  onClick={() => submitAction('remove')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium disabled:opacity-50"
                >
                  Remove from ECOD
                </button>
                <button
                  onClick={() => submitAction('flag_review')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 font-medium disabled:opacity-50"
                >
                  Flag for Review
                </button>
              </div>

              {actionLoading && (
                <div className="mt-3 text-sm text-gray-600">
                  Submitting action...
                </div>
              )}
            </div>
          </div>

          {/* Action History */}
          {actionHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow border">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-medium text-gray-900">Action History</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {actionHistory.map((action) => (
                  <div key={action.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          action.action === 'mask_from_search' ? 'bg-orange-100 text-orange-800' :
                          action.action === 'remove' ? 'bg-red-100 text-red-800' :
                          action.action === 'reclassify' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {action.action.replace(/_/g, ' ')}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">by {action.curator}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(action.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{action.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sequence Display */}
      {domain.sequence && (
        <div className="mt-6 bg-white rounded-lg shadow border">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-medium text-gray-900">Sequence ({domain.sequence_length} aa)</h2>
          </div>
          <div className="p-4">
            <div className="font-mono text-xs break-all bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
              {domain.sequence}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
