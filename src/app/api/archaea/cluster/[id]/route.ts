/**
 * GET /api/archaea/cluster/:id
 *
 * Returns cluster details and members
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ArchaeaCluster, ClusterMember } from '@/lib/archaea-types';

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

    // Get cluster info from summary view
    const clusterResult = await query<ArchaeaCluster>(`
      SELECT * FROM archaea.v_cluster_summary
      WHERE cluster_id = $1
    `, [clusterId]);

    if (clusterResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Cluster not found', cluster_id: clusterId },
        { status: 404 }
      );
    }

    const cluster = clusterResult.rows[0];

    // Get cluster members with details
    const membersResult = await query<ClusterMember>(`
      SELECT
        scm.protein_id,
        tp.uniprot_acc,
        tp.sequence_length,
        scm.is_representative,
        sqm.mean_plddt,
        sqm.quality_score,
        cc.novelty_category,
        cc.curation_status
      FROM archaea.structural_cluster_members scm
      JOIN archaea.target_proteins tp ON scm.protein_id = tp.protein_id
      LEFT JOIN archaea.structure_quality_metrics sqm ON scm.protein_id = sqm.protein_id
      LEFT JOIN archaea.curation_candidates cc ON scm.protein_id = cc.protein_id
      WHERE scm.cluster_id = $1
      ORDER BY scm.is_representative DESC, sqm.quality_score DESC NULLS LAST
    `, [clusterId]);

    return NextResponse.json({
      cluster,
      members: membersResult.rows,
    });

  } catch (error) {
    console.error('Archaea Cluster API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cluster',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
