/**
 * GET /api/curation/novel-candidates/export
 *
 * Exports all novel candidate domains for collaborator analysis.
 * Returns TSV or JSON format with all domain data.
 *
 * Query params:
 *   format: 'tsv' (default) or 'json'
 *   classification: filter by LDDT classification (optional)
 *   min_size: minimum cluster size (default: 2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ExportDomain {
  cluster_name: string;
  cluster_size: number;
  lddt_classification: string;
  xgroup_consistency: number | null;
  unp_acc: string;
  domain_range: string;
  domain_length: number | null;
  is_representative: boolean;
  plddt: number | null;
  best_ecod_lddt: number | null;
  best_ecod_xgroup: string | null;
  best_ecod_tgroup: string | null;
  helix_pct: number | null;
  strand_pct: number | null;
  coil_pct: number | null;
  ted_id: string | null;
  ted_chopping: string | null;
  ted_jaccard: number | null;
  ted_cath_label: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const classification = searchParams.get('classification') || 'all';
    const minSize = parseInt(searchParams.get('min_size') || '2');

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (minSize > 2) {
      conditions.push(`nc.member_count >= $${paramIdx++}`);
      params.push(minSize);
    }

    if (classification !== 'all') {
      conditions.push(`nc.lddt_classification = $${paramIdx++}`);
      params.push(classification);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query all domains with cluster info
    const sql = `
      SELECT
        nc.cluster_name,
        nc.member_count as cluster_size,
        COALESCE(nc.lddt_classification, 'NOVEL') as lddt_classification,
        nc.xgroup_consistency,
        nm.unp_acc,
        nm.domain_range,
        nm.sequence_length as domain_length,
        nm.is_representative,
        nm.plddt,
        nm.best_ecod_lddt,
        nm.best_ecod_xgroup,
        nm.best_ecod_tgroup,
        nm.helix_pct,
        nm.strand_pct,
        nm.coil_pct,
        nm.ted_id,
        nm.ted_chopping,
        nm.ted_jaccard,
        nm.ted_cath_label
      FROM ecod_curation.novel_candidate_cluster nc
      JOIN ecod_curation.novel_candidate_member nm ON nc.id = nm.cluster_id
      ${whereClause}
      ORDER BY nc.member_count DESC, nc.cluster_name, nm.is_representative DESC, nm.unp_acc
    `;

    const result = await query<ExportDomain>(sql, params);

    // Format response
    if (format === 'json') {
      return NextResponse.json({
        count: result.rows.length,
        domains: result.rows.map(d => ({
          ...d,
          xgroup_consistency: d.xgroup_consistency ? parseFloat(String(d.xgroup_consistency)) : null,
          plddt: d.plddt ? parseFloat(String(d.plddt)) : null,
          best_ecod_lddt: d.best_ecod_lddt ? parseFloat(String(d.best_ecod_lddt)) : null,
          helix_pct: d.helix_pct ? parseFloat(String(d.helix_pct)) : null,
          strand_pct: d.strand_pct ? parseFloat(String(d.strand_pct)) : null,
          coil_pct: d.coil_pct ? parseFloat(String(d.coil_pct)) : null,
          ted_jaccard: d.ted_jaccard ? parseFloat(String(d.ted_jaccard)) : null,
        }))
      });
    }

    // TSV format (default)
    const headers = [
      'cluster_name',
      'cluster_size',
      'lddt_classification',
      'xgroup_consistency',
      'unp_acc',
      'domain_range',
      'domain_length',
      'is_representative',
      'plddt',
      'best_ecod_lddt',
      'best_ecod_xgroup',
      'best_ecod_tgroup',
      'helix_pct',
      'strand_pct',
      'coil_pct',
      'ted_id',
      'ted_chopping',
      'ted_jaccard',
      'ted_cath_label'
    ];

    const rows = result.rows.map(d => [
      d.cluster_name,
      d.cluster_size,
      d.lddt_classification,
      d.xgroup_consistency ?? '',
      d.unp_acc,
      d.domain_range,
      d.domain_length ?? '',
      d.is_representative ? '1' : '0',
      d.plddt ?? '',
      d.best_ecod_lddt ?? '',
      d.best_ecod_xgroup ?? '',
      d.best_ecod_tgroup ?? '',
      d.helix_pct ?? '',
      d.strand_pct ?? '',
      d.coil_pct ?? '',
      d.ted_id ?? '',
      d.ted_chopping ?? '',
      d.ted_jaccard ?? '',
      d.ted_cath_label ?? ''
    ].join('\t'));

    const tsv = [headers.join('\t'), ...rows].join('\n');

    return new NextResponse(tsv, {
      headers: {
        'Content-Type': 'text/tab-separated-values',
        'Content-Disposition': 'attachment; filename="novel_candidates_domains.tsv"'
      }
    });

  } catch (error) {
    console.error('Novel Candidates Export API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export novel candidates',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
