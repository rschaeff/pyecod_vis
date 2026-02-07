/**
 * GET /api/archaea/cluster
 *
 * Returns paginated list of structural clusters
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ArchaeaCluster } from '@/lib/archaea-types';

// Valid sort columns
const VALID_SORT_COLUMNS = [
  'cluster_size',
  'member_count',
  'avg_plddt',
  'avg_quality_score',
  'dark_count',
  'pending_count',
  'cluster_rep_id',
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const minSize = parseInt(searchParams.get('min_size') || '1');
    const hasDark = searchParams.get('has_dark');
    const hasPending = searchParams.get('has_pending');
    const sortBy = searchParams.get('sort') || 'cluster_size';
    const sortOrder = searchParams.get('order')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate sort column
    const validatedSort = VALID_SORT_COLUMNS.includes(sortBy) ? sortBy : 'cluster_size';

    // Build query
    let sql = `
      SELECT * FROM archaea.v_cluster_summary
      WHERE cluster_size >= $1
    `;
    const params: (number | string)[] = [minSize];
    let paramIdx = 2;

    if (hasDark === 'true') {
      sql += ` AND dark_count > 0`;
    }

    if (hasPending === 'true') {
      sql += ` AND pending_count > 0`;
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS total');
    const countResult = await query<{ total: string }>(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Add sorting and pagination
    sql += ` ORDER BY ${validatedSort} ${sortOrder} NULLS LAST`;
    sql += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    // Execute query
    const result = await query<ArchaeaCluster>(sql, params);

    return NextResponse.json({
      clusters: result.rows,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Archaea Clusters API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch clusters',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
