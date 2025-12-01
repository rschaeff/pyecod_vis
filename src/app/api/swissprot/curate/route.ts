/**
 * POST /api/swissprot/curate
 *
 * Submit curation decision for a SwissProt novel domain
 * Updates protein status and logs the decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';

interface SwissProtCurationDecision {
  protein_id: number;
  curator: string;
  decision: 'approved' | 'rejected' | 'needs_review';
  notes?: string;
}

interface CurationResponse {
  success: boolean;
  protein_id: number;
  next_protein?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  const client = await getClient();

  try {
    const body: SwissProtCurationDecision = await request.json();

    const { protein_id, curator, decision, notes } = body;

    // Validate required fields
    if (!protein_id || !curator || !decision) {
      return NextResponse.json(
        { error: 'Missing required fields: protein_id, curator, decision' },
        { status: 400 }
      );
    }

    // Validate decision value
    if (!['approved', 'rejected', 'needs_review'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be: approved, rejected, or needs_review' },
        { status: 400 }
      );
    }

    // Start transaction
    await client.query('BEGIN');

    // 1. Update protein curation status
    let curationStatus: string;
    if (decision === 'approved') {
      curationStatus = 'curated';
    } else if (decision === 'rejected') {
      curationStatus = 'rejected';
    } else {
      curationStatus = 'needs_review';
    }

    await client.query(`
      UPDATE ecod_curation.swissprot_protein
      SET
        curation_status = $1,
        curator_decision = $2,
        curator_name = $3,
        curator_notes = $4,
        curated_at = NOW()
      WHERE id = $5
    `, [curationStatus, decision, curator, notes || null, protein_id]);

    // 2. Remove from queue if curated or rejected
    if (decision === 'approved' || decision === 'rejected') {
      await client.query(`
        DELETE FROM ecod_curation.swissprot_curation_queue
        WHERE protein_id = $1
      `, [protein_id]);
    }

    // 3. Get next protein in queue
    const nextProteinResult = await client.query(`
      SELECT sp.source_id
      FROM ecod_curation.swissprot_protein sp
      JOIN ecod_curation.swissprot_curation_queue sq ON sp.id = sq.protein_id
      WHERE sp.curation_status = 'pending'
      ORDER BY sq.priority ASC, sp.cluster_size DESC
      LIMIT 1
    `);

    const nextProtein = nextProteinResult.rows.length > 0
      ? nextProteinResult.rows[0].source_id
      : undefined;

    // Commit transaction
    await client.query('COMMIT');

    const response: CurationResponse = {
      success: true,
      protein_id,
      next_protein: nextProtein
    };

    return NextResponse.json(response);

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');

    console.error('SwissProt Curate API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save curation decision',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  } finally {
    // Release client back to pool
    client.release();
  }
}
