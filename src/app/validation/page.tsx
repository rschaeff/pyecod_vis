'use client';

/**
 * ECOD Representative Validation Page
 *
 * Displays sequence/structure similarity violations across ECOD boundaries
 * Shows cross-H-group and cross-F-group pairs with high identity
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Virtuoso } from 'react-virtuoso';

interface ValidationIssue {
  id: number;
  domain1_ecod_id: string;
  domain2_ecod_id: string;
  domain1_ecod_uid: number;
  domain2_ecod_uid: number;
  domain1_f_id: string;
  domain2_f_id: string;
  domain1_h_id: string;
  domain2_h_id: string;
  domain1_x_id: string;
  domain2_x_id: string;
  x1_name: string | null;
  x2_name: string | null;
  pfam_acc: string | null;
  sequence_identity: number;
  alignment_length: number;
  evalue: number;
  boundary_type: string;
  severity: string;
  recommendation: string | null;
  status: string;
  curator_notes: string | null;
  domain1_type: string;
  domain2_type: string;
  pair_type: string;
  domain1_manual_rep: boolean | null;
  domain1_provisional_rep: boolean | null;
  domain2_manual_rep: boolean | null;
  domain2_provisional_rep: boolean | null;
  domain1_nonrep_count: number;
  domain2_nonrep_count: number;
  query_length: number | null;
  target_length: number | null;
  query_coverage: number | null;
  target_coverage: number | null;
  query_aligned: string | null;
  target_aligned: string | null;
  domain1_range: string | null;
  domain2_range: string | null;
  f1_name: string | null;
  f2_name: string | null;
  f1_pfam: string | null;
  f2_pfam: string | null;
  h1_name: string | null;
  h2_name: string | null;
  // Curation fields
  curation_id: number | null;
  curation_status: string | null;
  curation_action: string | null;
  curation_notes: string | null;
  curation_priority: number | null;
  curated_at: string | null;
  curation_updated_at: string | null;
  curator_id: number | null;
  curator_username: string | null;
  curator_display_name: string | null;
}

interface ValidationStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  cross_x: number;
  cross_h: number;
  cross_f: number;
  pdb_pdb: number;
  afdb_afdb: number;
  pdb_afdb: number;
  pending: number;
  reviewed: number;
  uncurated: number;
  curated: number;
  curated_flagged: number;
  curated_dismissed: number;
  curated_action_planned: number;
}

// Curation Panel Component
function CurationPanel({
  issue,
  expanded,
  onToggle,
  onSave,
}: {
  issue: ValidationIssue;
  expanded: boolean;
  onToggle: () => void;
  onSave: (issue: ValidationIssue, data: { status: string; action: string; notes: string; priority: number }) => Promise<void>;
}) {
  const [status, setStatus] = useState(issue.curation_status || 'flagged');
  const [action, setAction] = useState(issue.curation_action || '');
  const [notes, setNotes] = useState(issue.curation_notes || '');
  const [priority, setPriority] = useState(issue.curation_priority || 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(issue, { status, action, notes, priority });
    } finally {
      setSaving(false);
    }
  };

  const getCurationStatusColor = (status: string | null) => {
    switch (status) {
      case 'flagged': return 'bg-red-100 text-red-800';
      case 'false_positive': return 'bg-gray-100 text-gray-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'reviewed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="mt-3 border-t pt-3">
      <button
        onClick={onToggle}
        className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>{issue.curation_status ? 'Curation Info' : 'Add Curation'}</span>
        {issue.curation_status && (
          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getCurationStatusColor(issue.curation_status)}`}>
            {issue.curation_status.replace(/_/g, ' ').toUpperCase()}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 bg-purple-50 p-2 rounded border border-purple-200">
          {issue.curation_status ? (
            // Read-only view for curated issues
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">Status:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCurationStatusColor(issue.curation_status)}`}>
                  {issue.curation_status.replace(/_/g, ' ').toUpperCase()}
                </span>
                {issue.curation_action && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span className="font-medium">Action:</span>
                    <span>{issue.curation_action.replace(/_/g, ' ')}</span>
                  </>
                )}
              </div>
              {issue.curation_notes && (
                <div>
                  <span className="font-medium">Notes:</span>
                  <div className="mt-1 bg-white p-1.5 rounded border text-gray-700 text-xs">{issue.curation_notes}</div>
                </div>
              )}
              {issue.curator_display_name && (
                <div className="text-xs text-gray-600 pt-1 border-t border-purple-200">
                  Curated by {issue.curator_display_name}
                  {issue.curated_at && ` on ${new Date(issue.curated_at).toLocaleDateString()}`}
                </div>
              )}
            </div>
          ) : (
            // Edit form for uncurated issues
            <div className="flex gap-2 items-end">
              <div className="w-32">
                <label className="block text-xs font-medium text-gray-700 mb-1">Status *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="flagged">Flagged</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="false_positive">False Pos</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="w-40">
                <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">No Action</option>
                  <option value="merge_hgroups">Merge H</option>
                  <option value="split_hgroup">Split H</option>
                  <option value="reclassify_domain1">Reclassify D1</option>
                  <option value="reclassify_domain2">Reclassify D2</option>
                  <option value="reclassify_both">Reclassify Both</option>
                  <option value="investigate_structure">Investigate</option>
                  <option value="check_alignment">Check Align</option>
                  <option value="false_positive">False Pos</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  placeholder="Add notes..."
                />
              </div>

              <div className="w-24">
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="0">Normal</option>
                  <option value="1">Low</option>
                  <option value="2">Med</option>
                  <option value="3">High</option>
                  <option value="4">V.High</option>
                  <option value="5">Crit</option>
                </select>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={onToggle}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ValidationPage() {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState('all');
  const [boundaryType, setBoundaryType] = useState('all');
  const [pairType, setPairType] = useState('all');
  const [coverageFilter, setCoverageFilter] = useState('all');
  const [curationStatus, setCurationStatus] = useState('uncurated');
  const [sortBy, setSortBy] = useState('default');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedAlignments, setExpandedAlignments] = useState<Set<number>>(new Set());
  const [expandedCuration, setExpandedCuration] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchIssues();
  }, [severity, boundaryType, pairType, coverageFilter, curationStatus, sortBy, page, pageSize]);

  // Auto-expand first issue's curation panel
  useEffect(() => {
    if (issues.length > 0 && !loading) {
      setExpandedCuration(new Set([issues[0].id]));
    }
  }, [issues, loading]);

  const fetchIssues = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (severity !== 'all') params.append('severity', severity);
      if (boundaryType !== 'all') params.append('boundary_type', boundaryType);
      if (pairType !== 'all') params.append('pair_type', pairType);
      if (coverageFilter !== 'all') params.append('coverage_filter', coverageFilter);
      if (curationStatus !== 'all') params.append('curation_status', curationStatus);
      if (sortBy !== 'default') params.append('sort_by', sortBy);
      params.append('page', String(page));
      params.append('page_size', String(pageSize));

      const response = await fetch(`/api/validation?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setIssues(data.issues);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load validation issues');
      console.error('Error fetching validation issues:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getBoundaryColor = (type: string) => {
    switch (type) {
      case 'cross_x': return 'bg-red-100 text-red-800';
      case 'cross_h': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getBoundaryLabel = (type: string) => {
    switch (type) {
      case 'cross_x': return 'Cross X-group (Architecture)';
      case 'cross_h': return 'Cross H-group (Homology)';
      case 'cross_f': return 'Cross F-group (Family)';
      default: return type;
    }
  };

  const getRepType = (manualRep: boolean | null, provisionalRep: boolean | null) => {
    if (manualRep && !provisionalRep) {
      return { label: 'Manual', color: 'bg-emerald-100 text-emerald-800' };
    } else if (provisionalRep) {
      return { label: 'Provisional', color: 'bg-violet-100 text-violet-800' };
    }
    return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  };

  const toggleAlignment = (issueId: number) => {
    const newExpanded = new Set(expandedAlignments);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedAlignments(newExpanded);
  };

  const toggleCuration = (issueId: number) => {
    const newExpanded = new Set(expandedCuration);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedCuration(newExpanded);
  };

  const handleCurationSave = async (issue: ValidationIssue, curationData: {
    status: string;
    action: string;
    notes: string;
    priority: number;
  }) => {
    try {
      const response = await fetch('/api/validation/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain1_uid: issue.domain1_ecod_uid,
          domain2_uid: issue.domain2_ecod_uid,
          issue_type: 'cross_boundary',
          status: curationData.status,
          action: curationData.action || null,
          notes: curationData.notes || null,
          priority: curationData.priority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save curation');
      }

      // Refresh issues after successful save
      await fetchIssues();

      // Close the curation panel
      const newExpanded = new Set(expandedCuration);
      newExpanded.delete(issue.id);
      setExpandedCuration(newExpanded);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save curation');
      console.error('Error saving curation:', err);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">ECOD Representative Validation</h1>
        <p className="text-sm text-gray-600 mb-3">
          High sequence identity across ECOD boundaries - potential classification issues
        </p>

        {/* Severity Criteria */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
          <div className="font-semibold text-blue-900 mb-1">Severity Criteria:</div>
          <div className="grid md:grid-cols-2 gap-1 text-blue-800">
            <div><span className="font-medium">Critical:</span> &gt;90% identity across X-groups</div>
            <div><span className="font-medium">High:</span> 70-90% X-groups, or &gt;90% H-groups</div>
            <div><span className="font-medium">Medium:</span> 50-70% X-groups, or 70-90% H-groups</div>
            <div><span className="font-medium">Low:</span> &lt;50% identity or within H-group</div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-3">
          <div className="bg-white p-2 rounded border">
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          <div className="bg-red-50 p-2 rounded border border-red-200">
            <div className="text-lg font-bold text-red-700">{Number(stats.critical) + Number(stats.high)}</div>
            <div className="text-xs text-red-600">Crit/High</div>
          </div>
          <div className="bg-red-50 p-2 rounded border border-red-200">
            <div className="text-lg font-bold text-red-700">{stats.cross_x}</div>
            <div className="text-xs text-red-600">X-group</div>
          </div>
          <div className="bg-purple-50 p-2 rounded border border-purple-200">
            <div className="text-lg font-bold text-purple-700">{stats.cross_h}</div>
            <div className="text-xs text-purple-600">H-group</div>
          </div>
          <div className="bg-blue-50 p-2 rounded border border-blue-200">
            <div className="text-lg font-bold text-blue-700">{stats.cross_f}</div>
            <div className="text-xs text-blue-600">F-group</div>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">
            <div className="text-lg font-bold text-slate-700">{stats.pdb_pdb}</div>
            <div className="text-xs text-slate-600">PDB-PDB</div>
          </div>
          <div className="bg-amber-50 p-2 rounded border border-amber-200">
            <div className="text-lg font-bold text-amber-700">{stats.afdb_afdb}</div>
            <div className="text-xs text-amber-600">AFDB-AFDB</div>
          </div>
          <div className="bg-teal-50 p-2 rounded border border-teal-200">
            <div className="text-lg font-bold text-teal-700">{stats.pdb_afdb}</div>
            <div className="text-xs text-teal-600">Mixed</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-3 rounded border mb-3">
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Boundary Type</label>
            <select
              value={boundaryType}
              onChange={(e) => { setBoundaryType(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All</option>
              <option value="cross_x">Cross X-group (Architecture)</option>
              <option value="cross_h">Cross H-group (Homology)</option>
              <option value="cross_f">Cross F-group (Family)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Structure Pair Type</label>
            <select
              value={pairType}
              onChange={(e) => { setPairType(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All</option>
              <option value="pdb_pdb">PDB-PDB</option>
              <option value="afdb_afdb">AFDB-AFDB</option>
              <option value="pdb_afdb">PDB-AFDB (mixed)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Filter</label>
            <select
              value={coverageFilter}
              onChange={(e) => { setCoverageFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Coverage</option>
              <option value="both_high">Both &gt;80%</option>
              <option value="either_high">Either &gt;80%</option>
              <option value="low_coverage">Low Coverage (&lt;80%)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="default">Default (Severity + Identity)</option>
              <option value="total_nonreps">Total Nonreps Affected</option>
              <option value="alignment_length">Alignment Length</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Curation Status</label>
            <select
              value={curationStatus}
              onChange={(e) => { setCurationStatus(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="uncurated">Uncurated Only</option>
              <option value="all">All Issues</option>
              <option value="curated">Curated Only</option>
              <option value="flagged">Flagged</option>
              <option value="reviewed">Reviewed</option>
              <option value="false_positive">False Positive</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading validation issues...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error: {error}
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
          No validation issues found with the selected filters.
        </div>
      )}

      {!loading && !error && issues.length > 0 && (
        <Virtuoso
          style={{ height: '1200px' }}
          data={issues}
          itemContent={(index, issue) => (
            <div className="mb-4">
              <div className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(issue.severity)}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBoundaryColor(issue.boundary_type)}`}>
                      {getBoundaryLabel(issue.boundary_type)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{Number(issue.sequence_identity).toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">seq identity</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-3">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex gap-3">
                      <a href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${issue.domain1_ecod_id}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <img
                          src={`http://prodata.swmed.edu/ecod/af2_pdb_d/${String(issue.domain1_ecod_uid).padStart(9, '0')}/${String(issue.domain1_ecod_uid).padStart(9, '0')}_thumb.png`}
                          alt={issue.domain1_ecod_id}
                          className="w-24 h-24 object-contain rounded border border-gray-300"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </a>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <a href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${issue.domain1_ecod_id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                            {issue.domain1_ecod_id}
                          </a>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${issue.domain1_type === 'experimental structure' ? 'bg-slate-200 text-slate-700' : 'bg-amber-200 text-amber-700'}`}>
                        {issue.domain1_type === 'experimental structure' ? 'PDB' : 'AFDB'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRepType(issue.domain1_manual_rep, issue.domain1_provisional_rep).color}`}>
                        {getRepType(issue.domain1_manual_rep, issue.domain1_provisional_rep).label}
                      </span>
                      {issue.f1_pfam && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {issue.f1_pfam}
                        </span>
                      )}
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div><span className="font-medium">X-group:</span> {issue.domain1_x_id} {issue.x1_name && `(${issue.x1_name})`}</div>
                          <div><span className="font-medium">H-group:</span> {issue.domain1_h_id} {issue.h1_name && `(${issue.h1_name})`}</div>
                          <div><span className="font-medium">F-group:</span> {issue.domain1_f_id} {issue.f1_name && `(${issue.f1_name})`}</div>
                          {issue.domain1_range && <div><span className="font-medium">Range:</span> {issue.domain1_range}</div>}
                          {issue.query_length && issue.query_coverage !== null && (
                            <div>
                              <span className="font-medium">Coverage:</span>{' '}
                              <span className={Number(issue.query_coverage) < 80 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                                {Number(issue.query_coverage).toFixed(1)}%
                              </span>
                              {' '}({issue.alignment_length}/{issue.query_length} residues)
                            </div>
                          )}
                          <div className="text-orange-700 font-medium">
                            <span className="font-medium">Nonreps:</span> {issue.domain1_nonrep_count.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex gap-3">
                      <a href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${issue.domain2_ecod_id}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <img
                          src={`http://prodata.swmed.edu/ecod/af2_pdb_d/${String(issue.domain2_ecod_uid).padStart(9, '0')}/${String(issue.domain2_ecod_uid).padStart(9, '0')}_thumb.png`}
                          alt={issue.domain2_ecod_id}
                          className="w-24 h-24 object-contain rounded border border-gray-300"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </a>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <a href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${issue.domain2_ecod_id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                            {issue.domain2_ecod_id}
                          </a>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${issue.domain2_type === 'experimental structure' ? 'bg-slate-200 text-slate-700' : 'bg-amber-200 text-amber-700'}`}>
                        {issue.domain2_type === 'experimental structure' ? 'PDB' : 'AFDB'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRepType(issue.domain2_manual_rep, issue.domain2_provisional_rep).color}`}>
                        {getRepType(issue.domain2_manual_rep, issue.domain2_provisional_rep).label}
                      </span>
                      {issue.f2_pfam && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {issue.f2_pfam}
                        </span>
                      )}
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div><span className="font-medium">X-group:</span> {issue.domain2_x_id} {issue.x2_name && `(${issue.x2_name})`}</div>
                          <div><span className="font-medium">H-group:</span> {issue.domain2_h_id} {issue.h2_name && `(${issue.h2_name})`}</div>
                          <div><span className="font-medium">F-group:</span> {issue.domain2_f_id} {issue.f2_name && `(${issue.f2_name})`}</div>
                          {issue.domain2_range && <div><span className="font-medium">Range:</span> {issue.domain2_range}</div>}
                          {issue.target_length && issue.target_coverage !== null && (
                            <div>
                              <span className="font-medium">Coverage:</span>{' '}
                              <span className={Number(issue.target_coverage) < 80 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                                {Number(issue.target_coverage).toFixed(1)}%
                              </span>
                              {' '}({issue.alignment_length}/{issue.target_length} residues)
                            </div>
                          )}
                          <div className="text-orange-700 font-medium">
                            <span className="font-medium">Nonreps:</span> {issue.domain2_nonrep_count.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alignment Viewer */}
                {issue.query_aligned && issue.target_aligned && (
                  <div className="mt-3 border-t pt-3">
                    <button
                      onClick={() => toggleAlignment(issue.id)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <span>{expandedAlignments.has(issue.id) ? '▼' : '▶'}</span>
                      <span>{expandedAlignments.has(issue.id) ? 'Hide' : 'Show'} Sequence Alignment</span>
                    </button>

                    {expandedAlignments.has(issue.id) && (
                      <div className="mt-2 bg-gray-50 p-3 rounded font-mono text-xs overflow-x-auto">
                        <div className="mb-1 text-gray-600 font-sans">
                          Query ({issue.domain1_ecod_id}):
                        </div>
                        <div className="mb-2 break-all whitespace-pre-wrap">{issue.query_aligned}</div>

                        <div className="mb-1 text-gray-600 font-sans">
                          Match:
                        </div>
                        <div className="mb-2 break-all whitespace-pre-wrap text-green-700">
                          {issue.query_aligned.split('').map((q, i) =>
                            q === issue.target_aligned[i] ? '|' : ' '
                          ).join('')}
                        </div>

                        <div className="mb-1 text-gray-600 font-sans">
                          Target ({issue.domain2_ecod_id}):
                        </div>
                        <div className="break-all whitespace-pre-wrap">{issue.target_aligned}</div>

                        <div className="mt-3 text-gray-600 font-sans text-xs">
                          {(() => {
                            const matches = issue.query_aligned.split('').filter((q, i) => q === issue.target_aligned[i]).length;
                            const identity = (matches / issue.alignment_length * 100).toFixed(1);
                            return `Identical residues: ${matches}/${issue.alignment_length} (${identity}%)`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Curation Panel */}
                <CurationPanel
                  issue={issue}
                  expanded={expandedCuration.has(issue.id)}
                  onToggle={() => toggleCuration(issue.id)}
                  onSave={handleCurationSave}
                />

                <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t">
                  <div>
                    Alignment: {issue.alignment_length} residues | E-value: {Number(issue.evalue).toExponential(2)}
                  </div>
                  {issue.recommendation && (
                    <div className="text-orange-600 font-medium">
                      {issue.recommendation.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        />
      )}

      {!loading && !error && issues.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, stats?.total || 0)} of {stats?.total || 0} total issues
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-gray-50">
                Page {page} of {Math.ceil((stats?.total || 0) / pageSize)}
              </div>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil((stats?.total || 0) / pageSize)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
