'use client';

/**
 * H-Group Detail View
 *
 * Shows all reference domains in a problematic H-group with usage stats
 * and ability to drill down to individual domain analysis.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface TGroup {
  t_group_id: string;
  t_group_name: string | null;
  domain_count: number;
}

interface ReferenceDomain {
  ecod_domain_id: string;
  ecod_uid: string;
  pdb_id: string;
  chain: string;
  pdb_range: string;
  t_group: string;
  t_group_name: string | null;
  f_group: string | null;
  f_name: string | null;
  pfam_acc: string | null;
  is_manual_rep: boolean;
  is_f_rep: boolean;
  total_uses: number;
  low_conf_count: number;
  good_domain_count: number;
  low_conf_rate: number;
  avg_dpam_prob: number;
  avg_hh_prob: number;
  pfams_attracted: string[];
  pfam_names_attracted: string[];
}

interface HGroupDetail {
  h_group_id: string;
  h_group_name: string | null;
  hierarchy: {
    x_group: string;
    x_group_name: string | null;
  };
  t_groups: TGroup[];
  reference_domains: ReferenceDomain[];
  consistency_stats: {
    avg: number;
    stddev: number;
  };
  total_reps: number;
}

export default function HGroupDetailPage() {
  const params = useParams();
  const hGroupId = params.id as string;

  const [hgroup, setHgroup] = useState<HGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTGroup, setFilterTGroup] = useState<string>('all');

  useEffect(() => {
    if (!hGroupId) return;
    fetchHGroupDetail();
  }, [hGroupId]);

  const fetchHGroupDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/curation/problematic-hgroups/${hGroupId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('H-group not found');
        throw new Error('Failed to fetch H-group details');
      }

      const data = await response.json();
      setHgroup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load H-group');
    } finally {
      setLoading(false);
    }
  };

  const getUsageBar = (total: number, lowConf: number, maxTotal: number) => {
    const totalWidth = Math.min((total / maxTotal) * 100, 100);
    const lowConfWidth = (lowConf / total) * 100;

    return (
      <div className="w-48">
        <div className="bg-gray-200 rounded-full h-4 relative" style={{ width: `${totalWidth}%`, minWidth: '20px' }}>
          <div
            className="bg-red-500 h-4 rounded-l-full absolute left-0"
            style={{ width: `${lowConfWidth}%` }}
          />
          <div
            className="bg-green-500 h-4 rounded-r-full absolute right-0"
            style={{ width: `${100 - lowConfWidth}%`, left: `${lowConfWidth}%` }}
          />
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {total} uses ({(lowConfWidth).toFixed(0)}% low-conf)
        </div>
      </div>
    );
  };

  const filteredDomains = hgroup?.reference_domains.filter(rd =>
    filterTGroup === 'all' || rd.t_group === filterTGroup
  ) || [];

  const maxTotalUses = Math.max(...(hgroup?.reference_domains.map(rd => rd.total_uses) || [1]));

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading H-group...</span>
      </div>
    );
  }

  if (error || !hgroup) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          {error || 'H-group not found'}
        </div>
        <Link href="/problematic-hgroups" className="mt-4 inline-block text-blue-600 hover:underline">
          &larr; Back to H-Groups
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/problematic-hgroups" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          &larr; Back to Problematic H-Groups
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          H-Group: {hgroup.h_group_id}
          {hgroup.h_group_name && <span className="font-normal text-gray-600"> - {hgroup.h_group_name}</span>}
        </h1>
        <div className="text-gray-600 mt-1">
          Hierarchy: {hgroup.hierarchy.x_group}
          {hgroup.hierarchy.x_group_name && ` (${hgroup.hierarchy.x_group_name})`}
          {' > '}{hgroup.h_group_id}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-gray-900">{hgroup.total_reps}</div>
          <div className="text-sm text-gray-600">Reference Domains</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-blue-600">{hgroup.t_groups.length}</div>
          <div className="text-sm text-gray-600">T-Groups</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-orange-600">
            {(hgroup.consistency_stats.avg * 100).toFixed(0)}%
          </div>
          <div className="text-sm text-gray-600">Avg Consistency</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-red-600">
            {filteredDomains.filter(rd => rd.low_conf_rate >= 0.5).length}
          </div>
          <div className="text-sm text-gray-600">Problematic Refs (&ge;50%)</div>
        </div>
      </div>

      {/* T-Group Distribution */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">T-Group Distribution</h3>
        <div className="space-y-2">
          {hgroup.t_groups.slice(0, 5).map(tg => {
            const maxCount = Math.max(...hgroup.t_groups.map(t => t.domain_count));
            const width = (tg.domain_count / maxCount) * 100;
            return (
              <div key={tg.t_group_id} className="flex items-center gap-3">
                <div className="w-24 text-sm font-mono">{tg.t_group_id}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div className="bg-blue-500 h-4 rounded-full" style={{ width: `${width}%` }} />
                </div>
                <div className="w-20 text-sm text-gray-600">{tg.domain_count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter by T-Group */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by T-Group:</label>
          <select
            value={filterTGroup}
            onChange={(e) => setFilterTGroup(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5"
          >
            <option value="all">All T-Groups</option>
            {hgroup.t_groups.map(tg => (
              <option key={tg.t_group_id} value={tg.t_group_id}>
                {tg.t_group_id} {tg.t_group_name && `- ${tg.t_group_name}`}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            Showing {filteredDomains.length} domains
          </span>
        </div>
      </div>

      {/* Reference Domains List */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-medium text-gray-900">Reference Domain Usage (sorted by low-conf rate)</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredDomains.map((rd) => (
            <div key={rd.ecod_domain_id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/reference-domains/${rd.ecod_domain_id}`}
                      className="text-blue-600 hover:text-blue-800 font-mono font-medium"
                    >
                      {rd.ecod_domain_id}
                    </Link>
                    {rd.is_manual_rep && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">Manual Rep</span>
                    )}
                    {rd.is_f_rep && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">F-Rep</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    T: {rd.t_group} {rd.t_group_name && `(${rd.t_group_name})`}
                    {rd.f_group && (
                      <span className="ml-2">
                        F: {rd.f_group} {rd.f_name && `(${rd.f_name})`}
                        {rd.pfam_acc && <span className="text-gray-400"> [{rd.pfam_acc}]</span>}
                      </span>
                    )}
                  </div>

                  {/* Attracted Pfams Warning */}
                  {rd.pfam_names_attracted.length > 0 && (
                    <div className="mt-2 text-sm">
                      <span className="text-orange-600 font-medium">Attracts: </span>
                      <span className="text-gray-600">
                        {rd.pfam_names_attracted.slice(0, 4).join(', ')}
                        {rd.pfam_names_attracted.length > 4 && (
                          <span className="text-gray-400"> (+{rd.pfam_names_attracted.length - 4} more)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  {/* Usage Bar */}
                  {getUsageBar(rd.total_uses, rd.low_conf_count, maxTotalUses)}

                  {/* Low-conf Rate */}
                  <div className="text-right">
                    <div className={`text-lg font-bold ${rd.low_conf_rate >= 0.5 ? 'text-red-600' : 'text-gray-600'}`}>
                      {(rd.low_conf_rate * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">low-conf</div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Link
                      href={`/reference-domains/${rd.ecod_domain_id}`}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                    >
                      Detail
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredDomains.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No reference domains found for this H-group.
        </div>
      )}
    </div>
  );
}
