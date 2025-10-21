#!/usr/bin/env python3
"""
Preprocess PDB structures for fast web viewing.

Extracts chain-specific PDB files from full mmCIF structures.
This dramatically reduces file size and loading time for multi-chain structures.

Usage:
    python preprocess_structures.py --batch ecod_weekly_20250905
    python preprocess_structures.py --protein-list proteins.txt
    python preprocess_structures.py --all  # Process all proteins in database

Output:
    Creates chain-specific PDB files in:
    /data/ecod/structures/chains/{pdb_id}_{chain_id}.pdb
"""

import argparse
import gzip
import os
import sys
from pathlib import Path
from typing import List, Tuple, Optional

try:
    from Bio.PDB import MMCIFParser, PDBIO, Select
    from Bio.PDB.Structure import Structure
except ImportError:
    print("Error: BioPython is required. Install with: pip install biopython", file=sys.stderr)
    sys.exit(1)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Error: psycopg2 is required. Install with: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


# Configuration
PDB_CIF_BASE = "/usr2/pdb/data/structures/divided/mmCIF"
OUTPUT_BASE = "/data/ecod/structures/chains"
DB_CONFIG = {
    'host': 'dione',
    'port': 45000,
    'database': 'ecod_protein',
    'user': 'ecod',
    'password': os.environ.get('ECOD_DB_PASSWORD', ''),
}


class ChainSelect(Select):
    """Select only a specific chain from a structure."""

    def __init__(self, chain_id: str):
        self.chain_id = chain_id

    def accept_chain(self, chain):
        return chain.get_id() == self.chain_id


def get_cif_path(pdb_id: str) -> Optional[Path]:
    """Get path to mmCIF file for a PDB ID."""
    pdb_mid = pdb_id[1:3].lower()
    pdb_lower = pdb_id.lower()

    # Try .cif.gz first (most common)
    cif_gz = Path(PDB_CIF_BASE) / pdb_mid / f"{pdb_lower}.cif.gz"
    if cif_gz.exists():
        return cif_gz

    # Try uncompressed .cif
    cif = Path(PDB_CIF_BASE) / pdb_mid / f"{pdb_lower}.cif"
    if cif.exists():
        return cif

    return None


def extract_chain(pdb_id: str, chain_id: str, output_path: Path) -> bool:
    """
    Extract a single chain from a mmCIF file and save as PDB.

    Returns:
        True if successful, False otherwise
    """
    try:
        # Find input CIF file
        cif_path = get_cif_path(pdb_id)
        if not cif_path:
            print(f"  WARNING: CIF file not found for {pdb_id}", file=sys.stderr)
            return False

        # Parse structure
        parser = MMCIFParser(QUIET=True)

        if cif_path.suffix == '.gz':
            with gzip.open(cif_path, 'rt') as f:
                structure = parser.get_structure(pdb_id, f)
        else:
            structure = parser.get_structure(pdb_id, cif_path)

        # Check if chain exists
        chain_found = False
        for model in structure:
            if chain_id in [c.get_id() for c in model]:
                chain_found = True
                break

        if not chain_found:
            print(f"  WARNING: Chain {chain_id} not found in {pdb_id}", file=sys.stderr)
            return False

        # Write chain-specific PDB
        io = PDBIO()
        io.set_structure(structure)

        # Create output directory if needed
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Save only the specified chain
        io.save(str(output_path), ChainSelect(chain_id))

        # Verify output
        if output_path.exists() and output_path.stat().st_size > 0:
            file_size = output_path.stat().st_size
            print(f"  ✓ Created {output_path.name} ({file_size:,} bytes)")
            return True
        else:
            print(f"  ERROR: Failed to create {output_path.name}", file=sys.stderr)
            return False

    except Exception as e:
        print(f"  ERROR processing {pdb_id}_{chain_id}: {e}", file=sys.stderr)
        return False


def get_proteins_from_db(batch: Optional[str] = None, limit: Optional[int] = None) -> List[Tuple[str, str, str]]:
    """
    Get list of proteins from database.

    Returns:
        List of (source_id, pdb_id, chain_id) tuples
    """
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT source_id, pdb_id, chain_id
            FROM ecod_curation.protein
            WHERE curation_status = 'pending'
        """
        params = []

        if batch:
            query += " AND source_id LIKE %s"
            params.append(f"{batch}%")

        query += " ORDER BY source_id"

        if limit:
            query += f" LIMIT {limit}"

        cur.execute(query, params)
        results = [(row['source_id'], row['pdb_id'], row['chain_id']) for row in cur.fetchall()]

        cur.close()
        conn.close()

        return results

    except Exception as e:
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Extract chain-specific PDB files for web viewing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process all pending proteins (for demo)
  python preprocess_structures.py --limit 100

  # Process specific proteins
  python preprocess_structures.py --proteins 8s72_A 7bq2_B

  # Process from file list
  python preprocess_structures.py --protein-list proteins.txt

  # Process a batch
  python preprocess_structures.py --batch ecod_weekly_20250905
        """
    )

    parser.add_argument('--batch', help='Process proteins from a specific batch')
    parser.add_argument('--proteins', nargs='+', help='Specific protein IDs (e.g., 8s72_A)')
    parser.add_argument('--protein-list', type=Path, help='File containing protein IDs (one per line)')
    parser.add_argument('--limit', type=int, help='Limit number of proteins to process')
    parser.add_argument('--output-dir', type=Path, default=Path(OUTPUT_BASE),
                       help=f'Output directory (default: {OUTPUT_BASE})')
    parser.add_argument('--overwrite', action='store_true', help='Overwrite existing files')

    args = parser.parse_args()

    # Determine which proteins to process
    proteins_to_process = []

    if args.proteins:
        # Manual list
        for source_id in args.proteins:
            match = source_id.split('_')
            if len(match) == 2:
                proteins_to_process.append((source_id, match[0], match[1]))
            else:
                print(f"Invalid protein ID format: {source_id}", file=sys.stderr)

    elif args.protein_list:
        # From file
        with open(args.protein_list) as f:
            for line in f:
                source_id = line.strip()
                if source_id and not source_id.startswith('#'):
                    match = source_id.split('_')
                    if len(match) == 2:
                        proteins_to_process.append((source_id, match[0], match[1]))

    else:
        # From database
        proteins_to_process = get_proteins_from_db(batch=args.batch, limit=args.limit)

    if not proteins_to_process:
        print("No proteins to process!", file=sys.stderr)
        sys.exit(1)

    print(f"Processing {len(proteins_to_process)} proteins...")
    print(f"Output directory: {args.output_dir}")
    print()

    # Process each protein
    success_count = 0
    skip_count = 0
    error_count = 0

    for source_id, pdb_id, chain_id in proteins_to_process:
        output_path = args.output_dir / f"{pdb_id}_{chain_id}.pdb"

        # Skip if exists and not overwriting
        if output_path.exists() and not args.overwrite:
            skip_count += 1
            continue

        print(f"Processing {source_id} ({pdb_id} chain {chain_id})...")

        if extract_chain(pdb_id, chain_id, output_path):
            success_count += 1
        else:
            error_count += 1

    print()
    print("=" * 60)
    print(f"Summary:")
    print(f"  Successfully created: {success_count}")
    print(f"  Skipped (existing):   {skip_count}")
    print(f"  Errors:               {error_count}")
    print(f"  Total:                {len(proteins_to_process)}")

    if success_count > 0:
        print()
        print(f"Chain-specific PDB files are in: {args.output_dir}")
        print("The structure API will now use these for faster loading!")


if __name__ == '__main__':
    main()
