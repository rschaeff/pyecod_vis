#!/usr/bin/env python3
"""
Fetch PDB metadata and populate the ecod_curation.protein table.

Fetches:
- PDB title (for the whole structure)
- Entity description (for the specific chain/entity)
- Experimental method, resolution, dates, etc.

Usage:
    python scripts/fetch_pdb_metadata.py [--limit N] [--pdb-id PDB_ID]
"""

import argparse
import os
import sys
import time
import requests
from typing import Dict, Any, Optional
import psycopg2

def get_pdb_metadata(pdb_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch metadata from PDB REST API.

    Returns dict with:
    - pdb_title
    - experimental_method
    - resolution_angstrom
    - pdb_deposition_date
    - pdb_release_date
    - entities: dict mapping chain_id -> entity_description
    """
    try:
        # Fetch main entry data
        url = f"https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"
        response = requests.get(url, timeout=10)

        if response.status_code != 200:
            print(f"  Warning: PDB API returned {response.status_code} for {pdb_id}")
            return None

        data = response.json()

        # Extract basic metadata
        metadata = {
            'pdb_title': data.get('struct', {}).get('title'),
            'pdb_deposition_date': data.get('rcsb_accession_info', {}).get('deposit_date'),
            'pdb_release_date': data.get('rcsb_accession_info', {}).get('initial_release_date'),
        }

        # Experimental method
        exptl = data.get('exptl', [])
        if exptl and len(exptl) > 0:
            metadata['experimental_method'] = exptl[0].get('method')

        # Resolution (X-ray only)
        if metadata.get('experimental_method') in ['X-RAY DIFFRACTION', 'ELECTRON MICROSCOPY']:
            refine = data.get('refine', [])
            if refine and len(refine) > 0:
                resolution = refine[0].get('ls_d_res_high')
                if resolution:
                    metadata['resolution_angstrom'] = float(resolution)

        # Biological assemblies
        assemblies = data.get('rcsb_entry_info', {}).get('assembly_count')
        if assemblies:
            metadata['biological_assembly_count'] = int(assemblies)

        # Fetch ALL polymer entities for this PDB
        # First, get the list of entity IDs from the entry data
        entities = {}

        # Get polymer entity instances from entry data
        polymer_entities = data.get('rcsb_entry_container_identifiers', {}).get('polymer_entity_ids', [])
        print(f"  Found {len(polymer_entities)} polymer entities: {polymer_entities}")

        # Fetch each entity separately
        for entity_num in polymer_entities:
            entity_url = f"https://data.rcsb.org/rest/v1/core/polymer_entity/{pdb_id}/{entity_num}"
            entity_response = requests.get(entity_url, timeout=10)

            if entity_response.status_code == 200:
                entity_data = entity_response.json()

                # Get entity description
                entity_desc = entity_data.get('rcsb_polymer_entity', {}).get('pdbx_description')

                # Get chain IDs for this entity
                chains = entity_data.get('entity_poly', {}).get('pdbx_strand_id', '')
                chain_list = [c.strip() for c in chains.split(',') if c.strip()]

                print(f"  Entity {entity_num}: {entity_desc} -> chains {chain_list}")

                # Map each chain to this entity's description
                for chain_id in chain_list:
                    entities[chain_id] = {
                        'entity_id': entity_num,
                        'entity_description': entity_desc
                    }
            else:
                print(f"  Warning: Failed to fetch entity {entity_num}: {entity_response.status_code}")

        metadata['entities'] = entities
        return metadata

    except Exception as e:
        print(f"  Error fetching metadata for {pdb_id}: {e}")
        return None


def update_protein_metadata(cursor, source_id: str, pdb_id: str, chain_id: str, metadata: Dict[str, Any]):
    """Update metadata for a single protein."""

    # Get entity info for this chain
    entities = metadata.get('entities', {})
    entity_info = entities.get(chain_id, {})

    cursor.execute("""
        UPDATE ecod_curation.protein
        SET
            pdb_title = %s,
            entity_description = %s,
            entity_id = %s,
            experimental_method = %s,
            resolution_angstrom = %s,
            pdb_deposition_date = %s,
            pdb_release_date = %s,
            biological_assembly_count = %s
        WHERE source_id = %s
    """, (
        metadata.get('pdb_title'),
        entity_info.get('entity_description'),
        entity_info.get('entity_id'),
        metadata.get('experimental_method'),
        metadata.get('resolution_angstrom'),
        metadata.get('pdb_deposition_date'),
        metadata.get('pdb_release_date'),
        metadata.get('biological_assembly_count'),
        source_id
    ))


def main():
    parser = argparse.ArgumentParser(description='Fetch PDB metadata for curation proteins')
    parser.add_argument('--limit', type=int, help='Limit number of proteins to process')
    parser.add_argument('--pdb-id', help='Process only this PDB ID')
    parser.add_argument('--pending-only', action='store_true',
                       help='Only process proteins with curation_status=pending')
    parser.add_argument('--force', action='store_true',
                       help='Re-fetch metadata even if already present')
    args = parser.parse_args()

    # Connect to database
    conn = psycopg2.connect(
        host='dione',
        port=45000,
        database='ecod_protein',
        user='ecod',
        password=os.environ.get('DB_PASSWORD', '')
    )
    cursor = conn.cursor()

    try:
        # Get proteins that need metadata
        if args.force:
            query = """
                SELECT source_id, pdb_id, chain_id
                FROM ecod_curation.protein
                WHERE 1=1
            """
        else:
            query = """
                SELECT source_id, pdb_id, chain_id
                FROM ecod_curation.protein
                WHERE pdb_title IS NULL
            """

        if args.pending_only:
            query += " AND curation_status = 'pending'"

        if args.pdb_id:
            query += f" AND pdb_id = '{args.pdb_id}'"

        query += " ORDER BY pdb_id, chain_id"

        if args.limit:
            query += f" LIMIT {args.limit}"

        cursor.execute(query)
        proteins = cursor.fetchall()

        print(f"Found {len(proteins)} proteins to update")

        # Process by PDB ID to minimize API calls
        current_pdb = None
        current_metadata = None
        updated = 0

        for source_id, pdb_id, chain_id in proteins:
            # Fetch metadata if we're on a new PDB
            if pdb_id != current_pdb:
                print(f"\nFetching metadata for {pdb_id}...")
                current_pdb = pdb_id
                current_metadata = get_pdb_metadata(pdb_id)
                time.sleep(0.2)  # Rate limiting: ~5 requests/second

            if current_metadata:
                print(f"  Updating {source_id} (chain {chain_id})")
                update_protein_metadata(cursor, source_id, pdb_id, chain_id, current_metadata)
                updated += 1

                # Commit every 50 proteins
                if updated % 50 == 0:
                    conn.commit()
                    print(f"  Committed {updated} updates")

        # Final commit
        conn.commit()
        print(f"\n✓ Updated {updated} proteins")

    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    main()
