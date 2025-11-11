/**
 * POST /api/validation/curate
 *
 * Create or update curation decision for a validation issue
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const sessionInfo = await getCurrentSession();

    if (!sessionInfo) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const curator = sessionInfo.curator;

    // Parse request body
    const body = await request.json();
    const {
      domain1_uid,
      domain2_uid,
      issue_type = 'cross_boundary',
      status,
      action,
      notes,
      priority = 0,
      severity_override,
    } = body;

    // Validate required fields
    if (!domain1_uid || !domain2_uid || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: domain1_uid, domain2_uid, status' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['reviewed', 'false_positive', 'flagged', 'resolved'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate action if provided
    if (action) {
      const validActions = [
        'no_action', 'merge_hgroups', 'split_hgroup', 'reclassify_domain1',
        'reclassify_domain2', 'reclassify_both', 'investigate_structure', 'check_alignment',
        'false_positive', 'other'
      ];
      if (!validActions.includes(action)) {
        return NextResponse.json(
          { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Get original issue data for historical tracking
    const issueResult = await query(
      `SELECT
        sequence_identity,
        domain1_h_id as h_group_1,
        domain2_h_id as h_group_2,
        domain1_f_id as f_group_1,
        domain2_f_id as f_group_2
       FROM ecod_curation.cross_boundary_pair
       WHERE domain1_ecod_uid = $1 AND domain2_ecod_uid = $2`,
      [domain1_uid, domain2_uid]
    );

    const originalData = issueResult.rows[0] || {};

    // Insert or update curation record
    const result = await query(
      `INSERT INTO ecod_curation.validation_curation (
        domain1_ecod_uid,
        domain2_ecod_uid,
        issue_type,
        curator_id,
        curation_status,
        curation_action,
        notes,
        priority,
        severity_override,
        original_sequence_identity,
        original_h_group_1,
        original_h_group_2,
        original_f_group_1,
        original_f_group_2
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (domain1_ecod_uid, domain2_ecod_uid, issue_type)
      DO UPDATE SET
        curator_id = EXCLUDED.curator_id,
        curation_status = EXCLUDED.curation_status,
        curation_action = EXCLUDED.curation_action,
        notes = EXCLUDED.notes,
        priority = EXCLUDED.priority,
        severity_override = EXCLUDED.severity_override,
        updated_at = NOW()
      RETURNING
        id,
        domain1_ecod_uid,
        domain2_ecod_uid,
        issue_type,
        curation_status,
        curation_action,
        notes,
        priority,
        severity_override,
        curated_at,
        updated_at`,
      [
        domain1_uid,
        domain2_uid,
        issue_type,
        curator.id,
        status,
        action || null,
        notes || null,
        priority,
        severity_override || null,
        originalData.sequence_identity || null,
        originalData.h_group_1 || null,
        originalData.h_group_2 || null,
        originalData.f_group_1 || null,
        originalData.f_group_2 || null,
      ]
    );

    const curation = result.rows[0];

    return NextResponse.json({
      success: true,
      curation: {
        ...curation,
        curator: {
          id: curator.id,
          username: curator.username,
          display_name: curator.display_name,
        },
      },
    });

  } catch (error) {
    console.error('Curation API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save curation',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
