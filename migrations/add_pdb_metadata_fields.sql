-- Add PDB metadata fields to protein table
-- Run with: psql -h dione -p 45000 -U ecod -d ecod_protein -f migrations/add_pdb_metadata_fields.sql

BEGIN;

-- Add new metadata columns
ALTER TABLE ecod_curation.protein
  ADD COLUMN IF NOT EXISTS pdb_title TEXT,
  ADD COLUMN IF NOT EXISTS entity_description TEXT,
  ADD COLUMN IF NOT EXISTS entity_id INTEGER,
  ADD COLUMN IF NOT EXISTS pdb_deposition_date DATE,
  ADD COLUMN IF NOT EXISTS pdb_release_date DATE,
  ADD COLUMN IF NOT EXISTS experimental_method VARCHAR(100),
  ADD COLUMN IF NOT EXISTS resolution_angstrom NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS biological_assembly_count INTEGER,
  ADD COLUMN IF NOT EXISTS uniprot_accession VARCHAR(20),
  ADD COLUMN IF NOT EXISTS uniprot_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS uniprot_range VARCHAR(50);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_protein_pdb_id ON ecod_curation.protein(pdb_id);

-- Add comments
COMMENT ON COLUMN ecod_curation.protein.pdb_title IS 'Full structure title from PDB entry';
COMMENT ON COLUMN ecod_curation.protein.entity_description IS 'Chain/entity description from PDB (e.g., "Glycosyltransferase")';
COMMENT ON COLUMN ecod_curation.protein.entity_id IS 'PDB entity ID for this chain';

COMMIT;
