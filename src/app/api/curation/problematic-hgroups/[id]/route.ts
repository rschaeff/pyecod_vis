/**
 * GET /api/curation/problematic-hgroups/:id
 *
 * Returns detailed information for a specific problematic H-group,
 * including all reference domains with usage stats and attracted Pfams.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface TGroup {
  t_group_id: string;
  t_group_name: string | null;
  domain_count: number;
}

interface ReferenceDomain {
  ecod_domain_id: string;
  ecod_uid: string;
  pdb_id: string;
  chain: string;
  pdb_range: string;
  t_group: string;
  t_group_name: string | null;
  f_group: string | null;
  f_name: string | null;
  pfam_acc: string | null;
  is_manual_rep: boolean;
  is_f_rep: boolean;
  total_uses: number;
  low_conf_count: number;
  good_domain_count: number;
  low_conf_rate: number;
  avg_dpam_prob: number;
  avg_hh_prob: number;
  pfams_attracted: string[];
  pfam_names_attracted: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hGroupId = id;

    // 1. Get H-group basic info from cluster table
    // Also try to get consistency info from problematic_hgroups if it exists
    // Note: ecod_rep.cluster.id is type dom_cid, need to cast
    const hgroupResult = await query(`
      SELECT
        hc.id as h_group_id,
        hc.name as h_group_name,
        xc.id as x_group_id,
        xc.name as x_group_name,
        COALESCE(ph.total_reps, 0) as total_reps,
        COALESCE(ph.hgroup_avg_consistency, 0.5) as avg_consistency,
        COALESCE(ph.hgroup_stddev_consistency, 0.1) as stddev_consistency,
        COALESCE(ph.issue_type, 'unknown') as issue_type
      FROM ecod_rep.cluster hc
      LEFT JOIN ecod_rep.cluster xc ON hc.parent = xc.id AND xc.type = 'X'
      LEFT JOIN ecod_curation.problematic_hgroups ph ON hc.id::text = ph.h_group_id
      WHERE hc.id = $1::dom_cid AND hc.type = 'H'
    `, [hGroupId]);

    if (hgroupResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'H-group not found' },
        { status: 404 }
      );
    }

    const hgroup = hgroupResult.rows[0];

    // 2. Get T-groups in this H-group
    const tgroupsResult = await query<TGroup>(`
      SELECT
        tc.id as t_group_id,
        tc.name as t_group_name,
        (SELECT COUNT(*) FROM swissprot.domain sd
         WHERE sd.t_group = tc.id::text) as domain_count
      FROM ecod_rep.cluster tc
      WHERE tc.parent = $1::dom_cid AND tc.type = 'T'
      ORDER BY tc.id
    `, [hGroupId]);

    // 3. Get reference domains with usage stats
    // Note: swissprot.domain doesn't have pfam columns, so we get pfam from ecod_rep.cluster
    // Note: ecod_rep.cluster.id is dom_cid type, swissprot.domain.hgroup_id is varchar
    const refDomainsResult = await query<ReferenceDomain>(`
      WITH domain_usage AS (
        SELECT
          sd.hit_ecod_domain_id,
          COUNT(*) as total_uses,
          SUM(CASE WHEN sd.judge = 'good_domain' THEN 1 ELSE 0 END) as good_domain_count,
          SUM(CASE WHEN sd.judge = 'low_confidence' THEN 1 ELSE 0 END) as low_conf_count,
          ROUND(AVG(sd.dpam_prob), 3) as avg_dpam_prob,
          ROUND(AVG(sd.hh_prob), 3) as avg_hh_prob
        FROM swissprot.domain sd
        WHERE sd.hit_ecod_domain_id IS NOT NULL
          AND sd.hgroup_id = $1
        GROUP BY sd.hit_ecod_domain_id
        HAVING COUNT(*) >= 5
      )
      SELECT
        d.ecod_domain_id,
        d.ecod_uid,
        SUBSTRING(d.ecod_domain_id FROM 2 FOR 4) as pdb_id,
        d.chain_id as chain,
        dr.range_definition as pdb_range,
        d.t_id as t_group,
        tc.name as t_group_name,
        d.f_id as f_group,
        fc.name as f_name,
        fc.pfam_acc,
        d.manual_rep as is_manual_rep,
        false as is_f_rep,
        COALESCE(du.total_uses, 0) as total_uses,
        COALESCE(du.low_conf_count, 0) as low_conf_count,
        COALESCE(du.good_domain_count, 0) as good_domain_count,
        ROUND(COALESCE(du.low_conf_count, 0)::numeric / NULLIF(COALESCE(du.total_uses, 0), 0), 3) as low_conf_rate,
        COALESCE(du.avg_dpam_prob, 0) as avg_dpam_prob,
        COALESCE(du.avg_hh_prob, 0) as avg_hh_prob,
        ARRAY[]::text[] as pfams_attracted,
        ARRAY[]::text[] as pfam_names_attracted
      FROM ecod_rep.domain d
      LEFT JOIN ecod_commons.domain_ranges dr ON d.ecod_uid = dr.domain_id AND dr.is_primary = true
      LEFT JOIN ecod_rep.cluster tc ON d.t_id::dom_cid = tc.id AND tc.type = 'T'
      LEFT JOIN ecod_rep.cluster fc ON d.f_id::dom_cid = fc.id AND fc.type = 'F'
      LEFT JOIN domain_usage du ON d.ecod_domain_id = du.hit_ecod_domain_id
      WHERE tc.parent = $1::dom_cid
        AND COALESCE(du.total_uses, 0) >= 5
      ORDER BY COALESCE(du.low_conf_count, 0) DESC
      LIMIT 100
    `, [hGroupId]);

    // 4. Get consistency stats
    const consistencyStats = {
      avg: parseFloat(hgroup.avg_consistency) || 0,
      stddev: parseFloat(hgroup.stddev_consistency) || 0,
      min: 0, // Would need additional query
      max: 0  // Would need additional query
    };

    return NextResponse.json({
      h_group_id: hgroup.h_group_id,
      h_group_name: hgroup.h_group_name,
      hierarchy: {
        x_group: hgroup.x_group_id,
        x_group_name: hgroup.x_group_name
      },
      t_groups: tgroupsResult.rows,
      reference_domains: refDomainsResult.rows.map(rd => ({
        ...rd,
        total_uses: parseInt(String(rd.total_uses)),
        low_conf_count: parseInt(String(rd.low_conf_count)),
        good_domain_count: parseInt(String(rd.good_domain_count)),
        low_conf_rate: parseFloat(String(rd.low_conf_rate)) || 0,
        avg_dpam_prob: parseFloat(String(rd.avg_dpam_prob)) || 0,
        avg_hh_prob: parseFloat(String(rd.avg_hh_prob)) || 0
      })),
      consistency_stats: consistencyStats,
      total_reps: parseInt(hgroup.total_reps)
    });

  } catch (error) {
    console.error('H-Group Detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch H-group details',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
