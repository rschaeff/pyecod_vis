/**
 * POST /api/curate
 *
 * Submit curation decision for a protein
 * Updates domain assignments, protein status, and logs the decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { CurationDecision, CurationResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  const client = await getClient();

  try {
    const body: CurationDecision = await request.json();

    const { protein_id, curator, decision, domains, notes, breakpoints } = body;

    // Validate required fields
    if (!protein_id || !curator || !decision || !domains) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Start transaction
    await client.query('BEGIN');

    // 1. Update each domain with curator decisions
    for (const domain of domains) {
      // Update domain boundaries if modified
      const residueRange = `${domain.start_pos}-${domain.end_pos}`;

      await client.query(`
        UPDATE ecod_curation.domain_assignment
        SET
          start_pos = $1,
          end_pos = $2,
          residue_range = $3,
          curator_decision = $4,
          curator_name = $5,
          curated_at = NOW()
        WHERE id = $6
      `, [
        domain.start_pos,
        domain.end_pos,
        residueRange,
        domain.curator_decision,
        curator,
        domain.domain_id
      ]);

      // Record boundary change in history if modified
      const domainResult = await client.query(`
        SELECT automated_start_pos, automated_end_pos, automated_range_string
        FROM ecod_curation.domain_assignment
        WHERE id = $1
      `, [domain.domain_id]);

      if (domainResult.rows.length > 0) {
        const automated = domainResult.rows[0];
        const isModified =
          automated.automated_start_pos !== domain.start_pos ||
          automated.automated_end_pos !== domain.end_pos;

        if (isModified) {
          await client.query(`
            INSERT INTO ecod_curation.domain_boundary_history
            (domain_id, old_start_pos, old_end_pos, old_range_string,
             new_start_pos, new_end_pos, new_range_string,
             modified_by, modification_reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            domain.domain_id,
            automated.automated_start_pos,
            automated.automated_end_pos,
            automated.automated_range_string,
            domain.start_pos,
            domain.end_pos,
            `${domain.start_pos}-${domain.end_pos}`,
            curator,
            notes || 'Curator modification'
          ]);
        }
      }
    }

    // 2. Update protein curation status
    let curationStatus: 'curated' | 'rejected';
    if (decision === 'approved') {
      curationStatus = 'curated';
    } else if (decision === 'rejected') {
      curationStatus = 'rejected';
    } else {
      // needs_review - mark as curated but flagged_for_expert in log
      curationStatus = 'curated';
    }

    await client.query(`
      UPDATE ecod_curation.protein
      SET
        curation_status = $1,
        curation_source = 'manual'
      WHERE id = $2
    `, [curationStatus, protein_id]);

    // 3. Record in curation decision log
    // Determine which boolean flags to set
    const hasModifiedDomains = domains.some(d => d.curator_decision === 'modified');

    // Combine notes with breakpoints metadata
    let finalNotes = notes || '';
    if (breakpoints && breakpoints.length > 0) {
      const breakpointData = {
        breakpoints: breakpoints,
        note: finalNotes
      };
      finalNotes = JSON.stringify(breakpointData);
    }

    await client.query(`
      INSERT INTO ecod_curation.curation_decision_log
      (protein_id, domains_accepted, domains_modified, domains_rejected,
       flagged_for_expert, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      protein_id,
      decision === 'approved', // domains_accepted
      hasModifiedDomains,      // domains_modified
      decision === 'rejected', // domains_rejected
      decision === 'needs_review', // flagged_for_expert
      finalNotes
    ]);

    // 4. Get next protein in queue (if any)
    // Prioritize single-character chain IDs for better visualization support
    const nextProteinResult = await client.query(`
      SELECT p.source_id
      FROM ecod_curation.protein p
      LEFT JOIN ecod_curation.curation_queue q ON p.id = q.protein_id
      WHERE p.curation_status = 'pending'
        AND LENGTH(p.chain_id) = 1
      ORDER BY COALESCE(q.priority, 5) DESC, p.id
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

    console.error('Curate API error:', error);
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
