/**
 * GET /api/validation/curation-stats
 *
 * Returns summary statistics for validation curation activity
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Get overall stats
    const statsResult = await query(`
      SELECT * FROM ecod_curation.validation_curation_stats
    `);

    // Get per-curator stats
    const curatorResult = await query(`
      SELECT
        curator_id,
        username,
        display_name,
        total_curations,
        reviewed_count,
        flagged_count,
        action_planned_count,
        last_activity
      FROM ecod_curation.validation_curator_activity
      WHERE total_curations > 0
      ORDER BY total_curations DESC
    `);

    // Get recent curation activity (last 10)
    const recentResult = await query(`
      SELECT
        vc.id,
        vc.domain1_ecod_uid,
        vc.domain2_ecod_uid,
        vc.issue_type,
        vc.curation_status,
        vc.curation_action,
        vc.curated_at,
        vc.updated_at,
        c.username,
        c.display_name,
        cb.domain1_ecod_id,
        cb.domain2_ecod_id,
        cb.sequence_identity
      FROM ecod_curation.validation_curation vc
      JOIN ecod_curation.curator c ON vc.curator_id = c.id
      LEFT JOIN ecod_curation.cross_boundary_pair cb
        ON vc.domain1_ecod_uid = cb.domain1_ecod_uid
       AND vc.domain2_ecod_uid = cb.domain2_ecod_uid
      ORDER BY vc.updated_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      stats: statsResult.rows[0] || {
        total_curations: 0,
        pending: 0,
        reviewed: 0,
        flagged: 0,
        dismissed: 0,
        action_planned: 0,
        action_taken: 0,
        active_curators: 0,
        last_curation: null,
      },
      by_curator: curatorResult.rows,
      recent_activity: recentResult.rows,
    });

  } catch (error) {
    console.error('Curation stats API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch curation statistics',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
