/**
 * GET /api/validation
 *
 * Returns ECOD validation issues from ecod_rep analysis
 * Shows cross-boundary pairs with high sequence/structural similarity
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get('severity') || 'all';
    const boundaryType = searchParams.get('boundary_type') || 'all';
    const pairType = searchParams.get('pair_type') || 'all';
    const coverageFilter = searchParams.get('coverage_filter') || 'all';
    const curationStatus = searchParams.get('curation_status') || 'uncurated'; // Default: show only uncurated
    const sortBy = searchParams.get('sort_by') || 'default';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '25');

    // Query cross-boundary pairs
    let sql = `
      SELECT
        cb.id,
        cb.domain1_ecod_id,
        cb.domain2_ecod_id,
        cb.domain1_ecod_uid,
        cb.domain2_ecod_uid,
        cb.domain1_f_id,
        cb.domain2_f_id,
        cb.domain1_h_id,
        cb.domain2_h_id,
        cb.domain1_x_id,
        cb.domain2_x_id,
        cb.pfam_acc,
        cb.sequence_identity,
        cb.alignment_length,
        cb.evalue,
        cb.boundary_type,
        cb.severity,
        cb.recommendation,
        cb.status,
        cb.curator_notes,
        cb.domain1_type,
        cb.domain2_type,
        cb.pair_type,
        cb.domain1_manual_rep,
        cb.domain1_provisional_rep,
        cb.domain2_manual_rep,
        cb.domain2_provisional_rep,
        cb.domain1_nonrep_count,
        cb.domain2_nonrep_count,
        cb.query_length,
        cb.target_length,
        ROUND(100.0 * cb.alignment_length / NULLIF(cb.query_length, 0), 1) as query_coverage,
        ROUND(100.0 * cb.alignment_length / NULLIF(cb.target_length, 0), 1) as target_coverage,
        cb.query_aligned,
        cb.target_aligned,
        d1.pdb_range as domain1_range,
        d2.pdb_range as domain2_range,
        fc1.name as f1_name,
        fc2.name as f2_name,
        fc1.pfam_acc as f1_pfam,
        fc2.pfam_acc as f2_pfam,
        hc1.name as h1_name,
        hc2.name as h2_name,
        cb.x1_name,
        cb.x2_name,
        vc.id as curation_id,
        vc.curation_status,
        vc.curation_action,
        vc.notes as curation_notes,
        vc.priority as curation_priority,
        vc.curated_at,
        vc.updated_at as curation_updated_at,
        cur.id as curator_id,
        cur.username as curator_username,
        cur.display_name as curator_display_name
      FROM ecod_curation.cross_boundary_pair cb
      LEFT JOIN ecod_rep.domain d1 ON cb.domain1_ecod_uid = d1.ecod_uid
      LEFT JOIN ecod_rep.domain d2 ON cb.domain2_ecod_uid = d2.ecod_uid
      LEFT JOIN ecod_curation.validation_curation vc
        ON cb.domain1_ecod_uid = vc.domain1_ecod_uid
       AND cb.domain2_ecod_uid = vc.domain2_ecod_uid
       AND vc.issue_type = 'cross_boundary'
      LEFT JOIN ecod_curation.curator cur ON vc.curator_id = cur.id
      LEFT JOIN ecod_rep.cluster fc1 ON cb.domain1_f_id = fc1.id
      LEFT JOIN ecod_rep.cluster fc2 ON cb.domain2_f_id = fc2.id
      LEFT JOIN ecod_rep.cluster tc1 ON d1.t_id = tc1.id
      LEFT JOIN ecod_rep.cluster tc2 ON d2.t_id = tc2.id
      LEFT JOIN ecod_rep.cluster hc1 ON tc1.parent = hc1.id
      LEFT JOIN ecod_rep.cluster hc2 ON tc2.parent = hc2.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Filter by severity
    if (severity !== 'all') {
      params.push(severity);
      sql += ` AND cb.severity = $${params.length}`;
    }

    // Filter by boundary type
    if (boundaryType !== 'all') {
      params.push(boundaryType);
      sql += ` AND cb.boundary_type = $${params.length}`;
    }

    // Filter by pair type
    if (pairType !== 'all') {
      params.push(pairType);
      sql += ` AND cb.pair_type = $${params.length}`;
    }

    // Filter by coverage
    if (coverageFilter === 'both_high') {
      sql += ` AND (100.0 * cb.alignment_length / NULLIF(cb.query_length, 0)) >= 80
               AND (100.0 * cb.alignment_length / NULLIF(cb.target_length, 0)) >= 80`;
    } else if (coverageFilter === 'either_high') {
      sql += ` AND ((100.0 * cb.alignment_length / NULLIF(cb.query_length, 0)) >= 80
               OR (100.0 * cb.alignment_length / NULLIF(cb.target_length, 0)) >= 80)`;
    } else if (coverageFilter === 'low_coverage') {
      sql += ` AND ((100.0 * cb.alignment_length / NULLIF(cb.query_length, 0)) < 80
               OR (100.0 * cb.alignment_length / NULLIF(cb.target_length, 0)) < 80)`;
    }

    // Filter by curation status
    if (curationStatus === 'uncurated') {
      sql += ` AND vc.id IS NULL`; // No curation record exists
    } else if (curationStatus === 'curated') {
      sql += ` AND vc.id IS NOT NULL`; // Any curation record exists
    } else if (curationStatus !== 'all') {
      // Filter by specific curation status
      params.push(curationStatus);
      sql += ` AND vc.curation_status = $${params.length}`;
    }

    // Order by sorting preference
    if (sortBy === 'total_nonreps') {
      sql += `
        ORDER BY
          (cb.domain1_nonrep_count + cb.domain2_nonrep_count) DESC,
          cb.sequence_identity DESC
      `;
    } else if (sortBy === 'alignment_length') {
      sql += `
        ORDER BY
          cb.alignment_length DESC,
          cb.sequence_identity DESC
      `;
    } else {
      // Default: order by severity and sequence identity
      sql += `
        ORDER BY
          CASE cb.severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          cb.sequence_identity DESC
      `;
    }

    // Add pagination
    const offset = (page - 1) * pageSize;
    sql += `
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    params.push(pageSize, offset);

    const result = await query(sql, params);

    // Get statistics with same filters
    let statsSQL = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE severity = 'low') as low,
        COUNT(*) FILTER (WHERE boundary_type = 'cross_x') as cross_x,
        COUNT(*) FILTER (WHERE boundary_type = 'cross_h') as cross_h,
        COUNT(*) FILTER (WHERE boundary_type = 'cross_f') as cross_f,
        COUNT(*) FILTER (WHERE pair_type = 'pdb_pdb') as pdb_pdb,
        COUNT(*) FILTER (WHERE pair_type = 'afdb_afdb') as afdb_afdb,
        COUNT(*) FILTER (WHERE pair_type = 'pdb_afdb') as pdb_afdb,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
        COUNT(*) FILTER (WHERE vc.id IS NULL) as uncurated,
        COUNT(*) FILTER (WHERE vc.id IS NOT NULL) as curated,
        COUNT(*) FILTER (WHERE vc.curation_status = 'flagged') as curated_flagged,
        COUNT(*) FILTER (WHERE vc.curation_status = 'dismissed') as curated_dismissed,
        COUNT(*) FILTER (WHERE vc.curation_status = 'action_planned') as curated_action_planned
      FROM ecod_curation.cross_boundary_pair cb
      LEFT JOIN ecod_curation.validation_curation vc
        ON cb.domain1_ecod_uid = vc.domain1_ecod_uid
       AND cb.domain2_ecod_uid = vc.domain2_ecod_uid
       AND vc.issue_type = 'cross_boundary'
      WHERE 1=1
    `;

    const statsParams: any[] = [];
    if (severity !== 'all') {
      statsParams.push(severity);
      statsSQL += ` AND cb.severity = $${statsParams.length}`;
    }
    if (boundaryType !== 'all') {
      statsParams.push(boundaryType);
      statsSQL += ` AND cb.boundary_type = $${statsParams.length}`;
    }
    if (pairType !== 'all') {
      statsParams.push(pairType);
      statsSQL += ` AND cb.pair_type = $${statsParams.length}`;
    }

    const statsResult = await query(statsSQL, statsParams);

    return NextResponse.json({
      issues: result.rows,
      stats: statsResult.rows[0],
    });

  } catch (error) {
    console.error('Validation API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch validation issues',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
