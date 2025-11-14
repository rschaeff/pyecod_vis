'use client';

/**
 * ECOD Clustering Inconsistency Validation Page
 *
 * Displays domains from the same sequence cluster but different T-groups
 * Used to identify potential classification errors from clustering analysis
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Virtuoso } from 'react-virtuoso';

interface ClusteringIssue {
  id: number;
  cluster_representative: string;
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
  domain1_t_id: string;
  domain2_t_id: string;
  x1_name: string | null;
  x2_name: string | null;
  boundary_type: string;
  severity: string;
  status: string;
  curator_notes: string | null;
  domain1_type: string;
  domain2_type: string;
  pair_type: string;
  domain1_manual_rep: boolean | null;
  domain1_provisional_rep: boolean | null;
  domain2_manual_rep: boolean | null;
  domain2_provisional_rep: boolean | null;
}

interface ClusteringStats {
  total: number;
  cross_x: number;
  cross_h: number;
  cross_f: number;
  pdb_pdb: number;
  afdb_afdb: number;
  pdb_afdb: number;
  pending: number;
  reviewed: number;
}

export default function ClusteringValidationPage() {
  const [issues, setIssues] = useState<ClusteringIssue[]>([]);
  const [stats, setStats] = useState<ClusteringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState('all');
  const [boundaryType, setBoundaryType] = useState('all');
  const [pairType, setPairType] = useState('all');
  const [repPairType, setRepPairType] = useState('exclude_auto_auto'); // Default: exclude auto-auto
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchIssues();
  }, [severity, boundaryType, pairType, repPairType, statusFilter, page, pageSize]);

  const fetchIssues = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (severity !== 'all') params.append('severity', severity);
      if (boundaryType !== 'all') params.append('boundary_type', boundaryType);
      if (pairType !== 'all') params.append('pair_type', pairType);
      if (repPairType !== 'all') params.append('rep_pair_type', repPairType);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('page', String(page));
      params.append('page_size', String(pageSize));

      const response = await fetch(`/api/clustering-validation?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setIssues(data.issues);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clustering issues');
      console.error('Error fetching clustering issues:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
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
    return { label: 'Automatic', color: 'bg-gray-100 text-gray-800' };
  };

  const toggleNotes = (issueId: number) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedNotes(newExpanded);
  };

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">ECOD Clustering Inconsistency Validation</h1>
          <Link href="/validation" className="text-sm text-blue-600 hover:text-blue-800 underline">
            → Representative Validation
          </Link>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Domains from same sequence cluster (50% identity, 80% coverage) but different T-groups
        </p>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
          <div className="font-semibold text-blue-900 mb-1">About This Data:</div>
          <div className="text-blue-800 space-y-1">
            <div>• Pairs extracted from AlphaFold Database + PDB clustering at 50% sequence identity</div>
            <div>• No alignment data available (unlike Representative Validation)</div>
            <div>• Includes non-representative domains (provisional/manual/automatic)</div>
            <div>• Severity based on boundary type only (cross_x = medium, cross_h/cross_f = low)</div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2 mb-3">
          <div className="bg-white p-2 rounded border">
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-xs text-gray-600">Total</div>
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
              <option value="medium">Medium (cross_x)</option>
              <option value="low">Low (cross_h/cross_f)</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Rep Pair Type</label>
            <select
              value={repPairType}
              onChange={(e) => { setRepPairType(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All</option>
              <option value="exclude_auto_auto">Exclude Auto-Auto</option>
              <option value="manual_manual">Manual-Manual</option>
              <option value="provisional_provisional">Provisional-Provisional</option>
              <option value="automatic_automatic">Automatic-Automatic</option>
              <option value="manual_provisional">Manual-Provisional</option>
              <option value="manual_automatic">Manual-Automatic</option>
              <option value="provisional_automatic">Provisional-Automatic</option>
              <option value="has_manual">Has Manual (either)</option>
              <option value="has_provisional">Has Provisional (either)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="flagged">Flagged</option>
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
          <p className="mt-4 text-gray-600">Loading clustering issues...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error: {error}
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
          No clustering issues found with the selected filters.
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
                    <div className="text-sm font-mono text-gray-600">Cluster:</div>
                    <div className="text-xs font-mono text-blue-600">{issue.cluster_representative}</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-3">
                  {/* Domain 1 */}
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
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div><span className="font-medium">X-group:</span> {issue.domain1_x_id} {issue.x1_name && `(${issue.x1_name})`}</div>
                          <div><span className="font-medium">H-group:</span> {issue.domain1_h_id}</div>
                          <div><span className="font-medium">F-group:</span> {issue.domain1_f_id}</div>
                          <div><span className="font-medium">T-group:</span> {issue.domain1_t_id}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Domain 2 */}
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
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div><span className="font-medium">X-group:</span> {issue.domain2_x_id} {issue.x2_name && `(${issue.x2_name})`}</div>
                          <div><span className="font-medium">H-group:</span> {issue.domain2_h_id}</div>
                          <div><span className="font-medium">F-group:</span> {issue.domain2_f_id}</div>
                          <div><span className="font-medium">T-group:</span> {issue.domain2_t_id}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes viewer (if exists) */}
                {issue.curator_notes && (
                  <div className="mt-3 border-t pt-3">
                    <button
                      onClick={() => toggleNotes(issue.id)}
                      className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                    >
                      <span>{expandedNotes.has(issue.id) ? '▼' : '▶'}</span>
                      <span>Curator Notes</span>
                    </button>

                    {expandedNotes.has(issue.id) && (
                      <div className="mt-2 bg-purple-50 p-2 rounded border border-purple-200 text-sm text-gray-700">
                        {issue.curator_notes}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t">
                  <div>
                    Status: <span className="font-medium">{issue.status}</span>
                  </div>
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
