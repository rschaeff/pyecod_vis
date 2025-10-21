# Structure Preprocessing Scripts

## Overview

These scripts optimize PDB structure files for fast web viewing by extracting chain-specific PDB files from full mmCIF structures.

## Why Preprocess?

**Problem**: Full mmCIF files from the PDB contain all chains and metadata, making them large (often 1-10 MB+).

**Solution**: Extract only the specific chain needed, creating a smaller PDB file (typically 50-200 KB).

**Benefits**:
- 5-20x smaller file sizes
- Faster download and parsing
- Reduced browser memory usage
- Better user experience in the 3D viewer

## Quick Start

### Process a few proteins for demo/testing:

```bash
# Process first 100 proteins from database
python scripts/preprocess_structures.py --limit 100

# Process specific proteins
python scripts/preprocess_structures.py --proteins 8s72_A 7bq2_B 6xyz_C
```

### Process all proteins:

```bash
# From a file list
python scripts/preprocess_structures.py --protein-list proteins.txt

# From database (all pending)
python scripts/preprocess_structures.py

# From specific batch
python scripts/preprocess_structures.py --batch ecod_weekly_20250905
```

## Requirements

Install dependencies:
```bash
pip install biopython psycopg2-binary
```

Set database password (if needed):
```bash
export ECOD_DB_PASSWORD='your_password'
```

## How It Works

1. **Input**: Reads full mmCIF from `/usr2/pdb/data/structures/divided/mmCIF/{mid}/{pdb}.cif.gz`
2. **Processing**: Uses BioPython to parse CIF and extract specific chain
3. **Output**: Writes chain-specific PDB to `/data/ecod/structures/chains/{pdb}_{chain}.pdb`

## File Lookup Priority

The structure API now searches in this order:

1. **Chain-specific PDB** (preprocessed) - `/data/ecod/structures/chains/{pdb}_{chain}.pdb` ← FASTEST
2. **Batch-specific structure** - `{batch}/structures/{pdb}_{chain}.pdb`
3. **Full mmCIF** (fallback) - `/usr2/pdb/data/structures/divided/mmCIF/{mid}/{pdb}.cif.gz` ← SLOWEST

## Example

```bash
# Before preprocessing:
# API serves: /usr2/pdb/data/structures/divided/mmCIF/s7/8s72.cif.gz (535 KB compressed, ~3 MB uncompressed)
# Contains: All chains (A, B, C, D...) + metadata

# Run preprocessing:
python scripts/preprocess_structures.py --proteins 8s72_A

# After preprocessing:
# API serves: /data/ecod/structures/chains/8s72_A.pdb (~120 KB)
# Contains: Only chain A

# Result: 4-5x smaller, 10x faster loading
```

## Monitoring

The API logs which file type is served:

```bash
# Check server logs to see what's being used
tail -f pyecod_vis.log | grep "Serving"

# Output examples:
Serving PDB (chain-specific): /data/ecod/structures/chains/8s72_A.pdb
Serving CIF (full structure): /usr2/pdb/data/structures/divided/mmCIF/s7/8s72.cif.gz
```

## Production Workflow

For production deployment with many users:

1. Preprocess all proteins before launch:
   ```bash
   python scripts/preprocess_structures.py --limit 1000  # or all proteins
   ```

2. Set up periodic preprocessing for new batches:
   ```bash
   # After each new batch is loaded
   python scripts/preprocess_structures.py --batch ecod_weekly_YYYYMMDD
   ```

3. Monitor logs to ensure preprocessed files are being used

## Troubleshooting

**Chain not found in structure:**
- Check that the chain ID matches the PDB file
- Some chains may be named differently in the PDB vs database

**File not created:**
- Check permissions on `/data/ecod/structures/chains/`
- Verify source CIF file exists in `/usr2/pdb/`

**BioPython errors:**
- Update BioPython: `pip install --upgrade biopython`
- Some very old or malformed CIF files may fail to parse
