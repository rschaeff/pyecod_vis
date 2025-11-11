/**
 * GET /api/structure/:id
 *
 * Returns structure file (CIF format) for a protein
 * Reads from filesystem (performance optimization)
 *
 * Expected structure paths:
 * - /data/ecod/batches/{batch}/structures/{pdb_id}_{chain_id}.cif
 * - /data/pdb/divided/{pdb_mid}/{pdb_id}.cif.gz (fallback)
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { query } from '@/lib/db';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { gunzip } from 'zlib';

const execAsync = promisify(exec);
const gunzipAsync = promisify(gunzip);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sourceId = id; // e.g., "8s72_A"

    // Parse source_id to get pdb_id and chain_id
    const match = sourceId.match(/^([a-z0-9]{4})_([A-Z0-9]+)$/i);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid source_id format' },
        { status: 400 }
      );
    }

    const [, pdbId, chainId] = match;

    // Get protein info to find batch
    const proteinResult = await query(`
      SELECT pdb_id, chain_id, release_date
      FROM ecod_curation.protein
      WHERE source_id = $1
    `, [sourceId]);

    if (proteinResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found' },
        { status: 404 }
      );
    }

    const protein = proteinResult.rows[0];

    // Try to find structure file in various locations
    const basePath = process.env.STRUCTURE_BASE_PATH || '/data/ecod/batches';

    // Possible paths to check
    const pdbMid = pdbId.substring(1, 3); // Middle 2 characters (e.g., "s7" from "8s72")
    const possiblePaths = [
      // Preprocessed chain-specific PDB files (BEST - small, fast)
      path.join(basePath, `ecod_weekly_*`, 'structures', `${pdbId}_${chainId}.pdb`),
      path.join(basePath, `*`, 'structures', `${pdbId}_${chainId}.pdb`),
      `/data/ecod/structures/chains/${pdbId}_${chainId}.pdb`,
      // Chain-specific CIF files
      path.join(basePath, `ecod_weekly_*`, 'structures', `${pdbId}_${chainId}.cif`),
      path.join(basePath, `*`, 'structures', `${pdbId}_${chainId}.cif`),
      // Full CIF from PDB repository (FALLBACK - large, slow for multi-chain)
      `/usr2/pdb/data/structures/divided/mmCIF/${pdbMid}/${pdbId}.cif`,
      `/usr2/pdb/data/structures/divided/mmCIF/${pdbMid}/${pdbId}.cif.gz`,
      // Other fallback locations
      `/data/pdb/divided/${pdbMid}/${pdbId}.cif`,
      `/data/pdb/divided/${pdbMid}/${pdbId}.cif.gz`,
    ];

    let structureContent: string | null = null;
    let foundPath: string | null = null;

    // Try each path
    for (const pathPattern of possiblePaths) {
      try {
        // If path has wildcard, use glob
        if (pathPattern.includes('*')) {
          const { stdout } = await execAsync(`ls ${pathPattern} 2>/dev/null | head -1`);
          const resolvedPath = stdout.trim();

          if (resolvedPath) {
            // Check if file is not empty
            const stats = await fs.stat(resolvedPath);
            if (stats.size > 0) {
              foundPath = resolvedPath;
              break;
            } else {
              console.log(`Skipping empty file: ${resolvedPath}`);
            }
          }
        } else {
          // Direct path check
          await fs.access(pathPattern);
          // Check if file is not empty
          const stats = await fs.stat(pathPattern);
          if (stats.size > 0) {
            foundPath = pathPattern;
            break;
          } else {
            console.log(`Skipping empty file: ${pathPattern}`);
          }
        }
      } catch {
        // Continue to next path
        continue;
      }
    }

    if (!foundPath) {
      return NextResponse.json(
        {
          error: 'Structure file not found',
          message: `No structure file found for ${sourceId}`,
          searched_paths: possiblePaths,
          help: 'Structure files should be placed in batch/structures/ directory or configure STRUCTURE_BASE_PATH'
        },
        { status: 404 }
      );
    }

    // Log which file is being served (useful for performance monitoring)
    const fileType = foundPath.endsWith('.pdb') ? 'PDB (chain-specific)' :
                     foundPath.includes('chains') ? 'preprocessed chain' :
                     'CIF (full structure)';
    console.log(`Serving ${fileType}: ${foundPath}`);

    // Read structure file
    if (foundPath.endsWith('.gz')) {
      // Decompress gzipped file using zlib
      const compressedData = await fs.readFile(foundPath);
      const decompressedData = await gunzipAsync(compressedData);
      structureContent = decompressedData.toString('utf-8');
    } else {
      structureContent = await fs.readFile(foundPath, 'utf-8');
    }

    // Determine content type based on file extension
    const contentType = foundPath.match(/\.pdb(\.gz)?$/) ? 'chemical/x-pdb' : 'chemical/x-cif';

    // Return structure content
    return new NextResponse(structureContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'X-Structure-Source': fileType, // Debug header
      },
    });

  } catch (error) {
    console.error('Structure API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch structure',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
