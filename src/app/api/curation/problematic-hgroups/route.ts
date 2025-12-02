/**
 * GET /api/curation/problematic-hgroups
 *
 * Returns list of problematic H-groups with high low-confidence rates.
 * These are H-groups containing reference domains that act as "structural attractors"
 * pulling in assignments from unrelated families.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ProblematicHGroup {
  h_group_id: string;
  h_group_name: string;
  x_group_id: string;
  x_group_name: string;
  total_reps: number;
  avg_consistency: number;
  stddev_consistency: number;
  issue_type: string;
  swissprot_domain_count: number;
  low_conf_domain_count: number;
  low_conf_rate: number;
  problematic_ref_count: number;
  top_problematic_ref: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const minLowConfRate = parseFloat(searchParams.get('min_low_conf_rate') || '0.5');
    const minDomains = parseInt(searchParams.get('min_domains') || '50');
    const sortBy = searchParams.get('sort_by') || 'low_conf_count';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query H-groups with usage stats computed from swissprot.domain
    // Don't rely on problematic_hgroups table columns that may not exist
    const sql = `
      WITH ref_domain_stats AS (
        -- Compute per-reference-domain stats from swissprot.domain
        SELECT
          sd.hit_ecod_domain_id as ecod_domain_id,
          SUBSTRING(sd.t_group FROM '^([0-9]+\\.[0-9]+)') as h_group_id,
          COUNT(*) as total_uses,
          SUM(CASE WHEN sd.judge = 'low_confidence' THEN 1 ELSE 0 END) as low_conf_count,
          ROUND(SUM(CASE WHEN sd.judge = 'low_confidence' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0), 3) as low_conf_rate
        FROM swissprot.domain sd
        WHERE sd.hit_ecod_domain_id IS NOT NULL
        GROUP BY sd.hit_ecod_domain_id, SUBSTRING(sd.t_group FROM '^([0-9]+\\.[0-9]+)')
        HAVING COUNT(*) >= 10
      ),
      hgroup_stats AS (
        -- Aggregate to H-group level
        SELECT
          rds.h_group_id,
          SUM(rds.total_uses) as swissprot_domain_count,
          SUM(rds.low_conf_count) as low_conf_domain_count,
          ROUND(SUM(rds.low_conf_count)::numeric / NULLIF(SUM(rds.total_uses), 0), 3) as low_conf_rate,
          COUNT(*) as total_reps,
          COUNT(*) FILTER (WHERE rds.low_conf_rate >= 0.5) as problematic_ref_count,
          (SELECT ecod_domain_id FROM ref_domain_stats r2
           WHERE r2.h_group_id = rds.h_group_id
           ORDER BY r2.low_conf_count DESC LIMIT 1) as top_problematic_ref
        FROM ref_domain_stats rds
        GROUP BY rds.h_group_id
      )
      SELECT
        hs.h_group_id as h_group_id,
        hc.name as h_group_name,
        SUBSTRING(hs.h_group_id FROM '^([0-9]+)') as x_group_id,
        xc.name as x_group_name,
        hs.total_reps,
        0.5 as avg_consistency,
        0.1 as stddev_consistency,
        'low_consistency' as issue_type,
        hs.swissprot_domain_count,
        hs.low_conf_domain_count,
        hs.low_conf_rate,
        hs.problematic_ref_count,
        hs.top_problematic_ref
      FROM hgroup_stats hs
      LEFT JOIN ecod_rep.cluster hc ON hs.h_group_id = hc.id AND hc.type = 'H'
      LEFT JOIN ecod_rep.cluster xc ON hc.parent = xc.id AND xc.type = 'X'
      WHERE hs.low_conf_rate >= $1
        AND hs.swissprot_domain_count >= $2
      ORDER BY
        CASE $3
          WHEN 'low_conf_count' THEN hs.low_conf_domain_count
          WHEN 'low_conf_rate' THEN hs.low_conf_rate * 1000
          WHEN 'total_domains' THEN hs.swissprot_domain_count
          ELSE hs.low_conf_domain_count
        END DESC
      LIMIT $4 OFFSET $5
    `;

    const result = await query<ProblematicHGroup>(sql, [
      minLowConfRate,
      minDomains,
      sortBy,
      limit,
      offset
    ]);

    // Get total count for pagination
    const countSql = `
      WITH ref_domain_stats AS (
        SELECT
          sd.hit_ecod_domain_id as ecod_domain_id,
          SUBSTRING(sd.t_group FROM '^([0-9]+\\.[0-9]+)') as h_group_id,
          COUNT(*) as total_uses,
          SUM(CASE WHEN sd.judge = 'low_confidence' THEN 1 ELSE 0 END) as low_conf_count
        FROM swissprot.domain sd
        WHERE sd.hit_ecod_domain_id IS NOT NULL
        GROUP BY sd.hit_ecod_domain_id, SUBSTRING(sd.t_group FROM '^([0-9]+\\.[0-9]+)')
        HAVING COUNT(*) >= 10
      ),
      hgroup_stats AS (
        SELECT
          rds.h_group_id,
          SUM(rds.total_uses) as swissprot_domain_count,
          SUM(rds.low_conf_count) as low_conf_domain_count,
          ROUND(SUM(rds.low_conf_count)::numeric / NULLIF(SUM(rds.total_uses), 0), 3) as low_conf_rate
        FROM ref_domain_stats rds
        GROUP BY rds.h_group_id
      )
      SELECT COUNT(*) as total
      FROM hgroup_stats hs
      WHERE hs.low_conf_rate >= $1
        AND hs.swissprot_domain_count >= $2
    `;

    const countResult = await query(countSql, [minLowConfRate, minDomains]);

    return NextResponse.json({
      hgroups: result.rows,
      total: parseInt(countResult.rows[0]?.total || '0'),
      limit,
      offset
    });

  } catch (error) {
    console.error('Problematic H-Groups API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch problematic H-groups',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
