/**
 * POST /api/curation/reference-domains/:id/action
 *
 * Records a curation action for a reference domain.
 * Actions include: mask_from_search, remove, reclassify, flag_review
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

interface CurationActionRequest {
  action: 'mask_from_search' | 'remove' | 'reclassify' | 'flag_review';
  reason: string;
  new_classification?: {
    t_group?: string;
    f_group?: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ecodDomainId = id;

    // Get curator from session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('ecod_session')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify session and get curator
    const sessionResult = await query(`
      SELECT c.id, c.username, c.display_name
      FROM ecod_curation.curator_sessions cs
      JOIN ecod_curation.curators c ON cs.curator_id = c.id
      WHERE cs.session_id = $1 AND cs.expires_at > NOW()
    `, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const curator = sessionResult.rows[0];

    // Parse request body
    const body: CurationActionRequest = await request.json();

    if (!body.action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    const validActions = ['mask_from_search', 'remove', 'reclassify', 'flag_review'];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Reason is required' },
        { status: 400 }
      );
    }

    // Verify domain exists
    const domainResult = await query(`
      SELECT
        d.ecod_domain_id,
        d.t_id as t_group,
        d.f_id as f_group
      FROM ecod_rep.domain d
      WHERE d.ecod_domain_id = $1
    `, [ecodDomainId]);

    if (domainResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Reference domain not found' },
        { status: 404 }
      );
    }

    const domain = domainResult.rows[0];

    // For reclassify, validate new_classification
    if (body.action === 'reclassify') {
      if (!body.new_classification || (!body.new_classification.t_group && !body.new_classification.f_group)) {
        return NextResponse.json(
          { error: 'new_classification with t_group or f_group is required for reclassify action' },
          { status: 400 }
        );
      }
    }

    // Prepare old and new classification for logging
    const oldClassification = {
      t_group: domain.t_group,
      f_group: domain.f_group
    };

    const newClassification = body.action === 'reclassify' ? body.new_classification : null;

    // Insert action into reference_domain_actions table
    // First, ensure the table exists (create if not)
    await query(`
      CREATE TABLE IF NOT EXISTS ecod_curation.reference_domain_actions (
        id SERIAL PRIMARY KEY,
        ecod_domain_id VARCHAR(20) NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_classification JSONB,
        new_classification JSONB,
        reason TEXT,
        curator VARCHAR(50),
        curator_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index if not exists
    await query(`
      CREATE INDEX IF NOT EXISTS idx_ref_domain_actions_domain
      ON ecod_curation.reference_domain_actions(ecod_domain_id)
    `);

    // Insert the action
    const insertResult = await query(`
      INSERT INTO ecod_curation.reference_domain_actions
        (ecod_domain_id, action, old_classification, new_classification, reason, curator, curator_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `, [
      ecodDomainId,
      body.action,
      JSON.stringify(oldClassification),
      newClassification ? JSON.stringify(newClassification) : null,
      body.reason.trim(),
      curator.username,
      curator.id
    ]);

    const actionRecord = insertResult.rows[0];

    // Return success response
    return NextResponse.json({
      success: true,
      action_id: actionRecord.id,
      ecod_domain_id: ecodDomainId,
      action: body.action,
      reason: body.reason,
      curator: curator.display_name,
      created_at: actionRecord.created_at,
      message: getActionMessage(body.action, ecodDomainId)
    });

  } catch (error) {
    console.error('Curation Action API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to record curation action',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

function getActionMessage(action: string, domainId: string): string {
  switch (action) {
    case 'mask_from_search':
      return `Domain ${domainId} has been flagged for masking from DPAM search libraries`;
    case 'remove':
      return `Domain ${domainId} has been flagged for removal from ECOD`;
    case 'reclassify':
      return `Domain ${domainId} has been flagged for reclassification`;
    case 'flag_review':
      return `Domain ${domainId} has been flagged for further review`;
    default:
      return `Action recorded for domain ${domainId}`;
  }
}

// GET endpoint to retrieve action history for a domain
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ecodDomainId = id;

    // Check if table exists first
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'ecod_curation'
        AND table_name = 'reference_domain_actions'
      )
    `);

    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist yet, return empty actions
      return NextResponse.json({
        ecod_domain_id: ecodDomainId,
        actions: []
      });
    }

    const result = await query(`
      SELECT
        id,
        action,
        old_classification,
        new_classification,
        reason,
        curator,
        created_at
      FROM ecod_curation.reference_domain_actions
      WHERE ecod_domain_id = $1
      ORDER BY created_at DESC
    `, [ecodDomainId]);

    return NextResponse.json({
      ecod_domain_id: ecodDomainId,
      actions: result.rows
    });

  } catch (error) {
    console.error('Get Actions API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch action history',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
