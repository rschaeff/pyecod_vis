# Known Issues - pyecod_vis

## Structure Visualization - Domain Coloring Incorrect

**Status**: Known deficiency, needs pipeline fix
**Priority**: High
**Discovered**: 2025-10-20

### Problem

Domain coloring in 3D structure viewer is currently incorrect because:

1. **SEQRES vs PDB numbering mismatch**:
   - Domain boundaries in database (`start_pos`, `end_pos`) are SEQRES positions (sequential: 1, 2, 3...)
   - CIF structure files use PDB residue numbering (can have gaps, insertion codes, non-sequential)
   - Currently applying SEQRES positions directly to PDB structures → wrong residues colored

2. **Discontinuous ranges not handled**:
   - ECOD allows discontinuous domain definitions (e.g., "1-50,100-150")
   - Current `start_pos`/`end_pos` schema only supports single continuous ranges
   - Need to support multi-segment domains in structure viewer

### Current Behavior

- Loading full CIF files from `/usr2/pdb/data/structures/divided/mmCIF/`
- Coloring domains using SEQRES positions as if they were PDB residue numbers
- Chain selection is now correct (only colors target chain)
- But residue ranges are wrong

### Solution Options

**Option A: Pipeline-level fix (PREFERRED)**
- Add `pdb_residue_range` column to `ecod_curation.domain_assignment`
- During batch load (pyecod → ecod_curation), compute PDB-numbered ranges
  - Parse PDB/CIF structure file
  - Map SEQRES positions to PDB residue numbers
  - Handle insertion codes, gaps, non-sequential numbering
  - Support discontinuous ranges: "A:10-50,A:100-150"
- Store both ranges:
  - `start_pos`/`end_pos` (SEQRES) - for comparisons, coverage calculations
  - `pdb_residue_range` (PDB numbering) - for structure visualization

**Option B: Preprocessing workaround**
- Use `/home/rschaeff/dev/pyecod_vis/scripts/preprocess_structures.py`
- Extract chain-specific PDB files renumbered to SEQRES (1, 2, 3...)
- Structure API serves these instead of full CIF
- SEQRES ranges then work correctly
- Downside: Requires running script on all structures, ongoing maintenance

### Next Steps

1. **Check pyecod_mini pipeline**: Does it already compute PDB ranges?
   - Look for SEQRES→PDB mapping code
   - Check if `residue_range` field is populated with PDB numbering

2. **If not in pipeline**: Add to pyecod batch processing
   - Use BioPython to parse structure and create residue mapping
   - Store PDB-numbered range string in database

3. **Update vis app**: Use `pdb_residue_range` for structure coloring
   - Parse discontinuous ranges: "10-50,100-150" → multiple selections
   - Apply to 3Dmol.js viewer with chain specification

### Related Files

- `/home/rschaeff/dev/pyecod_vis/src/components/StructureViewer.tsx` (lines 133-150)
- `/home/rschaeff/dev/pyecod_vis/src/app/api/protein/[id]/route.ts` (line 66 - `residue_range` field)
- `/home/rschaeff/dev/pyecod_vis/scripts/preprocess_structures.py` (workaround script)

---

## Other Issues

### Minor: Keyboard Shortcuts Not Implemented
- Decision panel shows shortcuts (A/R/F/S) but they don't work yet
- Need to add keyboard event handlers

### Future: Multi-context Structure Views
- Planned: Full PDB view, Chain view, Domain superposition view
- Currently only showing full PDB
- See `CURATION_UX_IMPROVEMENTS.md` for full spec
