/**
 * GET /api/cluster/[id]
 *
 * Returns all members of a cluster for a given protein (by source_id)
 *
 * Example: /api/cluster/8yl2_A
 * Returns all proteins in the same cluster as 8yl2_A
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;

    // First, get the protein and its cluster info
    const proteinResult = await query(`
      SELECT
        p.id,
        p.source_id,
        p.pdb_id,
        p.chain_id,
        cm.cluster_id,
        cm.cluster_rank,
        cm.is_representative
      FROM ecod_curation.protein p
      LEFT JOIN ecod_curation.cluster_membership cm ON p.id = cm.protein_id
      WHERE p.source_id = $1
    `, [sourceId]);

    if (proteinResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found' },
        { status: 404 }
      );
    }

    const protein = proteinResult.rows[0];
    const clusterId = protein.cluster_id;
    const clusterRank = protein.cluster_rank;

    // If not in a cluster, return just this protein
    if (!clusterId || !clusterRank) {
      return NextResponse.json({
        cluster_id: null,
        representative: sourceId,
        cluster_size: 1,
        members: [{
          source_id: protein.source_id,
          pdb_id: protein.pdb_id,
          chain_id: protein.chain_id,
          sequence_length: null,
          curation_status: null,
          sequence_identity_to_rep: 100,
          is_representative: true
        }]
      });
    }

    // Get all cluster members (same cluster_id AND cluster_rank)
    const membersResult = await query(`
      SELECT
        p.source_id,
        p.pdb_id,
        p.chain_id,
        p.sequence_length,
        p.curation_status,
        cm.is_representative,
        cm.sequence_identity_to_rep
      FROM ecod_curation.cluster_membership cm
      JOIN ecod_curation.protein p ON cm.protein_id = p.id
      WHERE cm.cluster_id = $1
        AND cm.cluster_rank = $2
      ORDER BY
        cm.is_representative DESC,
        cm.sequence_identity_to_rep DESC NULLS LAST,
        p.source_id
    `, [clusterId, clusterRank]);

    // Find the representative
    const representative = membersResult.rows.find(m => m.is_representative);

    return NextResponse.json({
      cluster_id: clusterId,
      representative: representative?.source_id || sourceId,
      cluster_size: membersResult.rows.length,
      members: membersResult.rows
    });

  } catch (error) {
    console.error('Cluster API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cluster members',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
