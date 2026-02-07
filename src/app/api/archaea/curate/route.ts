/**
 * POST /api/archaea/curate
 *
 * Submit a curation decision for an archaea protein
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';
import type { ArchaeaCurationDecision, CurationResponse } from '@/lib/archaea-types';

// Map decision types to new curation status
const DECISION_TO_STATUS: Record<string, string> = {
  approve: 'classified',
  flag_novel: 'classified',
  classify: 'classified',
  defer: 'deferred',
  reject: 'rejected',
  skip: 'pending', // Skip doesn't change status
};

export async function POST(request: NextRequest) {
  const client = await getClient();

  try {
    const body: ArchaeaCurationDecision = await request.json();

    // Validate required fields
    if (!body.protein_id) {
      return NextResponse.json(
        { error: 'protein_id is required' },
        { status: 400 }
      );
    }

    if (!body.curator) {
      return NextResponse.json(
        { error: 'curator name is required' },
        { status: 400 }
      );
    }

    if (!body.decision_type) {
      return NextResponse.json(
        { error: 'decision_type is required' },
        { status: 400 }
      );
    }

    const validDecisions = ['approve', 'flag_novel', 'defer', 'reject', 'skip', 'classify'];
    if (!validDecisions.includes(body.decision_type)) {
      return NextResponse.json(
        { error: `Invalid decision_type. Must be one of: ${validDecisions.join(', ')}` },
        { status: 400 }
      );
    }

    // Begin transaction
    await client.query('BEGIN');

    // Get current protein status
    const currentResult = await client.query(`
      SELECT curation_status, is_novel_fold, ecod_x_group
      FROM archaea.curation_candidates
      WHERE protein_id = $1
    `, [body.protein_id]);

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Protein not found in curation candidates', protein_id: body.protein_id },
        { status: 404 }
      );
    }

    const previousStatus = currentResult.rows[0].curation_status;
    const newStatus = DECISION_TO_STATUS[body.decision_type];

    // Insert curation decision record (audit trail)
    await client.query(`
      INSERT INTO archaea.curation_decisions (
        protein_id, curator_name, decision_type,
        previous_status, new_status,
        ecod_x_group, ecod_h_group, ecod_t_group, ecod_f_group,
        is_novel_fold, is_novel_topology,
        confidence_level, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      body.protein_id,
      body.curator,
      body.decision_type,
      previousStatus,
      newStatus,
      body.ecod_x_group || null,
      body.ecod_h_group || null,
      body.ecod_t_group || null,
      body.ecod_f_group || null,
      body.is_novel_fold || null,
      body.is_novel_topology || null,
      body.confidence_level || null,
      body.notes || null,
    ]);

    // Update curation candidate (unless skip)
    if (body.decision_type !== 'skip') {
      let updateSql = `
        UPDATE archaea.curation_candidates
        SET curation_status = $1,
            reviewed_at = CURRENT_TIMESTAMP
      `;
      const updateParams: (string | number | boolean | null)[] = [newStatus];
      let paramIdx = 2;

      // Set classified_at if classified
      if (newStatus === 'classified') {
        updateSql += `, classified_at = CURRENT_TIMESTAMP`;
      }

      // Set novel flags if flagging as novel
      if (body.decision_type === 'flag_novel' || body.is_novel_fold) {
        updateSql += `, is_novel_fold = $${paramIdx++}`;
        updateParams.push(true);
      }

      // Set ECOD groups if provided
      if (body.ecod_x_group !== undefined) {
        updateSql += `, ecod_x_group = $${paramIdx++}`;
        updateParams.push(body.ecod_x_group);
      }
      if (body.ecod_h_group !== undefined) {
        updateSql += `, ecod_h_group = $${paramIdx++}`;
        updateParams.push(body.ecod_h_group);
      }
      if (body.ecod_t_group !== undefined) {
        updateSql += `, ecod_t_group = $${paramIdx++}`;
        updateParams.push(body.ecod_t_group);
      }
      if (body.ecod_f_group !== undefined) {
        updateSql += `, ecod_f_group = $${paramIdx++}`;
        updateParams.push(body.ecod_f_group);
      }

      // Set notes if provided
      if (body.notes) {
        updateSql += `, curator_notes = $${paramIdx++}`;
        updateParams.push(body.notes);
      }

      updateSql += ` WHERE protein_id = $${paramIdx++}`;
      updateParams.push(body.protein_id);

      await client.query(updateSql, updateParams);
    }

    // Get next protein in queue
    const nextResult = await client.query(`
      SELECT protein_id FROM archaea.v_curation_queue_full
      WHERE curation_status = 'pending'
        AND has_structure = TRUE
        AND protein_id != $1
      ORDER BY priority_rank ASC NULLS LAST, quality_score DESC NULLS LAST
      LIMIT 1
    `, [body.protein_id]);

    const nextProtein = nextResult.rows[0]?.protein_id || null;

    // Commit transaction
    await client.query('COMMIT');

    const response: CurationResponse = {
      success: true,
      protein_id: body.protein_id,
      new_status: newStatus,
      next_protein: nextProtein,
    };

    return NextResponse.json(response);

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');

    console.error('Archaea Curate API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit curation decision',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );

  } finally {
    client.release();
  }
}
