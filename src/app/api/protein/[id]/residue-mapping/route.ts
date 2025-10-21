/**
 * GET /api/protein/[id]/residue-mapping
 *
 * Returns SEQID → PDB ATOM numbering mappings for a protein chain
 * Used by StructureViewer to correctly highlight domains
 *
 * Example: /api/protein/8yl2_A/residue-mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;

    // Get protein_id
    const proteinResult = await query(`
      SELECT id
      FROM ecod_curation.protein
      WHERE source_id = $1
    `, [sourceId]);

    if (proteinResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found' },
        { status: 404 }
      );
    }

    const proteinId = proteinResult.rows[0].id;

    // Get residue mappings
    const mappingsResult = await query(`
      SELECT
        seqid_position,
        pdb_position,
        pdb_insertion_code,
        residue_name,
        is_observed,
        uniprot_position
      FROM ecod_curation.residue_mapping
      WHERE protein_id = $1
      ORDER BY seqid_position
    `, [proteinId]);

    // Build lookup map for quick SEQID→PDB conversion
    const mappingMap: { [key: number]: number } = {};
    mappingsResult.rows.forEach((row: any) => {
      if (row.pdb_position !== null) {
        mappingMap[row.seqid_position] = row.pdb_position;
      }
    });

    return NextResponse.json({
      protein_id: proteinId,
      source_id: sourceId,
      mappings: mappingsResult.rows,
      mapping_map: mappingMap,
      has_mappings: mappingsResult.rows.length > 0
    });

  } catch (error) {
    console.error('Residue mapping API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch residue mappings',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
