/**
 * GET /api/archaea/stats
 *
 * Returns statistics for the archaea curation dashboard
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ArchaeaStats, CurationProgress } from '@/lib/archaea-types';

export async function GET() {
  try {
    // Get total protein counts
    const proteinCounts = await query<{
      total: string;
      with_structure: string;
      with_quality: string;
    }>(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE has_structure = TRUE) AS with_structure,
        COUNT(*) FILTER (WHERE protein_id IN (SELECT protein_id FROM archaea.structure_quality_metrics)) AS with_quality
      FROM archaea.target_proteins
    `);

    // Get cluster count
    const clusterCount = await query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM archaea.structural_clusters
    `);

    // Get curation candidate count
    const candidateCount = await query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM archaea.curation_candidates
    `);

    // Get status breakdown
    const statusBreakdown = await query<{ status: string; count: string }>(`
      SELECT curation_status AS status, COUNT(*) AS count
      FROM archaea.curation_candidates
      GROUP BY curation_status
    `);

    // Get novelty breakdown
    const noveltyBreakdown = await query<{ novelty: string; count: string }>(`
      SELECT novelty_category AS novelty, COUNT(*) AS count
      FROM archaea.curation_candidates
      GROUP BY novelty_category
    `);

    // Get priority breakdown
    const priorityBreakdown = await query<{ priority: string; count: string }>(`
      SELECT priority_category AS priority, COUNT(*) AS count
      FROM archaea.curation_candidates
      GROUP BY priority_category
      ORDER BY count DESC
    `);

    // Get source breakdown
    const sourceBreakdown = await query<{ source: string; count: string }>(`
      SELECT source, COUNT(*) AS count
      FROM archaea.target_proteins
      GROUP BY source
      ORDER BY count DESC
    `);

    // Get curation progress (from view)
    const progressResult = await query<CurationProgress>(`
      SELECT * FROM archaea.v_curation_progress
      ORDER BY novelty_category, priority_category, curation_status
    `);

    // Build response
    const stats: ArchaeaStats = {
      total_proteins: parseInt(proteinCounts.rows[0]?.total || '0'),
      with_structure: parseInt(proteinCounts.rows[0]?.with_structure || '0'),
      with_quality_metrics: parseInt(proteinCounts.rows[0]?.with_quality || '0'),
      total_clusters: parseInt(clusterCount.rows[0]?.count || '0'),
      curation_candidates: parseInt(candidateCount.rows[0]?.count || '0'),
      status_breakdown: {
        pending: 0,
        in_review: 0,
        classified: 0,
        deferred: 0,
        rejected: 0,
        needs_reanalysis: 0,
      },
      novelty_breakdown: {
        dark: 0,
        'sequence-orphan': 0,
        divergent: 0,
        known: 0,
      },
      priority_breakdown: {},
      source_breakdown: {},
    };

    // Fill in status breakdown
    for (const row of statusBreakdown.rows) {
      const status = row.status as keyof typeof stats.status_breakdown;
      if (status in stats.status_breakdown) {
        stats.status_breakdown[status] = parseInt(row.count);
      }
    }

    // Fill in novelty breakdown
    for (const row of noveltyBreakdown.rows) {
      const novelty = row.novelty as keyof typeof stats.novelty_breakdown;
      if (novelty in stats.novelty_breakdown) {
        stats.novelty_breakdown[novelty] = parseInt(row.count);
      }
    }

    // Fill in priority breakdown
    for (const row of priorityBreakdown.rows) {
      stats.priority_breakdown[row.priority] = parseInt(row.count);
    }

    // Fill in source breakdown
    for (const row of sourceBreakdown.rows) {
      stats.source_breakdown[row.source] = parseInt(row.count);
    }

    return NextResponse.json({
      stats,
      progress: progressResult.rows,
    });

  } catch (error) {
    console.error('Archaea Stats API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch archaea statistics',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
