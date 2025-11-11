/**
 * GET /api/protein/[id]/residue-mapping
 *
 * Returns SEQID → PDB ATOM numbering mappings for a protein chain
 * Used by StructureViewer to correctly highlight domains
 *
 * Parses the PDB chain file to build SEQID→PDB mappings on-the-fly
 *
 * Example: /api/protein/8yl2_A/residue-mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;

    // Get protein info
    const proteinResult = await query(`
      SELECT id, pdb_id, chain_id
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
    const pdbChainPath = path.join('/data/ecod/structures/chains', `${sourceId}.pdb`);

    let pdbContent = '';
    let chainToExtract = 'A';  // Default for chain-specific files

    // Check if chain-specific PDB file exists and is not empty
    if (fs.existsSync(pdbChainPath)) {
      const stats = fs.statSync(pdbChainPath);
      if (stats.size > 0) {
        pdbContent = fs.readFileSync(pdbChainPath, 'utf-8');
      } else {
        console.log(`[residue-mapping] Chain PDB file is empty: ${pdbChainPath}`);
      }
    }

    // If no valid chain-specific file, try to extract from full CIF
    if (!pdbContent) {
      console.log(`[residue-mapping] Attempting to extract from full CIF for ${sourceId}`);
      const pdbMid = protein.pdb_id.substring(1, 3);
      const fullCifPath = `/usr2/pdb/data/structures/divided/mmCIF/${pdbMid}/${protein.pdb_id}.cif.gz`;

      if (!fs.existsSync(fullCifPath)) {
        console.log(`[residue-mapping] Full CIF not found: ${fullCifPath}`);
        return NextResponse.json({
          protein_id: protein.id,
          source_id: sourceId,
          has_mappings: false,
          mapping_map: {}
        });
      }

      // Decompress and parse CIF to extract chain
      const { gunzip } = await import('zlib');
      const { promisify } = await import('util');
      const gunzipAsync = promisify(gunzip);

      const compressedData = fs.readFileSync(fullCifPath);
      const decompressedData = await gunzipAsync(compressedData);
      pdbContent = decompressedData.toString('utf-8');
      chainToExtract = protein.chain_id;  // Use actual chain ID from full CIF
      console.log(`[residue-mapping] Loaded full CIF, will extract chain ${chainToExtract}`);
    }

    // Parse file to extract CA atom residue numbers
    const lines = pdbContent.split('\n');

    // Extract unique residue numbers from CA atoms
    const pdbResidues: number[] = [];
    const seenResidues = new Set<number>();

    // Detect if this is a CIF file
    const isCIF = pdbContent.includes('_atom_site.');

    if (isCIF) {
      // Parse mmCIF format
      console.log(`[residue-mapping] Parsing mmCIF format for chain ${chainToExtract}`);

      for (const line of lines) {
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
          // CIF ATOM line format (space-separated columns)
          // Example: ATOM   1348320 C  CA  . MET PT  3  1    ? 979.901  895.418  842.798  1.00 39.60  ? 1    MET B001 CA  1
          const parts = line.split(/\s+/);
          if (parts.length >= 19) {
            const atomName = parts[3];           // CA, CB, etc.
            const authAsymId = parts[18];        // Auth chain ID (e.g., B001, A001)
            const residueNum = parseInt(parts[8]); // Author residue number

            if (atomName === 'CA' && authAsymId === chainToExtract && !isNaN(residueNum)) {
              if (!seenResidues.has(residueNum)) {
                seenResidues.add(residueNum);
                pdbResidues.push(residueNum);
              }
            }
          }
        }
      }
    } else {
      // Parse PDB format
      for (const line of lines) {
        if (line.startsWith('ATOM') && line.substring(13, 15).trim() === 'CA') {
          const lineChain = line.substring(21, 22).trim();
          // For chain-specific files, chain is usually 'A' or blank
          // For full structures, check chain ID
          if (chainToExtract === 'A' || lineChain === chainToExtract || lineChain === '') {
            const residueNum = parseInt(line.substring(22, 26).trim());
            if (!seenResidues.has(residueNum)) {
              seenResidues.add(residueNum);
              pdbResidues.push(residueNum);
            }
          }
        }
      }
    }

    // Sort residue numbers
    pdbResidues.sort((a, b) => a - b);

    if (pdbResidues.length === 0) {
      console.log(`[residue-mapping] No CA atoms found in ${pdbChainPath}`);
      return NextResponse.json({
        protein_id: protein.id,
        source_id: sourceId,
        has_mappings: false,
        mapping_map: {}
      });
    }

    // Build SEQID→PDB mapping
    // SEQID is 1-based sequential, PDB uses author numbering
    const mappingMap: { [key: number]: number } = {};
    pdbResidues.forEach((pdbNum, index) => {
      const seqid = index + 1;  // SEQID is 1-based
      mappingMap[seqid] = pdbNum;
    });

    console.log(`[residue-mapping] Built mapping for ${sourceId}: ${pdbResidues.length} residues (PDB ${pdbResidues[0]}-${pdbResidues[pdbResidues.length - 1]})`);

    return NextResponse.json({
      protein_id: protein.id,
      source_id: sourceId,
      mapping_map: mappingMap,
      has_mappings: true,
      residue_count: pdbResidues.length,
      pdb_range: [pdbResidues[0], pdbResidues[pdbResidues.length - 1]]
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
