/**
 * GET /api/browse/curated
 *
 * Fetch curated proteins with filtering options
 *
 * Query params:
 * - status: 'approved' | 'rejected' | 'flagged' | 'all'
 * - curator: string
 * - limit: number
 * - offset: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const statusFilter = searchParams.get('status') || 'all';
    const curatorFilter = searchParams.get('curator');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build WHERE clauses
    const whereClauses: string[] = ["p.curation_status != 'pending'"];
    const params: any[] = [];
    let paramIndex = 1;

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'approved') {
        whereClauses.push(`cdl.domains_accepted = true`);
      } else if (statusFilter === 'rejected') {
        whereClauses.push(`cdl.domains_rejected = true`);
      } else if (statusFilter === 'flagged') {
        whereClauses.push(`cdl.flagged_for_expert = true`);
      }
    }

    // Curator filter
    if (curatorFilter) {
      whereClauses.push(`cs.curator_name = $${paramIndex}`);
      params.push(curatorFilter);
      paramIndex++;
    }

    const whereClause = whereClauses.join(' AND ');

    // Fetch curated proteins
    const proteinsQuery = `
      SELECT
        p.id,
        p.source_id,
        p.pdb_id,
        p.chain_id,
        p.domain_count,
        p.partition_coverage,
        p.curation_status,
        p.entity_description,
        cdl.domains_accepted,
        cdl.domains_modified,
        cdl.domains_rejected,
        cdl.flagged_for_expert,
        cdl.notes,
        cs.curator_name,
        cdl.id as decision_id
      FROM ecod_curation.protein p
      JOIN ecod_curation.curation_decision_log cdl ON p.id = cdl.protein_id
      LEFT JOIN ecod_curation.curation_session cs ON cdl.session_id = cs.id
      WHERE ${whereClause}
      ORDER BY cdl.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const proteinsResult = await query(proteinsQuery, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM ecod_curation.protein p
      JOIN ecod_curation.curation_decision_log cdl ON p.id = cdl.protein_id
      LEFT JOIN ecod_curation.curation_session cs ON cdl.session_id = cs.id
      WHERE ${whereClause}
    `;

    const countResult = await query(countQuery, params.slice(0, -2)); // Remove limit/offset
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT p.id) FILTER (WHERE cdl.domains_accepted = true) as approved,
        COUNT(DISTINCT p.id) FILTER (WHERE cdl.domains_rejected = true) as rejected,
        COUNT(DISTINCT p.id) FILTER (WHERE cdl.flagged_for_expert = true) as flagged,
        COUNT(DISTINCT p.id) FILTER (WHERE cdl.notes LIKE '%breakpoints%') as with_breakpoints
      FROM ecod_curation.protein p
      JOIN ecod_curation.curation_decision_log cdl ON p.id = cdl.protein_id
      LEFT JOIN ecod_curation.curation_session cs ON cdl.session_id = cs.id
      WHERE ${whereClause}
    `;

    const summaryResult = await query(summaryQuery, params.slice(0, -2));
    const summary = summaryResult.rows[0] || {
      approved: 0,
      rejected: 0,
      flagged: 0,
      with_breakpoints: 0
    };

    // Parse breakpoints from notes JSON
    const proteins = proteinsResult.rows.map((row: any) => {
      let breakpoints = null;
      let parsedNotes = row.notes;

      // Try to parse notes as JSON to extract breakpoints
      if (row.notes && row.notes.startsWith('{')) {
        try {
          const notesData = JSON.parse(row.notes);
          if (notesData.breakpoints && Array.isArray(notesData.breakpoints)) {
            breakpoints = notesData.breakpoints;
            parsedNotes = notesData.note || row.notes;
          }
        } catch (e) {
          // Not JSON, use as-is
        }
      }

      return {
        source_id: row.source_id,
        pdb_id: row.pdb_id,
        chain_id: row.chain_id,
        domain_count: row.domain_count,
        partition_coverage: row.partition_coverage,
        curation_status: row.curation_status,
        entity_description: row.entity_description,
        decision: {
          accepted: row.domains_accepted,
          modified: row.domains_modified,
          rejected: row.domains_rejected,
          flagged: row.flagged_for_expert,
          notes: parsedNotes,
          breakpoints: breakpoints,
          curator: row.curator_name
        }
      };
    });

    return NextResponse.json({
      total,
      proteins,
      summary: {
        approved: parseInt(summary.approved || '0'),
        rejected: parseInt(summary.rejected || '0'),
        flagged: parseInt(summary.flagged || '0'),
        withBreakpoints: parseInt(summary.with_breakpoints || '0')
      }
    });

  } catch (error) {
    console.error('Browse API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch curated proteins',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
