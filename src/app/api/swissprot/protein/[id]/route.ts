/**
 * GET /api/swissprot/protein/:id
 *
 * Returns detailed SwissProt protein information including:
 * - Basic protein metadata (UniProt accession, domain range, scores)
 * - Cluster information
 * - Cluster members
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface SwissProtProtein {
  id: number;
  source_id: string;
  unp_acc: string;
  domain_range: string;
  sequence: string;
  sequence_length: number;
  plddt: number;
  dpam_prob: number;
  hh_prob: number;
  assigned_t_group: string | null;
  t_group_name: string | null;
  cluster_id: number;
  cluster_size: number;
  curation_status: string;
  curator_decision: string;
  curator_name: string;
  curator_notes: string;
  curated_at: string;
}

interface ClusterMember {
  domain_id: string;
  unp_acc: string;
  is_representative: boolean;
  plddt: number;
  dpam_prob: number;
  hh_prob: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sourceId = id;

    // 1. Get protein details with T-group name
    const proteinResult = await query<SwissProtProtein>(`
      SELECT
        sp.id,
        sp.source_id,
        sp.unp_acc,
        sp.domain_range,
        sp.sequence,
        sp.sequence_length,
        sp.plddt,
        sp.dpam_prob,
        sp.hh_prob,
        sp.assigned_t_group,
        tc.name as t_group_name,
        sp.cluster_id,
        sp.cluster_size,
        sp.curation_status,
        sp.curator_decision,
        sp.curator_name,
        sp.curator_notes,
        sp.curated_at::text
      FROM ecod_curation.swissprot_protein sp
      LEFT JOIN ecod_rep.cluster tc ON sp.assigned_t_group = tc.id AND tc.type = 'T'
      WHERE sp.source_id = $1
    `, [sourceId]);

    if (proteinResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'SwissProt protein not found' },
        { status: 404 }
      );
    }

    const protein = proteinResult.rows[0];

    // 2. Get cluster info
    const clusterResult = await query(`
      SELECT
        sc.id,
        sc.cluster_id as cluster_name,
        sc.member_count,
        sc.representative_domain_id,
        sc.avg_plddt,
        sc.avg_dpam,
        sc.avg_hh
      FROM ecod_curation.swissprot_cluster sc
      WHERE sc.id = $1
    `, [protein.cluster_id]);

    const clusterInfo = clusterResult.rows.length > 0 ? clusterResult.rows[0] : null;

    // 3. Get cluster members
    let clusterMembers: ClusterMember[] = [];

    if (clusterInfo) {
      const membersResult = await query<ClusterMember>(`
        SELECT
          scm.domain_id,
          scm.unp_acc,
          scm.is_representative,
          scm.plddt,
          scm.dpam_prob,
          scm.hh_prob
        FROM ecod_curation.swissprot_cluster_member scm
        WHERE scm.cluster_id = $1
        ORDER BY scm.is_representative DESC, scm.dpam_prob DESC
      `, [protein.cluster_id]);

      clusterMembers = membersResult.rows;
    }

    // 4. Parse domain range into segments for visualization
    const domainSegments = parseRange(protein.domain_range);

    return NextResponse.json({
      protein: {
        ...protein,
        domain_segments: domainSegments,
        cluster_info: clusterInfo,
        cluster_members: clusterMembers
      }
    });

  } catch (error) {
    console.error('SwissProt Protein API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch SwissProt protein details',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Parse domain range string into segments
 * e.g., "6-35,51-135" -> [{start: 6, end: 35}, {start: 51, end: 135}]
 */
function parseRange(rangeStr: string | null): Array<{start: number, end: number}> {
  if (!rangeStr) return [];

  const segments: Array<{start: number, end: number}> = [];

  for (const part of rangeStr.split(',')) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        segments.push({ start, end });
      }
    }
  }

  return segments;
}
