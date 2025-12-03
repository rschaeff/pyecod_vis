/**
 * GET /api/curation/novel-candidates/:id
 *
 * Returns detailed information for a specific novel candidate cluster,
 * including all member domains with Foldseek hits and structure info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ClusterMember {
  id: number;
  domain_id: number | null;
  unp_acc: string;
  domain_range: string;
  sequence_length: number | null;
  plddt: number | null;
  best_ecod_uid: number | null;
  best_ecod_lddt: number | null;
  best_ecod_evalue: number | null;
  best_ecod_tgroup: string | null;
  best_ecod_xgroup: string | null;
  helix_pct: number | null;
  strand_pct: number | null;
  coil_pct: number | null;
  is_representative: boolean;
  // From swissprot.domain
  domain_domain_id: string | null;
  // From ECOD lookup
  ecod_domain_id: string | null;
  tgroup_name: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clusterId = parseInt(id);

    if (isNaN(clusterId)) {
      return NextResponse.json(
        { error: 'Invalid cluster ID' },
        { status: 400 }
      );
    }

    // Get cluster details
    const clusterResult = await query(`
      SELECT
        nc.id,
        nc.cluster_name,
        nc.source,
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
        nc.curator_notes,
        nc.curated_by,
        nc.curated_at,
        nc.created_at,
        xc.name as xgroup_name
      FROM ecod_curation.novel_candidate_cluster nc
      LEFT JOIN ecod_rep.cluster xc ON nc.best_ecod_xgroup::dom_cid = xc.id AND xc.type = 'X'
      WHERE nc.id = $1
    `, [clusterId]);

    if (clusterResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: 404 }
      );
    }

    const cluster = clusterResult.rows[0];

    // Get cluster members with domain info
    const membersResult = await query<ClusterMember>(`
      SELECT
        nm.id,
        nm.domain_id,
        nm.unp_acc,
        nm.domain_range,
        nm.sequence_length,
        nm.plddt,
        nm.best_ecod_uid,
        nm.best_ecod_lddt,
        nm.best_ecod_evalue,
        nm.best_ecod_tgroup,
        nm.best_ecod_xgroup,
        nm.helix_pct,
        nm.strand_pct,
        nm.coil_pct,
        nm.is_representative,
        sd.domain_id as domain_domain_id,
        ed.ecod_domain_id,
        tc.name as tgroup_name
      FROM ecod_curation.novel_candidate_member nm
      LEFT JOIN swissprot.domain sd ON nm.domain_id = sd.id
      LEFT JOIN ecod_commons.domains ed ON nm.best_ecod_uid = ed.ecod_uid
      LEFT JOIN ecod_rep.cluster tc ON nm.best_ecod_tgroup::dom_cid = tc.id AND tc.type = 'T'
      WHERE nm.cluster_id = $1
      ORDER BY nm.is_representative DESC, nm.best_ecod_lddt DESC NULLS LAST
    `, [clusterId]);

    // Get X-group distribution
    const xgroupDist = await query<{ xgroup: string; count: string; name: string | null }>(`
      SELECT
        nm.best_ecod_xgroup as xgroup,
        COUNT(*) as count,
        xc.name
      FROM ecod_curation.novel_candidate_member nm
      LEFT JOIN ecod_rep.cluster xc ON nm.best_ecod_xgroup::dom_cid = xc.id AND xc.type = 'X'
      WHERE nm.cluster_id = $1
        AND nm.best_ecod_xgroup IS NOT NULL
      GROUP BY nm.best_ecod_xgroup, xc.name
      ORDER BY count DESC
    `, [clusterId]);

    // Get LDDT distribution buckets
    const lddtDist = await query<{ bucket: string; count: string }>(`
      SELECT
        CASE
          WHEN best_ecod_lddt IS NULL THEN 'no_hit'
          WHEN best_ecod_lddt < 0.3 THEN '0.0-0.3'
          WHEN best_ecod_lddt < 0.5 THEN '0.3-0.5'
          WHEN best_ecod_lddt < 0.7 THEN '0.5-0.7'
          ELSE '0.7+'
        END as bucket,
        COUNT(*) as count
      FROM ecod_curation.novel_candidate_member
      WHERE cluster_id = $1
      GROUP BY bucket
      ORDER BY bucket
    `, [clusterId]);

    return NextResponse.json({
      cluster: {
        ...cluster,
        avg_best_lddt: cluster.avg_best_lddt ? parseFloat(String(cluster.avg_best_lddt)) : null,
        max_best_lddt: cluster.max_best_lddt ? parseFloat(String(cluster.max_best_lddt)) : null,
        xgroup_consistency: cluster.xgroup_consistency ? parseFloat(String(cluster.xgroup_consistency)) : null,
        avg_plddt: cluster.avg_plddt ? parseFloat(String(cluster.avg_plddt)) : null,
      },
      members: membersResult.rows.map(m => ({
        ...m,
        plddt: m.plddt ? parseFloat(String(m.plddt)) : null,
        best_ecod_lddt: m.best_ecod_lddt ? parseFloat(String(m.best_ecod_lddt)) : null,
        helix_pct: m.helix_pct ? parseFloat(String(m.helix_pct)) : null,
        strand_pct: m.strand_pct ? parseFloat(String(m.strand_pct)) : null,
        coil_pct: m.coil_pct ? parseFloat(String(m.coil_pct)) : null,
      })),
      xgroup_distribution: xgroupDist.rows.map(r => ({
        xgroup: r.xgroup,
        name: r.name,
        count: parseInt(r.count)
      })),
      lddt_distribution: lddtDist.rows.reduce((acc, r) => {
        acc[r.bucket] = parseInt(r.count);
        return acc;
      }, {} as Record<string, number>)
    });

  } catch (error) {
    console.error('Novel Candidate Detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cluster details',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/curation/novel-candidates/:id
 *
 * Update cluster curation status and assignment.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clusterId = parseInt(id);

    if (isNaN(clusterId)) {
      return NextResponse.json(
        { error: 'Invalid cluster ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, assigned_xgroup, assigned_hgroup, assigned_tgroup, curator_notes, curator } = body;

    // Validate status
    const validStatuses = ['pending', 'in_review', 'curated', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIdx = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      values.push(status);
    }
    if (assigned_xgroup !== undefined) {
      updates.push(`assigned_xgroup = $${paramIdx++}`);
      values.push(assigned_xgroup);
    }
    if (assigned_hgroup !== undefined) {
      updates.push(`assigned_hgroup = $${paramIdx++}`);
      values.push(assigned_hgroup);
    }
    if (assigned_tgroup !== undefined) {
      updates.push(`assigned_tgroup = $${paramIdx++}`);
      values.push(assigned_tgroup);
    }
    if (curator_notes !== undefined) {
      updates.push(`curator_notes = $${paramIdx++}`);
      values.push(curator_notes);
    }
    if (curator) {
      updates.push(`curated_by = $${paramIdx++}`);
      values.push(curator);
      updates.push(`curated_at = NOW()`);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    values.push(clusterId);

    const result = await query(`
      UPDATE ecod_curation.novel_candidate_cluster
      SET ${updates.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING id, cluster_name, status, assigned_xgroup, assigned_hgroup, assigned_tgroup, curated_by, curated_at
    `, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      cluster: result.rows[0]
    });

  } catch (error) {
    console.error('Novel Candidate Update API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update cluster',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
