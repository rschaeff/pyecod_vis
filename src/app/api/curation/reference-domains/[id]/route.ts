/**
 * GET /api/curation/reference-domains/:id
 *
 * Returns detailed information for a specific ECOD reference domain,
 * including classification, usage stats, and attracted Pfam families.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface AttractedPfam {
  pfam_acc: string;
  pfam_name: string;
  expected_t_group: string | null;
  domain_count: number;
  avg_dpam: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ecodDomainId = id;

    // 1. Get domain basic info and classification
    // Note: ecod_rep.domain uses t_id/f_id, ecod_rep.cluster.id is dom_cid type
    const domainResult = await query(`
      SELECT
        d.ecod_domain_id,
        d.ecod_uid,
        SUBSTRING(d.ecod_domain_id FROM 2 FOR 4) as pdb_id,
        d.chain_id as chain,
        dr.range_definition as pdb_range,
        d.seqid_range,
        ds.sequence,
        LENGTH(ds.sequence) as sequence_length,
        d.t_id as t_group,
        d.f_id as f_group,
        d.manual_rep as is_manual_rep,
        tc.name as t_group_name,
        tc.parent as h_group_id,
        hc.name as h_group_name,
        hc.parent as x_group_id,
        xc.name as x_group_name,
        fc.name as f_group_name,
        fc.pfam_acc as f_pfam_acc
      FROM ecod_rep.domain d
      LEFT JOIN ecod_commons.domain_ranges dr ON d.ecod_uid = dr.domain_id AND dr.is_primary = true
      LEFT JOIN ecod_commons.domain_sequences ds ON d.ecod_uid = ds.domain_id
      LEFT JOIN ecod_rep.cluster tc ON d.t_id::dom_cid = tc.id AND tc.type = 'T'
      LEFT JOIN ecod_rep.cluster hc ON tc.parent = hc.id AND hc.type = 'H'
      LEFT JOIN ecod_rep.cluster xc ON hc.parent = xc.id AND xc.type = 'X'
      LEFT JOIN ecod_rep.cluster fc ON d.f_id::dom_cid = fc.id AND fc.type = 'F'
      WHERE d.ecod_domain_id = $1
    `, [ecodDomainId]);

    if (domainResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Reference domain not found' },
        { status: 404 }
      );
    }

    const domain = domainResult.rows[0];

    // 2. Get usage statistics from swissprot.domain
    const usageResult = await query(`
      SELECT
        COUNT(*) as total_uses,
        SUM(CASE WHEN judge = 'good_domain' THEN 1 ELSE 0 END) as good_domain_count,
        SUM(CASE WHEN judge = 'low_confidence' THEN 1 ELSE 0 END) as low_confidence_count,
        SUM(CASE WHEN judge = 'simple_topology' THEN 1 ELSE 0 END) as simple_topology_count,
        SUM(CASE WHEN judge = 'partial_domain' THEN 1 ELSE 0 END) as partial_domain_count,
        ROUND(AVG(dpam_prob), 3) as avg_dpam_prob,
        ROUND(AVG(hh_prob), 3) as avg_hh_prob,
        SUM(CASE WHEN dpam_prob >= 0.7 AND dpam_prob < 0.8 THEN 1 ELSE 0 END) as dpam_07_08,
        SUM(CASE WHEN dpam_prob >= 0.8 AND dpam_prob < 0.9 THEN 1 ELSE 0 END) as dpam_08_09,
        SUM(CASE WHEN dpam_prob >= 0.9 THEN 1 ELSE 0 END) as dpam_09_10
      FROM swissprot.domain
      WHERE hit_ecod_domain_id = $1
    `, [ecodDomainId]);

    const usage = usageResult.rows[0] || {
      total_uses: 0,
      good_domain_count: 0,
      low_confidence_count: 0,
      simple_topology_count: 0,
      partial_domain_count: 0,
      avg_dpam_prob: 0,
      avg_hh_prob: 0,
      dpam_07_08: 0,
      dpam_08_09: 0,
      dpam_09_10: 0
    };

    // 3. Get attracted Pfam families (from low-confidence assignments)
    // Note: swissprot.domain doesn't have pfam columns, so we return empty for now
    // In future, could join through domain_pfam_hits or similar table
    const attractedResult = { rows: [] as AttractedPfam[] };

    // 4. Get representative status
    // Note: rep_domain_id doesn't exist in cluster table, using manual_rep from domain
    const repStatus = {
      is_manual_rep: domain.is_manual_rep || false,
      is_f_rep: false,
      is_t_rep: false,
      is_h_rep: false
    };

    // 5. Get family context (F-group size, T-group size)
    const familyContextResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM ecod_rep.domain WHERE f_id = $1) as f_group_size,
        (SELECT COUNT(*) FROM ecod_rep.domain WHERE t_id = $2) as t_group_size
    `, [domain.f_group, domain.t_group]);

    const familyContext = familyContextResult.rows[0] || {
      f_group_size: 0,
      t_group_size: 0
    };

    return NextResponse.json({
      ecod_domain_id: domain.ecod_domain_id,
      ecod_uid: domain.ecod_uid,
      pdb_id: domain.pdb_id,
      chain: domain.chain,
      pdb_range: domain.pdb_range,
      seqid_range: domain.seqid_range,
      sequence: domain.sequence,
      sequence_length: parseInt(domain.sequence_length) || 0,

      classification: {
        x_group: {
          id: domain.x_group_id,
          name: domain.x_group_name
        },
        h_group: {
          id: domain.h_group_id,
          name: domain.h_group_name
        },
        t_group: {
          id: domain.t_group,
          name: domain.t_group_name
        },
        f_group: {
          id: domain.f_group,
          name: domain.f_group_name,
          pfam: domain.f_pfam_acc
        }
      },

      representative_status: {
        is_manual_rep: repStatus.is_manual_rep || false,
        is_f_rep: repStatus.is_f_rep || false,
        is_t_rep: repStatus.is_t_rep || false,
        is_h_rep: repStatus.is_h_rep || false
      },

      usage_stats: {
        total_swissprot_uses: parseInt(usage.total_uses) || 0,
        by_judge: {
          good_domain: parseInt(usage.good_domain_count) || 0,
          low_confidence: parseInt(usage.low_confidence_count) || 0,
          simple_topology: parseInt(usage.simple_topology_count) || 0,
          partial_domain: parseInt(usage.partial_domain_count) || 0
        },
        avg_dpam_prob: parseFloat(usage.avg_dpam_prob) || 0,
        avg_hh_prob: parseFloat(usage.avg_hh_prob) || 0,
        dpam_prob_distribution: {
          '0.7-0.8': parseInt(usage.dpam_07_08) || 0,
          '0.8-0.9': parseInt(usage.dpam_08_09) || 0,
          '0.9-1.0': parseInt(usage.dpam_09_10) || 0
        }
      },

      attracted_pfams: attractedResult.rows.map(ap => ({
        pfam_acc: ap.pfam_acc,
        pfam_name: ap.pfam_name,
        expected_t_group: ap.expected_t_group,
        domain_count: parseInt(String(ap.domain_count)),
        avg_dpam: parseFloat(String(ap.avg_dpam))
      })),

      family_context: {
        f_group_size: parseInt(familyContext.f_group_size) || 0,
        t_group_size: parseInt(familyContext.t_group_size) || 0
      },

      structure_url: `/api/structure/${ecodDomainId}`,
      cif_url: `https://files.rcsb.org/download/${domain.pdb_id}.cif`
    });

  } catch (error) {
    console.error('Reference Domain Detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch reference domain details',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
