/**
 * GET /api/swissprot/queue
 *
 * Returns the SwissProt novel domain curation queue
 * Filtered by priority and status
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface SwissProtQueueItem {
  protein_id: number;
  source_id: string;
  unp_acc: string;
  cluster_size: number;
  plddt: number;
  dpam_prob: number;
  hh_prob: number;
  assigned_t_group: string | null;
  t_group_name: string | null;
  priority: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Base query from swissprot_protein and queue, join cluster for T-group name
    let sql = `
      SELECT
        sp.id as protein_id,
        sp.source_id,
        sp.unp_acc,
        sp.cluster_size,
        sp.plddt,
        sp.dpam_prob,
        sp.hh_prob,
        sp.assigned_t_group,
        tc.name as t_group_name,
        sq.priority
      FROM ecod_curation.swissprot_protein sp
      JOIN ecod_curation.swissprot_curation_queue sq ON sp.id = sq.protein_id
      LEFT JOIN ecod_rep.cluster tc ON sp.assigned_t_group = tc.id AND tc.type = 'T'
      WHERE sp.curation_status = 'pending'
    `;

    const params: any[] = [];

    // Apply filters
    if (filter === 'high_priority') {
      sql += ` AND sq.priority = 1`;
    } else if (filter === 'medium_priority') {
      sql += ` AND sq.priority = 2`;
    } else if (filter === 'low_priority') {
      sql += ` AND sq.priority = 3`;
    } else if (filter === 'large_clusters') {
      sql += ` AND sp.cluster_size >= 5`;
    }

    // Order by priority (1 = high) and cluster size
    sql += `
      ORDER BY
        sq.priority ASC,
        sp.cluster_size DESC,
        sp.dpam_prob DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await query<SwissProtQueueItem>(sql, params);

    // Get statistics
    const statsResult = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE curation_status = 'curated') as curated,
        COUNT(*) FILTER (WHERE curation_status = 'pending') as remaining,
        COUNT(*) FILTER (WHERE curation_status = 'rejected') as rejected
      FROM ecod_curation.swissprot_protein
    `);

    // Get priority breakdown
    const priorityResult = await query(`
      SELECT
        sq.priority,
        COUNT(*) as count
      FROM ecod_curation.swissprot_curation_queue sq
      JOIN ecod_curation.swissprot_protein sp ON sq.protein_id = sp.id
      WHERE sp.curation_status = 'pending'
      GROUP BY sq.priority
      ORDER BY sq.priority
    `);

    const priorityBreakdown: { [key: number]: number } = {};
    priorityResult.rows.forEach(row => {
      priorityBreakdown[row.priority] = parseInt(row.count);
    });

    return NextResponse.json({
      proteins: result.rows,
      total: parseInt(statsResult.rows[0].total),
      curated: parseInt(statsResult.rows[0].curated),
      remaining: parseInt(statsResult.rows[0].remaining),
      rejected: parseInt(statsResult.rows[0].rejected),
      priority_breakdown: {
        high: priorityBreakdown[1] || 0,
        medium: priorityBreakdown[2] || 0,
        low: priorityBreakdown[3] || 0,
      }
    });

  } catch (error) {
    console.error('SwissProt Queue API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch SwissProt queue',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
