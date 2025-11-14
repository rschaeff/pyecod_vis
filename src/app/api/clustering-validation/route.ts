/**
 * GET /api/clustering-validation
 *
 * Returns ECOD validation issues from clustering analysis
 * Shows cross-boundary pairs from same cluster but different T-groups
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get('severity') || 'all';
    const boundaryType = searchParams.get('boundary_type') || 'all';
    const pairType = searchParams.get('pair_type') || 'all';
    const repPairType = searchParams.get('rep_pair_type') || 'exclude_auto_auto'; // Default: exclude auto-auto
    const curationStatus = searchParams.get('curation_status') || 'uncurated'; // Default: show only uncurated
    const sortBy = searchParams.get('sort_by') || 'default';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '25');

    // Query clustering inconsistency pairs
    let sql = `
      SELECT
        ci.id,
        ci.cluster_representative,
        ci.domain1_ecod_id,
        ci.domain2_ecod_id,
        ci.domain1_ecod_uid,
        ci.domain2_ecod_uid,
        ci.domain1_f_id,
        ci.domain2_f_id,
        ci.domain1_h_id,
        ci.domain2_h_id,
        ci.domain1_x_id,
        ci.domain2_x_id,
        ci.domain1_t_id,
        ci.domain2_t_id,
        ci.boundary_type,
        ci.severity,
        ci.status,
        ci.curator_notes,
        ci.domain1_type,
        ci.domain2_type,
        ci.pair_type,
        ci.domain1_manual_rep,
        ci.domain1_provisional_rep,
        ci.domain2_manual_rep,
        ci.domain2_provisional_rep,
        ci.x1_name,
        ci.x2_name,
        dr1.range_definition as domain1_range,
        dr2.range_definition as domain2_range,
        fc1.name as f1_name,
        fc2.name as f2_name,
        fc1.pfam_acc as f1_pfam,
        fc2.pfam_acc as f2_pfam,
        hc1.name as h1_name,
        hc2.name as h2_name,
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
      FROM ecod_curation.clustering_inconsistency_pair ci
      LEFT JOIN ecod_commons.domains d1 ON ci.domain1_ecod_uid = d1.ecod_uid
      LEFT JOIN ecod_commons.domains d2 ON ci.domain2_ecod_uid = d2.ecod_uid
      LEFT JOIN ecod_commons.domain_ranges dr1 ON d1.id = dr1.domain_id AND dr1.is_primary = true
      LEFT JOIN ecod_commons.domain_ranges dr2 ON d2.id = dr2.domain_id AND dr2.is_primary = true
      LEFT JOIN ecod_curation.validation_curation vc
        ON ci.domain1_ecod_uid = vc.domain1_ecod_uid
       AND ci.domain2_ecod_uid = vc.domain2_ecod_uid
       AND vc.issue_type = 'clustering_inconsistency'
      LEFT JOIN ecod_curation.curator cur ON vc.curator_id = cur.id
      LEFT JOIN ecod_rep.cluster fc1 ON ci.domain1_f_id = fc1.id
      LEFT JOIN ecod_rep.cluster fc2 ON ci.domain2_f_id = fc2.id
      LEFT JOIN ecod_rep.cluster hc1 ON ci.domain1_h_id = hc1.id
      LEFT JOIN ecod_rep.cluster hc2 ON ci.domain2_h_id = hc2.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Filter by severity
    if (severity !== 'all') {
      params.push(severity);
      sql += ` AND ci.severity = $${params.length}`;
    }

    // Filter by boundary type
    if (boundaryType !== 'all') {
      params.push(boundaryType);
      sql += ` AND ci.boundary_type = $${params.length}`;
    }

    // Filter by pair type
    if (pairType !== 'all') {
      params.push(pairType);
      sql += ` AND ci.pair_type = $${params.length}`;
    }

    // Filter by representative pair type
    if (repPairType !== 'all') {
      const isManual = (d: string) => `(ci.${d}_manual_rep = true AND (ci.${d}_provisional_rep = false OR ci.${d}_provisional_rep IS NULL))`;
      const isProvisional = (d: string) => `(ci.${d}_provisional_rep = true)`;
      const isAutomatic = (d: string) => `((ci.${d}_manual_rep = false OR ci.${d}_manual_rep IS NULL) AND (ci.${d}_provisional_rep = false OR ci.${d}_provisional_rep IS NULL))`;

      switch (repPairType) {
        case 'exclude_auto_auto':
          // Exclude pairs where BOTH are automatic (i.e., at least one must be manual or provisional)
          sql += ` AND NOT (${isAutomatic('domain1')} AND ${isAutomatic('domain2')})`;
          break;
        case 'manual_manual':
          sql += ` AND ${isManual('domain1')} AND ${isManual('domain2')}`;
          break;
        case 'provisional_provisional':
          sql += ` AND ${isProvisional('domain1')} AND ${isProvisional('domain2')}`;
          break;
        case 'automatic_automatic':
          sql += ` AND ${isAutomatic('domain1')} AND ${isAutomatic('domain2')}`;
          break;
        case 'manual_provisional':
          sql += ` AND ((${isManual('domain1')} AND ${isProvisional('domain2')}) OR (${isProvisional('domain1')} AND ${isManual('domain2')}))`;
          break;
        case 'manual_automatic':
          sql += ` AND ((${isManual('domain1')} AND ${isAutomatic('domain2')}) OR (${isAutomatic('domain1')} AND ${isManual('domain2')}))`;
          break;
        case 'provisional_automatic':
          sql += ` AND ((${isProvisional('domain1')} AND ${isAutomatic('domain2')}) OR (${isAutomatic('domain1')} AND ${isProvisional('domain2')}))`;
          break;
        case 'has_manual':
          sql += ` AND (${isManual('domain1')} OR ${isManual('domain2')})`;
          break;
        case 'has_provisional':
          sql += ` AND (${isProvisional('domain1')} OR ${isProvisional('domain2')})`;
          break;
      }
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
    if (sortBy === 'alignment_length') {
      // For clustering, we don't have alignment length, so just order by severity
      sql += `
        ORDER BY
          CASE ci.severity
            WHEN 'medium' THEN 1
            WHEN 'low' THEN 2
            ELSE 3
          END
      `;
    } else {
      // Default: order by severity
      sql += `
        ORDER BY
          CASE ci.severity
            WHEN 'medium' THEN 1
            WHEN 'low' THEN 2
            ELSE 3
          END
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
      FROM ecod_curation.clustering_inconsistency_pair ci
      LEFT JOIN ecod_curation.validation_curation vc
        ON ci.domain1_ecod_uid = vc.domain1_ecod_uid
       AND ci.domain2_ecod_uid = vc.domain2_ecod_uid
       AND vc.issue_type = 'clustering_inconsistency'
      WHERE 1=1
    `;

    const statsParams: any[] = [];
    if (severity !== 'all') {
      statsParams.push(severity);
      statsSQL += ` AND ci.severity = $${statsParams.length}`;
    }
    if (boundaryType !== 'all') {
      statsParams.push(boundaryType);
      statsSQL += ` AND ci.boundary_type = $${statsParams.length}`;
    }
    if (pairType !== 'all') {
      statsParams.push(pairType);
      statsSQL += ` AND ci.pair_type = $${statsParams.length}`;
    }

    // Apply same rep_pair_type filter to stats
    if (repPairType !== 'all') {
      const isManual = (d: string) => `(ci.${d}_manual_rep = true AND (ci.${d}_provisional_rep = false OR ci.${d}_provisional_rep IS NULL))`;
      const isProvisional = (d: string) => `(ci.${d}_provisional_rep = true)`;
      const isAutomatic = (d: string) => `((ci.${d}_manual_rep = false OR ci.${d}_manual_rep IS NULL) AND (ci.${d}_provisional_rep = false OR ci.${d}_provisional_rep IS NULL))`;

      switch (repPairType) {
        case 'exclude_auto_auto':
          statsSQL += ` AND NOT (${isAutomatic('domain1')} AND ${isAutomatic('domain2')})`;
          break;
        case 'manual_manual':
          statsSQL += ` AND ${isManual('domain1')} AND ${isManual('domain2')}`;
          break;
        case 'provisional_provisional':
          statsSQL += ` AND ${isProvisional('domain1')} AND ${isProvisional('domain2')}`;
          break;
        case 'automatic_automatic':
          statsSQL += ` AND ${isAutomatic('domain1')} AND ${isAutomatic('domain2')}`;
          break;
        case 'manual_provisional':
          statsSQL += ` AND ((${isManual('domain1')} AND ${isProvisional('domain2')}) OR (${isProvisional('domain1')} AND ${isManual('domain2')}))`;
          break;
        case 'manual_automatic':
          statsSQL += ` AND ((${isManual('domain1')} AND ${isAutomatic('domain2')}) OR (${isAutomatic('domain1')} AND ${isManual('domain2')}))`;
          break;
        case 'provisional_automatic':
          statsSQL += ` AND ((${isProvisional('domain1')} AND ${isAutomatic('domain2')}) OR (${isAutomatic('domain1')} AND ${isProvisional('domain2')}))`;
          break;
        case 'has_manual':
          statsSQL += ` AND (${isManual('domain1')} OR ${isManual('domain2')})`;
          break;
        case 'has_provisional':
          statsSQL += ` AND (${isProvisional('domain1')} OR ${isProvisional('domain2')})`;
          break;
      }
    }

    // Apply same curation status filter to stats
    if (curationStatus === 'uncurated') {
      statsSQL += ` AND vc.id IS NULL`;
    } else if (curationStatus === 'curated') {
      statsSQL += ` AND vc.id IS NOT NULL`;
    } else if (curationStatus !== 'all') {
      statsParams.push(curationStatus);
      statsSQL += ` AND vc.curation_status = $${statsParams.length}`;
    }

    const statsResult = await query(statsSQL, statsParams);

    return NextResponse.json({
      issues: result.rows,
      stats: statsResult.rows[0],
    });

  } catch (error) {
    console.error('Clustering Validation API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch clustering validation issues',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
