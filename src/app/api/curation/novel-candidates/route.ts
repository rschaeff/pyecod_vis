/**
 * GET /api/curation/novel-candidates
 *
 * Returns list of novel candidate clusters - domains with no Pfam hit
 * and no confident ECOD structural match.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface NovelCluster {
  id: number;
  cluster_name: string;
  member_count: number;
  best_ecod_xgroup: string | null;
  avg_best_lddt: number | null;
  max_best_lddt: number | null;
  xgroup_consistency: number | null;
  avg_plddt: number | null;
  avg_domain_length: number | null;
  status: string;
  assigned_xgroup: string | null;
  assigned_hgroup: string | null;
  assigned_tgroup: string | null;
  curated_by: string | null;
  curated_at: string | null;
  // Computed: X-group name from ECOD
  xgroup_name: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sort_by') || 'member_count';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build sort clause
    const validSortColumns = ['member_count', 'avg_best_lddt', 'xgroup_consistency', 'avg_plddt', 'cluster_name'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'member_count';
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (status !== 'all') {
      conditions.push(`nc.status = $${paramIdx++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query clusters with X-group name lookup
    const sql = `
      SELECT
        nc.id,
        nc.cluster_name,
        nc.member_count,
        nc.best_ecod_xgroup,
        nc.avg_best_lddt,
        nc.max_best_lddt,
        nc.xgroup_consistency,
        nc.avg_plddt,
        nc.avg_domain_length,
        nc.status,
        nc.assigned_xgroup,
        nc.assigned_hgroup,
        nc.assigned_tgroup,
        nc.curated_by,
        nc.curated_at,
        xc.name as xgroup_name
      FROM ecod_curation.novel_candidate_cluster nc
      LEFT JOIN ecod_rep.cluster xc ON nc.best_ecod_xgroup::dom_cid = xc.id AND xc.type = 'X'
      ${whereClause}
      ORDER BY nc.${sortColumn} ${sortDir} NULLS LAST
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    params.push(limit, offset);

    const result = await query<NovelCluster>(sql, params);

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM ecod_curation.novel_candidate_cluster nc
      ${whereClause}
    `;
    const countResult = await query<{ total: string }>(countSql, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Get status summary
    const statusSummary = await query<{ status: string; count: string }>(`
      SELECT status, COUNT(*) as count
      FROM ecod_curation.novel_candidate_cluster
      GROUP BY status
    `);

    return NextResponse.json({
      clusters: result.rows.map(c => ({
        ...c,
        avg_best_lddt: c.avg_best_lddt ? parseFloat(String(c.avg_best_lddt)) : null,
        max_best_lddt: c.max_best_lddt ? parseFloat(String(c.max_best_lddt)) : null,
        xgroup_consistency: c.xgroup_consistency ? parseFloat(String(c.xgroup_consistency)) : null,
        avg_plddt: c.avg_plddt ? parseFloat(String(c.avg_plddt)) : null,
      })),
      total,
      limit,
      offset,
      status_summary: statusSummary.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>)
    });

  } catch (error) {
    console.error('Novel Candidates API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch novel candidates',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
