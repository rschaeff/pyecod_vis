/**
 * GET /api/swissprot/structure/:id
 *
 * Returns structure file (PDB format) for a SwissProt domain
 * Reads from /data/ecod/batches/swissprot_novel/structures/
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sourceId = id; // e.g., "Q6PBK1_nD1"

    // Validate source_id format (UniProt-style domain ID)
    // Format: {unp_acc}_nD{number} or similar
    if (!sourceId || sourceId.length < 3) {
      return NextResponse.json(
        { error: 'Invalid source_id format' },
        { status: 400 }
      );
    }

    // Structure file location for SwissProt novel domains
    const basePath = '/data/ecod/batches/swissprot_novel/structures';
    const structurePath = path.join(basePath, `${sourceId}.pdb`);

    // Check if file exists
    try {
      await fs.access(structurePath);
    } catch {
      return NextResponse.json(
        {
          error: 'Structure file not found',
          message: `No structure file found for ${sourceId}`,
          expected_path: structurePath,
          help: 'SwissProt domain structures should be in /data/ecod/batches/swissprot_novel/structures/'
        },
        { status: 404 }
      );
    }

    // Check file is not empty
    const stats = await fs.stat(structurePath);
    if (stats.size === 0) {
      return NextResponse.json(
        {
          error: 'Structure file is empty',
          message: `Structure file for ${sourceId} exists but is empty`
        },
        { status: 500 }
      );
    }

    // Read structure file
    const structureContent = await fs.readFile(structurePath, 'utf-8');

    console.log(`Serving SwissProt structure: ${structurePath}`);

    // Return structure content as PDB
    return new NextResponse(structureContent, {
      status: 200,
      headers: {
        'Content-Type': 'chemical/x-pdb',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'X-Structure-Source': 'SwissProt Novel Domain',
      },
    });

  } catch (error) {
    console.error('SwissProt Structure API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch SwissProt structure',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
