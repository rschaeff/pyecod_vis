/**
 * GET /api/archaea/structure/:id
 *
 * Returns CIF structure file for an archaea protein
 * Files are AlphaFold3 predictions stored at paths in target_proteins.cif_file
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const proteinId = id;

    if (!proteinId) {
      return NextResponse.json(
        { error: 'Protein ID is required' },
        { status: 400 }
      );
    }

    // Get CIF file path from database
    const result = await query<{ cif_file: string; has_structure: boolean }>(`
      SELECT cif_file, has_structure
      FROM archaea.target_proteins
      WHERE protein_id = $1
    `, [proteinId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found', protein_id: proteinId },
        { status: 404 }
      );
    }

    const { cif_file, has_structure } = result.rows[0];

    if (!has_structure || !cif_file) {
      return NextResponse.json(
        {
          error: 'No structure available',
          protein_id: proteinId,
          has_structure,
          message: 'This protein does not have an associated structure file'
        },
        { status: 404 }
      );
    }

    // Check if file exists
    try {
      await fs.access(cif_file);
    } catch {
      return NextResponse.json(
        {
          error: 'Structure file not found',
          protein_id: proteinId,
          expected_path: cif_file,
          message: 'The structure file path is recorded but the file is not accessible'
        },
        { status: 404 }
      );
    }

    // Check file is not empty
    const stats = await fs.stat(cif_file);
    if (stats.size === 0) {
      return NextResponse.json(
        {
          error: 'Structure file is empty',
          protein_id: proteinId,
          path: cif_file
        },
        { status: 500 }
      );
    }

    // Read structure file
    const structureContent = await fs.readFile(cif_file, 'utf-8');

    console.log(`Serving archaea structure: ${cif_file} (${stats.size} bytes)`);

    // Return structure content as CIF
    return new NextResponse(structureContent, {
      status: 200,
      headers: {
        'Content-Type': 'chemical/x-cif',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'X-Structure-Source': 'Archaea AlphaFold3',
        'X-Protein-ID': proteinId,
      },
    });

  } catch (error) {
    console.error('Archaea Structure API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch structure',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
