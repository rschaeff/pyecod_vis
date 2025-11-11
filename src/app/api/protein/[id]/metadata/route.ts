/**
 * GET /api/protein/[id]/metadata
 *
 * Returns PDB metadata for display (title, experimental method, resolution, dates, etc.)
 *
 * Example: /api/protein/8yl2_A/metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;

    // Get protein metadata
    const result = await query(`
      SELECT
        p.pdb_id,
        p.chain_id,
        p.sequence_length,
        p.pdb_title,
        p.entity_description,
        p.entity_id,
        p.pdb_deposition_date,
        p.pdb_release_date,
        p.experimental_method,
        p.resolution_angstrom,
        p.biological_assembly_count,
        p.uniprot_accession,
        p.uniprot_id,
        p.uniprot_range,
        p.partition_quality,
        p.partition_coverage,
        p.domain_count
      FROM ecod_curation.protein p
      WHERE p.source_id = $1
    `, [sourceId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      metadata: result.rows[0]
    });

  } catch (error) {
    console.error('Metadata API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch metadata',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
