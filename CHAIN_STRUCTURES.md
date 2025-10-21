# Chain-Specific Structure Viewing - Complete

**Date**: 2025-10-21
**Status**: ✅ Implemented and tested

## Summary

The interface now displays **chain-specific structures** instead of full multi-chain PDB files. This provides a cleaner, faster viewing experience focused on the protein chain being curated.

## What Was Implemented

### 1. Structure Preprocessing
**Script**: `scripts/preprocess_structures.py`
- Extracts individual chains from mmCIF files using BioPython
- Outputs chain-specific PDB files to `/data/ecod/structures/chains/`
- **File size reduction**: ~90% smaller (e.g., 971KB → 100KB for 8yl2)
- **Load time improvement**: Faster 3Dmol.js rendering

**Processed**: All 100 proteins in current batch
```bash
python scripts/preprocess_structures.py \
  --protein-list /tmp/proteins_to_preprocess.txt \
  --output-dir /data/ecod/structures/chains
```

### 2. Structure API Enhancement
**File**: `src/app/api/structure/[id]/route.ts`

**Priority order** for file lookup:
1. ✅ `/data/ecod/structures/chains/{pdb_id}_{chain_id}.pdb` (BEST - preprocessed)
2. Batch-specific PDB files
3. Batch-specific CIF files
4. Full mmCIF from PDB mirror (FALLBACK)

**Features**:
- Auto-detects format (PDB vs CIF)
- Logs which file is served (for performance monitoring)
- Returns appropriate Content-Type header
- 24-hour cache for better performance

**Example log**:
```
Serving PDB (chain-specific): /data/ecod/structures/chains/8yl2_A.pdb
GET /api/structure/8yl2_A 200 in 4473ms
```

### 3. Structure Viewer Compatibility
**File**: `src/components/StructureViewer.tsx`

Already supports both PDB and CIF formats:
- Auto-detection: Checks for `data_` string (CIF) vs ATOM records (PDB)
- Chain extraction from proteinId (e.g., `8yl2_A` → chain `A`)
- SEQID→PDB residue mapping for correct domain coloring

## Benefits

### User Experience
- **Faster loading**: Smaller files transfer and render faster
- **Cleaner view**: Shows only the chain being curated, not all chains
- **Less confusion**: No need to visually identify which chain among many

### Performance
- **90% file size reduction**:
  - Before: 971KB (full 8yl2 structure with 8 chains)
  - After: 100KB (single chain 8yl2_A)
- **Bandwidth savings**: Especially important for multi-chain complexes
- **3Dmol.js rendering**: Faster with fewer atoms

### Example Comparison

**Before** (full mmCIF):
- Protein: 8yl2_A
- File served: `/usr2/pdb/.../8yl2.cif` (971KB)
- Contains: 8 chains (A, B, C, D, E, F, G, H)
- User sees: All 8 chains, must identify chain A

**After** (chain-specific PDB):
- Protein: 8yl2_A
- File served: `/data/ecod/structures/chains/8yl2_A.pdb` (100KB)
- Contains: Only chain A
- User sees: Exactly what they're curating

## Testing

### API Test
```bash
# Should return PDB format with only chain A
curl http://leda.swmed.edu:3000/api/structure/8yl2_A | head -30

# Output:
ATOM      1  N   SER A  41      63.141 -10.394  93.151  1.00 64.43           N
ATOM      2  CA  SER A  41      64.112 -10.903  92.192  1.00 61.00           C
...
```

### UI Test
Visit these URLs to see chain-specific structures:
- http://leda.swmed.edu:3000/protein/8yl2_A (chain A only)
- http://leda.swmed.edu:3000/protein/8yl2_B (chain B only)

Expected: Each shows only its specific chain, not all 8 chains

## Future Batches

For new weekly batches, run preprocessing:
```bash
# Option 1: Preprocess specific batch
python scripts/preprocess_structures.py --batch ecod_weekly_20251020

# Option 2: Preprocess from protein list
python scripts/preprocess_structures.py --protein-list proteins.txt

# Option 3: Preprocess specific proteins
python scripts/preprocess_structures.py --proteins 8abc_A 8xyz_B
```

## Fallback Behavior

If a chain-specific file doesn't exist:
1. API checks batch directories
2. Falls back to full mmCIF from PDB mirror
3. StructureViewer still works (just slower/larger)
4. Logs indicate which file was served

This ensures the system **never breaks** - it gracefully degrades to full structures if preprocessing hasn't been run.

## Architecture Notes

### Why PDB format instead of mmCIF?
- **Smaller**: PDB format is more compact than mmCIF
- **Faster**: 3Dmol.js parses PDB faster
- **Simpler**: Chain extraction creates cleaner PDB files
- **Compatible**: StructureViewer handles both formats

### Why preprocessing instead of on-demand?
- **Batch efficiency**: Process 100 proteins in ~2 minutes
- **Consistent performance**: Every protein loads fast
- **No runtime overhead**: No BioPython dependency in Next.js
- **Predictable**: Know in advance which structures are ready

## Files Modified

### pyecod_vis:
- ✅ `src/app/api/structure/[id]/route.ts` - Fixed async params, added chain file priority
- ✅ `scripts/preprocess_structures.py` - Already existed, just needed to run it
- ✅ `src/components/StructureViewer.tsx` - Already compatible with PDB format
- ✅ `CHAIN_STRUCTURES.md` - This documentation

## Validation

```bash
# 1. Verify chain files exist
ls -lh /data/ecod/structures/chains/ | head -10

# 2. Check file sizes (should be ~100-300KB for typical proteins)
du -h /data/ecod/structures/chains/8yl2_* | head -5

# 3. Test API returns PDB format
curl -s http://leda.swmed.edu:3000/api/structure/8yl2_A | head -1
# Should start with: ATOM      1  N   ...

# 4. Check server logs show chain-specific files being served
tail -5 pyecod_vis.log
# Should show: Serving PDB (chain-specific): /data/ecod/structures/chains/...
```

## Next Steps (Optional Enhancements)

- **Automatic preprocessing**: Add to `run_production_week_with_cdhit.py` workflow
- **Progress indicator**: Show preprocessing status in UI
- **On-demand fallback**: Trigger preprocessing if file missing (hybrid approach)
- **Compressed storage**: Use gzip for chain PDB files to save disk space
- **Structure quality metrics**: Add per-chain quality scores to database
