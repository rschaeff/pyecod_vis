'use client';

/**
 * Archaea Dashboard
 *
 * Overview of archaea protein curation progress with statistics and quick links
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { ArchaeaStats, CurationProgress } from '@/lib/archaea-types';

interface DashboardData {
  stats: ArchaeaStats;
  progress: CurationProgress[];
}

export default function ArchaeaDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/archaea/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-medium">Error Loading Dashboard</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Archaea Protein Curation</h1>
        <p className="text-gray-600 mt-2">
          Novel fold discovery in archaeal proteins using AlphaFold3 structure predictions
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Proteins"
          value={stats?.total_proteins.toLocaleString() || '0'}
          color="blue"
        />
        <StatCard
          title="With Structure"
          value={stats?.with_structure.toLocaleString() || '0'}
          subtitle={stats ? `${((stats.with_structure / stats.total_proteins) * 100).toFixed(1)}%` : ''}
          color="green"
        />
        <StatCard
          title="Curation Candidates"
          value={stats?.curation_candidates.toLocaleString() || '0'}
          color="purple"
        />
        <StatCard
          title="Structural Clusters"
          value={stats?.total_clusters.toLocaleString() || '0'}
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/archaea/queue?status=pending&novelty=dark"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Dark Proteins Queue
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Review proteins with no sequence homologs - highest priority for novel fold discovery
          </p>
          <div className="flex items-center text-green-600 font-medium">
            <span>{stats?.novelty_breakdown.dark.toLocaleString() || '0'} proteins</span>
            <span className="ml-2">→</span>
          </div>
        </Link>

        <Link
          href="/archaea/queue?status=pending"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Full Curation Queue
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            All pending proteins sorted by priority - includes dark, orphan, and divergent categories
          </p>
          <div className="flex items-center text-green-600 font-medium">
            <span>{stats?.status_breakdown.pending.toLocaleString() || '0'} pending</span>
            <span className="ml-2">→</span>
          </div>
        </Link>

        <Link
          href="/archaea/clusters?has_dark=true"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Structural Clusters
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Browse clusters of structurally similar proteins - focus on clusters with dark proteins
          </p>
          <div className="flex items-center text-green-600 font-medium">
            <span>{stats?.total_clusters.toLocaleString() || '0'} clusters</span>
            <span className="ml-2">→</span>
          </div>
        </Link>
      </div>

      {/* Novelty Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Novelty Category</h3>
          <div className="space-y-3">
            <ProgressBar
              label="Dark (no homologs)"
              value={stats?.novelty_breakdown.dark || 0}
              total={stats?.curation_candidates || 1}
              color="bg-red-500"
            />
            <ProgressBar
              label="Sequence Orphan"
              value={stats?.novelty_breakdown['sequence-orphan'] || 0}
              total={stats?.curation_candidates || 1}
              color="bg-orange-500"
            />
            <ProgressBar
              label="Divergent"
              value={stats?.novelty_breakdown.divergent || 0}
              total={stats?.curation_candidates || 1}
              color="bg-yellow-500"
            />
            <ProgressBar
              label="Known"
              value={stats?.novelty_breakdown.known || 0}
              total={stats?.curation_candidates || 1}
              color="bg-green-500"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Curation Status</h3>
          <div className="space-y-3">
            <ProgressBar
              label="Pending"
              value={stats?.status_breakdown.pending || 0}
              total={stats?.curation_candidates || 1}
              color="bg-gray-500"
            />
            <ProgressBar
              label="In Review"
              value={stats?.status_breakdown.in_review || 0}
              total={stats?.curation_candidates || 1}
              color="bg-blue-500"
            />
            <ProgressBar
              label="Classified"
              value={stats?.status_breakdown.classified || 0}
              total={stats?.curation_candidates || 1}
              color="bg-green-500"
            />
            <ProgressBar
              label="Deferred"
              value={stats?.status_breakdown.deferred || 0}
              total={stats?.curation_candidates || 1}
              color="bg-yellow-500"
            />
            <ProgressBar
              label="Rejected"
              value={stats?.status_breakdown.rejected || 0}
              total={stats?.curation_candidates || 1}
              color="bg-red-500"
            />
          </div>
        </div>
      </div>

      {/* Source Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Protein Sources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats?.source_breakdown && Object.entries(stats.source_breakdown).map(([source, count]) => (
            <div key={source} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</div>
              <div className="text-sm text-gray-600">{source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  const textColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    purple: 'text-purple-700',
    orange: 'text-orange-700',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className={`text-3xl font-bold mt-1 ${textColors[color]}`}>{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

// Progress Bar Component
function ProgressBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500">{value.toLocaleString()} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
