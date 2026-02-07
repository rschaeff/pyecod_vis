/**
 * GET /api/archaea/protein/:id
 *
 * Returns full protein detail with quality metrics, taxonomy, and cluster info
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ArchaeaProteinDetail, ClusterMember } from '@/lib/archaea-types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const proteinId = id;

    if (!proteinId) {
      return NextResponse.json(
        { error: 'Protein ID is required' },
        { status: 400 }
      );
    }

    // Get protein detail from view
    const proteinResult = await query<ArchaeaProteinDetail>(`
      SELECT * FROM archaea.v_protein_detail
      WHERE protein_id = $1
    `, [proteinId]);

    if (proteinResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found', protein_id: proteinId },
        { status: 404 }
      );
    }

    const protein = proteinResult.rows[0];

    // Get cluster members if protein is in a cluster
    let clusterMembers: ClusterMember[] = [];

    if (protein.structural_cluster_id) {
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
        LIMIT 100
      `, [protein.structural_cluster_id]);

      clusterMembers = membersResult.rows;
    }

    return NextResponse.json({
      protein,
      cluster_members: clusterMembers,
    });

  } catch (error) {
    console.error('Archaea Protein API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch protein detail',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
