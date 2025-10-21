# Structure Viewer Features - Hover Labels & Manual Range Override

**Date**: 2025-10-21
**Status**: ✅ Implemented

## Feature 1: Residue Hover Labels

### What It Does
When you hover over any residue in the 3D structure viewer, a label appears showing:
- **Residue name** (e.g., ALA, SER, GLY)
- **Chain ID**
- **Residue number** (PDB ATOM numbering)

Example: Hovering over a serine at position 45 in chain A shows: `SER A:45`

### Implementation
**File**: `src/components/StructureViewer.tsx` (lines 216-222)

```typescript
// Add hover labels to show residue information
viewerInstance.setHoverable({}, true, (atom: any) => {
  if (!atom) return '';
  // Show: residue name, chain, and residue number
  return `${atom.resn} ${atom.chain}:${atom.resi}`;
});
```

### User Experience
- **Hover hint displayed** below the structure viewer: "💡 Hover over residues to see chain:position"
- **Works on all atoms** - just move your mouse over the structure
- **No click required** - labels appear automatically
- **Uses PDB ATOM numbering** - the actual residue numbers from the structure file

### Use Case
Perfect for identifying exact residue positions when adjusting domain boundaries manually. Just hover to see which residue you're looking at!

---

## Feature 2: Live Manual Range Override

### What It Does
When you edit domain start/end positions in the "Manual Boundaries" inputs (right panel → Domain X Details → Manual Boundaries), the 3D structure viewer **updates in real-time** to show the modified domain highlighting.

### How to Use

1. **Open a protein page**: http://leda.swmed.edu:3000/protein/8yl2_A
2. **Expand a domain's details** in the right panel (e.g., "Domain 1 Details")
3. **Edit the boundary values** in the "Manual Boundaries" inputs:
   - Change start position (e.g., from 41 to 50)
   - Change end position (e.g., from 334 to 320)
4. **Watch the structure viewer update** automatically
   - Domain highlighting changes immediately
   - Edited domains shown in **blue** with a pencil icon (✎)
   - Console logs show "(EDITED)" for modified domains

### Implementation

**Files Modified**:
1. `src/components/StructureViewer.tsx`:
   - Added `editedBoundaries` prop (lines 13-16, 21, 41)
   - Use edited boundaries when coloring domains (lines 185-187)
   - Re-render when boundaries change (line 259)
   - Show edited domains in blue with pencil icon in legend (lines 322-325)

2. `src/app/protein/[id]/page.tsx`:
   - Pass `editedBoundaries` to StructureViewer (line 386)

**Key Code**:
```typescript
// Use edited boundaries if available
const seqidStart = editedBoundaries[domain.id]?.start ?? domain.start_pos;
const seqidEnd = editedBoundaries[domain.id]?.end ?? domain.end_pos;
const isEdited = editedBoundaries[domain.id] !== undefined;
```

### Visual Feedback

**Domain Legend**:
- **Unedited domains**: Gray text `(41-334)`
- **Edited domains**: Blue text `(50-320) ✎`

**Console Output**:
```
Domain 1 (EDITED): SEQID 50-320 → PDB 50-320
```

### Technical Details

**Reactivity**:
- Structure viewer uses React `useEffect` with `editedBoundaries` in dependency array
- Any change to boundaries triggers full viewer re-render
- SEQID→PDB mapping applied to edited boundaries (if available)

**State Flow**:
1. User types in input field
2. `handleBoundaryChange` updates `editedBoundaries` state
3. StructureViewer re-renders with new boundaries
4. 3Dmol.js redraws structure with new domain highlighting

### Workflow Example

**Scenario**: Domain 1 automated range is 41-334, but you want to adjust it

1. Hover over residues near position 41 to find a better start (e.g., you find 50 looks better)
2. Edit start position input to 50
3. Structure viewer immediately shows domain starting at position 50
4. Adjust end position if needed
5. When satisfied, click "Approve All Domains"
6. Edited boundaries saved as `curator_decision: 'modified'`

---

## Benefits

### For Curators
- **Visual feedback** - See exactly what you're editing in real-time
- **Precise adjustments** - Use hover labels to identify exact residue positions
- **No guesswork** - Immediately see if your boundary adjustment makes sense structurally
- **Faster curation** - No need to reload page or click update button

### For Quality
- **Structural validation** - Curators can verify boundaries make sense in 3D
- **Informed decisions** - See which secondary structures you're including/excluding
- **Reduced errors** - Visual feedback prevents typos and off-by-one errors

---

## Testing

### Test Hover Labels
1. Visit any protein page with a structure
2. Move mouse over structure
3. Should see labels like "SER A:45" appear on hover

### Test Manual Range Override
1. Visit http://leda.swmed.edu:3000/protein/8yl2_A
2. Expand "Domain 1 Details"
3. Change start from 41 to 50
4. Structure should update immediately showing domain starting at 50
5. Domain legend should show "(50-334) ✎" in blue

### Console Verification
Open browser console and look for:
```
[StructureViewer] Coloring 1 domains on chain A...
Domain 1 (EDITED): SEQID 50-334 → PDB 50-334
```

---

## Future Enhancements

### Possible Additions
- **Click to set boundary** - Click on residue to set as start/end position
- **Drag boundaries** - Interactive slider on structure to adjust ranges
- **Undo/reset button** - Quick way to revert to automated boundaries
- **Visual diff** - Show original vs edited boundaries simultaneously
- **Boundary validation** - Warn if edited range overlaps with other domains
- **Keyboard shortcuts** - +/- keys to nudge boundaries by 1 residue

### Performance Considerations
- Currently re-renders entire structure on boundary change
- Could optimize to only re-color affected domain
- 3Dmol.js rendering is fast enough for real-time updates

---

## Files Modified

### pyecod_vis:
- ✅ `src/components/StructureViewer.tsx` - Added hover labels and editedBoundaries support
- ✅ `src/app/protein/[id]/page.tsx` - Pass editedBoundaries to viewer
- ✅ `STRUCTURE_VIEWER_FEATURES.md` - This documentation

## No Breaking Changes

- `editedBoundaries` prop is **optional** (defaults to empty object)
- Existing code without edited boundaries works unchanged
- Backward compatible with all existing protein pages
