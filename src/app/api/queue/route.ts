/**
 * GET /api/queue
 *
 * Returns the curation queue showing proteins pending review
 * Filtered by cluster and status
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { QueueItem } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cluster = searchParams.get('cluster') || 'weekly_20250905_70pct';
    const filter = searchParams.get('filter') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Base query from cluster_representatives view
    let sql = `
      SELECT
        cr.protein_id,
        cr.source_id,
        cr.domain_count,
        cr.partition_coverage,
        cr.cluster_size,
        cr.cluster_name,
        pg.uncovered_residues,
        pg.has_significant_gap as has_gap,
        q.priority,
        q.priority_reason
      FROM ecod_curation.cluster_representatives cr
      LEFT JOIN ecod_curation.protein_gaps pg ON cr.protein_id = pg.protein_id
      LEFT JOIN ecod_curation.curation_queue q ON cr.protein_id = q.protein_id
      WHERE cr.cluster_name = $1
        AND cr.curation_status = 'pending'
    `;

    const params: any[] = [cluster];

    // Apply filters
    if (filter === 'low_coverage') {
      sql += ` AND cr.partition_coverage < 0.8`;
    } else if (filter === 'unassigned') {
      sql += ` AND EXISTS (
        SELECT 1 FROM ecod_curation.domain_assignment da
        WHERE da.protein_id = cr.protein_id
          AND da.assigned_f_group IS NULL
      )`;
    } else if (filter === 'large_gaps') {
      sql += ` AND pg.has_significant_gap = true`;
    }

    // Order by priority and cluster size
    sql += `
      ORDER BY
        COALESCE(q.priority, 5) DESC,
        cr.cluster_size DESC,
        cr.source_id
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await query<QueueItem>(sql, params);

    // Get statistics
    const statsResult = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE curation_status = 'curated') as curated,
        COUNT(*) FILTER (WHERE curation_status = 'pending') as remaining
      FROM ecod_curation.cluster_representatives
      WHERE cluster_name = $1
    `, [cluster]);

    return NextResponse.json({
      proteins: result.rows,
      total: parseInt(statsResult.rows[0].total),
      curated: parseInt(statsResult.rows[0].curated),
      remaining: parseInt(statsResult.rows[0].remaining),
    });

  } catch (error) {
    console.error('Queue API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch queue',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
