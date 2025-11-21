/**
 * GET /api/protein/:id
 *
 * Returns detailed protein information including:
 * - Basic protein metadata
 * - Domain assignments with boundaries
 * - Evidence for each domain
 * - Cluster membership information
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Protein, Domain, Evidence, ClusterMember } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sourceId = id;

    // 1. Get protein details
    const proteinResult = await query<Protein>(`
      SELECT
        p.id,
        p.source_id,
        p.pdb_id,
        p.chain_id,
        p.sequence,
        p.sequence_length,
        p.partition_coverage,
        p.domain_count,
        p.partition_quality,
        p.curation_status,
        p.curation_source,
        p.release_date::text,
        p.processed_at::text
      FROM ecod_curation.protein p
      WHERE p.source_id = $1
    `, [sourceId]);

    if (proteinResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found' },
        { status: 404 }
      );
    }

    const protein = proteinResult.rows[0];

    // 2. Get domains for this protein
    const domainsResult = await query<Domain>(`
      SELECT
        da.id,
        da.protein_id,
        da.domain_number,
        da.start_pos,
        da.end_pos,
        da.residue_range,
        da.automated_start_pos,
        da.automated_end_pos,
        da.automated_range_string,
        da.assigned_t_group,
        da.assigned_h_group,
        da.assigned_x_group,
        da.assigned_f_group,
        da.best_match_ecod_uid,
        da.assignment_method,
        da.classification_level,
        da.confidence,
        da.curator_decision,
        da.curator_name,
        da.curated_at::text
      FROM ecod_curation.domain_assignment da
      WHERE da.protein_id = $1
      ORDER BY da.domain_number
    `, [protein.id]);

    const domains = domainsResult.rows;

    // 3. Get evidence for all domains
    const domainIds = domains.map(d => d.id);

    let evidenceByDomain: { [key: number]: Evidence[] } = {};

    if (domainIds.length > 0) {
      const evidenceResult = await query<Evidence>(`
        SELECT
          de.id,
          de.domain_id,
          de.evidence_type,
          de.hit_ecod_domain_id,
          de.hit_ecod_uid,
          de.hit_pdb_id,
          de.hit_chain_id,
          de.evalue,
          de.score,
          de.identity,
          de.similarity,
          de.query_coverage,
          de.hit_coverage,
          de.query_range,
          de.hit_range,
          de.ref_t_group,
          de.ref_h_group,
          de.ref_x_group,
          de.ref_f_group,
          de.source_file
        FROM ecod_curation.domain_evidence de
        WHERE de.domain_id = ANY($1)
        ORDER BY de.domain_id, de.evalue
      `, [domainIds]);

      // Group evidence by domain_id
      evidenceResult.rows.forEach(ev => {
        if (!evidenceByDomain[ev.domain_id]) {
          evidenceByDomain[ev.domain_id] = [];
        }
        evidenceByDomain[ev.domain_id].push(ev);
      });
    }

    // 4. Attach evidence to domains
    const domainsWithEvidence = domains.map(domain => ({
      ...domain,
      evidence: evidenceByDomain[domain.id] || []
    }));

    // 5. Get cluster membership info
    const clusterResult = await query<{
      cluster_size: number;
      cluster_name: string;
      is_representative: boolean;
      representative_source_id: string;
    }>(`
      SELECT
        sc.cluster_name,
        cm.is_representative,
        prep.source_id as representative_source_id,
        (
          SELECT COUNT(*)
          FROM ecod_curation.cluster_membership cm2
          WHERE cm2.representative_protein_id = cm.representative_protein_id
        ) as cluster_size
      FROM ecod_curation.cluster_membership cm
      JOIN ecod_curation.sequence_cluster sc ON cm.cluster_id = sc.id
      LEFT JOIN ecod_curation.protein prep ON cm.representative_protein_id = prep.id
      WHERE cm.protein_id = $1
    `, [protein.id]);

    let clusterInfo = null;
    let clusterMembers: ClusterMember[] = [];

    if (clusterResult.rows.length > 0) {
      const cluster = clusterResult.rows[0];
      clusterInfo = {
        cluster_name: cluster.cluster_name,
        cluster_size: cluster.cluster_size,
        is_representative: cluster.is_representative,
        representative_source_id: cluster.representative_source_id
      };

      // If this protein is a representative, get cluster members
      if (cluster.is_representative) {
        const membersResult = await query<ClusterMember>(`
          SELECT
            cmd.member_protein_id,
            cmd.member_source_id,
            cmd.member_status,
            cmd.sequence_identity_to_rep
          FROM ecod_curation.cluster_members_detail cmd
          WHERE cmd.representative_source_id = $1
            AND cmd.is_representative = false
          ORDER BY cmd.sequence_identity_to_rep DESC
        `, [sourceId]);

        clusterMembers = membersResult.rows;
      }
    }

    return NextResponse.json({
      protein: {
        ...protein,
        cluster_info: clusterInfo,
        cluster_members: clusterMembers
      },
      domains: domainsWithEvidence
    });

  } catch (error) {
    console.error('Protein API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch protein details',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
