/**
 * GET /api/queue/all
 *
 * Returns proteins in curation queue with clustering support
 *
 * Query params:
 *   - show_all: true/false (default: false) - show all chains or just cluster representatives
 *   - limit: number (default: 100) - max proteins to return
 *   - single_char_only: true/false (default: false) - exclude multi-character chain IDs
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const showAll = searchParams.get('show_all') === 'true';
    const singleCharOnly = searchParams.get('single_char_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');

    let sql: string;

    // Build chain filter
    const chainFilter = singleCharOnly ? "AND LENGTH(p.chain_id) = 1" : "";

    if (showAll) {
      // Show all proteins (including cluster members)
      sql = `
        SELECT
          p.source_id,
          p.chain_id,
          p.sequence_length,
          p.domain_count,
          p.partition_coverage,
          p.partition_quality,
          p.curation_status,
          p.release_date,
          cm.is_representative,
          (
            SELECT COUNT(*)
            FROM ecod_curation.cluster_membership cm2
            WHERE cm2.cluster_id = cm.cluster_id
              AND cm2.cluster_rank = cm.cluster_rank
          ) as cluster_size
        FROM ecod_curation.protein p
        LEFT JOIN ecod_curation.cluster_membership cm ON p.id = cm.protein_id
        WHERE p.curation_status = 'pending'
          ${chainFilter}
        ORDER BY
          p.processed_at DESC
        LIMIT $1
      `;
    } else {
      // Show only cluster representatives (default)
      sql = `
        SELECT
          p.source_id,
          p.chain_id,
          p.sequence_length,
          p.domain_count,
          p.partition_coverage,
          p.partition_quality,
          p.curation_status,
          p.release_date,
          COALESCE(cm.is_representative, true) as is_representative,
          COALESCE(
            (
              SELECT COUNT(*)
              FROM ecod_curation.cluster_membership cm2
              WHERE cm2.cluster_id = cm.cluster_id
                AND cm2.cluster_rank = cm.cluster_rank
            ),
            1
          ) as cluster_size
        FROM ecod_curation.protein p
        LEFT JOIN ecod_curation.cluster_membership cm ON p.id = cm.protein_id
        WHERE p.curation_status = 'pending'
          AND (cm.is_representative = true OR cm.is_representative IS NULL)
          ${chainFilter}
        ORDER BY
          p.processed_at DESC
        LIMIT $1
      `;
    }

    const result = await query(sql, [limit]);

    return NextResponse.json({
      proteins: result.rows,
      total: result.rowCount,
      show_all: showAll
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
