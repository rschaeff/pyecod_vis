/**
 * GET /api/queue/all
 *
 * Returns all proteins in curation (not filtered by clustering)
 * Used for Phase 1 before clustering data is loaded
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');

    const sql = `
      SELECT
        source_id,
        sequence_length,
        domain_count,
        partition_coverage,
        partition_quality,
        curation_status
      FROM ecod_curation.protein
      WHERE curation_status = 'pending'
      ORDER BY processed_at DESC
      LIMIT $1
    `;

    const result = await query(sql, [limit]);

    return NextResponse.json({
      proteins: result.rows,
      total: result.rowCount
    });

  } catch (error) {
    console.error('Queue/all API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch proteins',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
