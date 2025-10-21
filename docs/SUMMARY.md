# pyecod_vis Project Summary

**Date**: 2025-01-20
**Status**: Foundation documents complete, ready for implementation

## What We've Created

### 1. Project Contract (`CLAUDE.md`)
- **13KB** comprehensive development guide
- Curation-first architecture principles
- Technology decisions (Next.js 15, 3Dmol, NO Zustand)
- Structure viewer isolation pattern
- Feature rejection framework
- 90+ architectural guidelines

### 2. Schema Contract (`SCHEMA_CONTRACT_v2.md`)
- **24KB** complete database specification
- Based on actual `ecod_commons` and `ecod_rep` schemas
- Full `ecod_curation` schema definition (staging area)
- Data flow diagrams
- SQL for all tables, indexes, views
- Example queries and operations

### 3. Operations Boundary (`OPERATIONS_BOUNDARY.md`)
- **Clear separation**: What pyecod_vis does vs doesn't do
- pyecod_vis: Curation UI only
- pyecod_prod: Accession and operations
- Specification for accession script needed in pyecod_prod

### 4. Implementation Roadmap (`NEXT_STEPS.md`)
- 6-week phased development plan
- Week-by-week milestones
- Testing strategy
- Integration timeline

### 5. Lessons Learned (`../domain-analysis-dashboard/LESSONS_LEARNED.md`)
- **10KB** postmortem of current dashboard
- Specific anti-patterns to avoid
- What went wrong and why
- Decision framework for future features

## Core Architectural Decisions

### ✅ Agreed Upon

1. **Scope**: Curation interface ONLY
   - NOT: PDB monitoring, batch processing, admin tools
   - YES: Review, accept/modify/reject, f-group assignment, mark junk

2. **Database Architecture** (4 schemas):
   ```
   ecod_rep (hierarchy) → ecod_commons (all domains) ← ecod_curation (staging) ← pdb_update (ops)
   ```

3. **Data Flow**:
   - pyecod_prod: Writes pipeline results → `ecod_curation`
   - pyecod_vis: Reads `ecod_curation`, writes curation decisions
   - pyecod_prod: Accession script moves `ecod_curation` → `ecod_commons`

4. **Technology Stack**:
   - Next.js 15 (App Router, Server Components)
   - PostgreSQL + Prisma
   - 3Dmol.js (NOT Mol* - simpler, sufficient)
   - Tailwind CSS
   - NO Zustand unless proven necessary

5. **Structure Viewer Pattern**:
   - Imperative code isolated from React
   - Initialize once, update via method calls
   - Never let React manage WebGL lifecycle

6. **F-Group Assignment**:
   - Curator assigns via UI dropdown (from `ecod_rep.cluster`)
   - REQUIRED before accession to `ecod_commons`
   - pyecod_vis provides UI, pyecod_prod validates

## What's Different from Current Dashboard

| Current Dashboard | pyecod_vis |
|-------------------|------------|
| Kitchen sink (proteins, architecture, audit, curation, monitoring) | Curation ONLY |
| 1000+ line components | Max 150 lines per component |
| Curation bolted on | Curation-first from day one |
| Filesystem + database confusion | Database-only |
| URL state for everything | Minimal URL state |
| Features added speculatively | Features rejected by default |
| Mixed Mol*/3Dmol integration | Proper 3Dmol isolation |
| Read-heavy with write afterthoughts | Writes are first-class |

## Next Actions

### For You (pyecod_prod team)

1. **Review schemas**:
   - `SCHEMA_CONTRACT_v2.md` - Does `ecod_curation` schema work for you?
   - Are field names/types correct?
   - Any missing functionality?

2. **Create `ecod_curation` schema**:
   ```bash
   psql -h dione -p 45000 -U ecod -d ecod_protein < create_ecod_curation_schema.sql
   ```

3. **Update pyecod_prod** to write to `ecod_curation`:
   - After step 8 (partition), load results to `ecod_curation`
   - Populate curation queue based on heuristics
   - Map evidence to domains

4. **Create accession script** (see `OPERATIONS_BOUNDARY.md`):
   - `pyecod_prod/scripts/accession.py`
   - Read from `ecod_curation.ready_for_accession`
   - Validate, assign UIDs, write to `ecod_commons`

### For pyecod_vis Development

**Phase 0: Schema Negotiation** (Before coding)
- Finalize `ecod_curation` schema
- Test: Can pyecod_prod write to it?
- Test: Can pyecod_vis read from it?

**Phase 1: Foundation** (Week 1)
- Initialize Next.js + Prisma
- Generate Prisma client from `ecod_curation` schema
- Basic queue view (read from `curation_queue`)

**Phase 2: Structure Viewer** (Week 2)
- Implement 3Dmol isolation pattern
- Test lifecycle: navigate between proteins without breakage

**Phase 3: Curation Actions** (Week 3)
- Accept/modify/reject buttons
- Keyboard shortcuts (a = accept, m = modify, etc.)
- Session tracking

**Phase 4: Editing** (Week 4)
- Boundary modification (form-based)
- F-group assignment (dropdown from `ecod_rep.cluster`)
- Non-domain region marking

**Phase 5: Polish** (Week 5-6)
- Evidence panel
- Undo/redo
- Performance optimization

## Success Metrics

pyecod_vis will be successful when:

1. **Speed**: Curators review 30+ proteins/hour (< 2 min each)
2. **Efficiency**: Keyboard-driven workflow
3. **Reliability**: Zero data loss
4. **Simplicity**: Single clear purpose, no confusion
5. **Maintainability**: New developer productive in < 1 day
6. **Discipline**: No scope creep (reject features by default)

## Files Created

```
pyecod_vis/
├── CLAUDE.md (13KB)              # Development guide
├── SCHEMA_CONTRACT_v2.md (24KB)  # Database specification
├── OPERATIONS_BOUNDARY.md (7KB)  # What vis does NOT do
├── NEXT_STEPS.md (6KB)           # Implementation roadmap
├── README.md (2KB)               # Quick start
├── SUMMARY.md (this file)        # Project overview
└── .gitignore                    # Standard ignores

domain-analysis-dashboard/
├── LESSONS_LEARNED.md (10KB)     # Postmortem / cautionary tale
└── CLAUDE.md (updated)           # Existing architecture docs
```

## Key Principles to Remember

1. **Reject features by default** - When in doubt, say no
2. **Curation-first design** - Everything serves the curation workflow
3. **Database-only** - No filesystem access from frontend
4. **Structure viewer isolation** - Imperative code outside React
5. **Operations in pyecod_prod** - Accession, validation, cleanup
6. **Read the lessons learned** - Don't repeat the current dashboard's mistakes

---

**The contract is set. Let's build something focused and excellent.**
