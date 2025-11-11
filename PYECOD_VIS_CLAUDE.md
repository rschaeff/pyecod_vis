# CLAUDE.md - pyecod_vis Curation Interface

This file provides guidance to Claude Code when working with code in this repository.

**⚠️ IMPORTANT: This is a curation-first application with strict scope boundaries.**

## Project Overview

pyecod_vis is a focused web application for human curation of automated ECOD domain assignments. Curators review predictions from the pyecod pipeline, verify or modify domain boundaries, and validate classifications.

**Primary Use Case**: Efficient batch curation of domain assignments
- Review automated predictions with 3D structure context
- Accept correct assignments
- Modify boundaries or classifications as needed
- Mark problematic cases for expert review
- Track curation decisions with full audit trail

**What This Is NOT**: General-purpose protein viewer, batch processor, monitoring dashboard, or administrative tool.

## Current Status (2025-10-20)

**Working Features**:
- ✅ Queue page with sorting, filtering, pagination
- ✅ 3-column desktop-optimized protein detail view
- ✅ 3D structure viewer with domain coloring (3Dmol.js)
- ✅ Domain boundary editing (manual adjustment)
- ✅ Curation workflow (approve/reject/flag)
- ✅ Transaction-based database updates
- ✅ Authentication system (bcrypt)
- ✅ Evidence display (BLAST/HHsearch hits)
- ✅ Keyboard shortcuts (planned, UI hints present)

**Next Priorities** (see CURATION_UX_IMPROVEMENTS.md):
- Cluster-based queue view (show representatives)
- Unclassified region highlighting
- Publication metadata integration
- Multi-context structure views (full PDB, domain superposition)

## Development Commands

```bash
# Development server (local)
npm run dev

# Development server (network accessible)
npm run dev:network

# Development server (leda deployment)
npm run dev:leda

# Production build
npm run build

# Production server (leda deployment)
npm start

# Linting
npm run lint
```

## Environment Setup

```bash
# Required environment variables (.env.local)
DB_HOST=dione
DB_PORT=45000
DB_NAME=ecod_protein
DB_USER=ecod
DB_PASSWORD=<required>  # Must be set

# Optional
NODE_ENV=development|production
```

## Architecture Overview

### Technology Stack

- **Framework**: Next.js 15.0 (App Router, React Server Components)
- **UI Library**: React 18.3
- **Database**: PostgreSQL via raw `pg` (node-postgres) connection pool
- **Styling**: Tailwind CSS 3.4
- **Structure Viewer**: 3Dmol.js 2.5.3 (isolated from React lifecycle)
- **Client State**: React state + SWR 2.2 for data fetching
- **Authentication**: bcrypt for password hashing

**Key Decision**: Using raw SQL via `pg` instead of Prisma for:
- Direct control over complex queries
- Better performance for scientific database schemas
- Easier transaction management
- Simpler deployment (no migration files)

### Core Principles

1. **Curation-First Design**: Everything optimized for efficient curation workflow
2. **Database-Only Interface**: No filesystem access from frontend
3. **Write Operations First-Class**: Not an afterthought - full transaction support
4. **Structure Viewer Isolation**: 3Dmol.js completely outside React lifecycle
5. **Component Composition**: Focused, maintainable components
6. **Reject Features by Default**: When in doubt, say no

### Data Contract with pyecod_prod

**pyecod_prod responsibilities**:
- Run domain prediction pipeline
- Load predictions into database (`ecod_curation` schema)
- Populate curation queue
- Manage file system and batch operations
- Provide structure files via API

**pyecod_vis responsibilities**:
- Read curation queue from database
- Display proteins with 3D structure context
- Capture curator decisions (approve/reject/modify)
- Save curation results to database
- Navigate to next protein in queue

**Interface**: Database tables in `ecod_curation` schema (see `src/lib/types.ts` for complete data models).

### Application Structure

```
src/
├── app/
│   ├── page.tsx                    # Home page
│   ├── queue/page.tsx              # Curation queue (PRIMARY)
│   ├── protein/[id]/page.tsx       # Protein detail + curation (PRIMARY)
│   ├── browse/page.tsx             # Browse proteins
│   ├── stats/page.tsx              # Statistics
│   ├── test-viewer/page.tsx        # 3Dmol.js testing
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   └── api/
│       ├── queue/
│       │   ├── route.ts            # Get next protein from queue
│       │   └── all/route.ts        # Get all proteins for queue table
│       ├── protein/[id]/route.ts   # Get protein + domains + evidence
│       ├── structure/[id]/route.ts # Get PDB/CIF structure file
│       ├── curate/route.ts         # POST: Save curation decision
│       └── auth/
│           ├── login/route.ts      # POST: Login
│           ├── logout/route.ts     # POST: Logout
│           └── me/route.ts         # GET: Current user
│
├── components/
│   ├── Navigation.tsx              # Top navigation bar
│   └── StructureViewer.tsx         # 3Dmol.js wrapper (isolated)
│
└── lib/
    ├── db.ts                       # PostgreSQL connection pool
    ├── types.ts                    # TypeScript interfaces
    └── auth.ts                     # Authentication helpers
```

## Core Workflows

### Curation Workflow (Primary)

```typescript
// User flow:
1. Navigate to /queue
2. See table of proteins sorted by priority
3. Click "Curate →" on a protein
4. Review protein detail page:
   - Left: Domain table, protein metadata, sequence
   - Center: 3D structure with domain coloring
   - Right: Curation decision panel
5. Optionally adjust domain boundaries
6. Make decision:
   - ✓ Approve All Domains (green button)
   - ✗ Reject Partitioning (red button)
   - ⚠ Flag for Review (yellow button)
   - Skip (return later)
7. System saves decision in transaction:
   - Updates domain_assignment table
   - Records curation_decision_log
   - Updates protein.curation_status
   - Creates boundary_history if modified
8. Automatically navigate to next protein

// Performance target: < 2 minutes per protein
```

### Database Architecture

**Primary Tables** (in `ecod_curation` schema):

```sql
-- Protein metadata
protein (
  id, source_id, pdb_id, chain_id,
  sequence, sequence_length,
  partition_coverage, domain_count, partition_quality,
  curation_status, curation_source,
  release_date, processed_at
)

-- Domain assignments
domain_assignment (
  id, protein_id, domain_number,
  start_pos, end_pos, residue_range,
  automated_start_pos, automated_end_pos,  -- Original predictions
  assigned_t_group, assigned_h_group, assigned_x_group, assigned_f_group,
  best_match_ecod_uid, assignment_method,
  confidence, curator_decision, curator_name, curated_at
)

-- Evidence from BLAST/HHsearch
domain_evidence (
  id, domain_id, evidence_type,
  hit_ecod_domain_id, hit_ecod_uid,
  evalue, score, identity, similarity,
  query_coverage, hit_coverage,
  query_range, hit_range,
  ref_t_group, ref_h_group, ref_x_group, ref_f_group
)

-- Audit trail
curation_decision_log (
  protein_id, decision, curator_name,
  curator_notes, decision_timestamp
)

domain_boundary_history (
  domain_id, old_start_pos, old_end_pos,
  new_start_pos, new_end_pos,
  modified_by, modification_reason
)
```

### Database Query Patterns

**Use raw SQL via `query()` helper**:

```typescript
import { query, getClient } from '@/lib/db';

// Simple query
const result = await query<Protein[]>(
  'SELECT * FROM ecod_curation.protein WHERE id = $1',
  [proteinId]
);

// Complex query with JOIN
const result = await query<DomainWithEvidence[]>(`
  SELECT
    d.*,
    json_agg(e.*) as evidence
  FROM ecod_curation.domain_assignment d
  LEFT JOIN ecod_curation.domain_evidence e ON d.id = e.domain_id
  WHERE d.protein_id = $1
  GROUP BY d.id
  ORDER BY d.domain_number
`, [proteinId]);

// Transaction
const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('UPDATE ...', [...]);
  await client.query('INSERT ...', [...]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Structure Viewer Integration Pattern

**CRITICAL**: 3Dmol.js viewer must be isolated from React lifecycle to prevent re-initialization bugs.

**Current Implementation** (working pattern):

```typescript
// components/StructureViewer.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export default function StructureViewer({ proteinId, domains }: Props) {
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(null);
  const [viewer, setViewer] = useState<any>(null);

  // Callback ref - only called when element attaches to DOM
  const viewerRef = useCallback((element: HTMLDivElement | null) => {
    setViewerElement(element);
  }, []);

  // Initialize viewer ONCE when element becomes available
  useEffect(() => {
    if (!viewerElement) return;

    let isMounted = true;

    const loadAndRender = async () => {
      // Import 3Dmol dynamically
      const module = await import('3dmol/build/3Dmol.js');
      const $3Dmol = (module as any).default || module;

      if (!isMounted) return;

      // Fetch structure
      const response = await fetch(`/api/structure/${proteinId}`);
      const structureData = await response.text();

      // Initialize viewer
      const viewerInstance = $3Dmol.createViewer(viewerElement, {
        backgroundColor: 'white'
      });

      // Add model
      const format = structureData.includes('data_') ? 'cif' : 'pdb';
      viewerInstance.addModel(structureData, format);

      // Extract chain from proteinId (e.g., "8yl2_F" -> "F")
      const chainId = proteinId.split('_')[1];

      // Style: default gray
      viewerInstance.setStyle({}, { cartoon: { color: '#CCCCCC' } });

      // Color domains on target chain only
      domains.forEach((domain, index) => {
        const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length];
        viewerInstance.setStyle(
          { chain: chainId, resi: `${domain.start_pos}-${domain.end_pos}` },
          { cartoon: { color, opacity: 0.9 } }
        );
      });

      // Render
      viewerInstance.zoomTo();
      viewerInstance.render();

      setViewer(viewerInstance);
    };

    loadAndRender();

    return () => { isMounted = false; };
  }, [proteinId, domains, viewerElement]);

  return (
    <div className="relative">
      <div ref={viewerRef} style={{ width, height }} />
      {/* Loading/error overlays */}
    </div>
  );
}
```

**Key Points**:
- Use callback ref pattern (`useCallback` + `useState`)
- Dynamic import of 3Dmol.js (client-side only)
- Single initialization per mount
- Include `chain` in selection to avoid coloring all chains
- Use SEQRES numbering (start_pos/end_pos from database)

## Feature Decision Framework

Before implementing ANY feature, ask:

1. **Is this core to the curation workflow?**
   - If NO → REJECT

2. **Can this be done in pyecod_prod CLI?**
   - If YES → REJECT (belongs in backend, not web UI)

3. **Can this be a separate tool?**
   - If YES → REJECT (avoid scope creep)

4. **Does this enable better curation decisions?**
   - If NO → PROBABLY REJECT

5. **Will this complicate the mental model?**
   - If YES → REJECT (focus and simplicity are paramount)

**Default: REJECT the feature**

## Explicitly Rejected Features

These features have been explicitly rejected to maintain focus:

❌ **PDB sync monitoring** - Operations task, belongs in pyecod_prod CLI
❌ **Pipeline execution/configuration** - Backend task
❌ **Batch processing orchestration** - Backend task
❌ **Statistics dashboards** - Generate via scripts/reports
❌ **Administrative reporting** - CLI or automated emails
❌ **File system management** - Backend task
❌ **Multi-user collaboration** (v1) - Add only if proven necessary
❌ **Publication figure generation** - Different tool
❌ **Architecture exploration** - Different tool
❌ **Protein browsing** (beyond queue) - Out of scope

If someone requests these features, point them to:
1. `CURATION_UX_IMPROVEMENTS.md` (approved enhancements)
2. This contract section
3. pyecod_prod CLI documentation

## Common Development Tasks

### Adding a New API Endpoint

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const result = await query(
      'SELECT * FROM ecod_curation.protein LIMIT 10'
    );

    return NextResponse.json({ proteins: result.rows });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // ... handle POST
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Bad request' },
      { status: 400 }
    );
  }
}
```

### Modifying Domain Boundaries

Current implementation in `/protein/[id]/page.tsx`:

```typescript
// State for edited boundaries
const [editedBoundaries, setEditedBoundaries] = useState<{
  [key: number]: {start: number, end: number}
}>({});

// Handler
const handleBoundaryChange = (domainId: number, field: 'start' | 'end', value: number) => {
  setEditedBoundaries(prev => ({
    ...prev,
    [domainId]: {
      start: field === 'start' ? value : (prev[domainId]?.start || domain.start_pos),
      end: field === 'end' ? value : (prev[domainId]?.end || domain.end_pos),
    }
  }));
};

// On submit, use editedBoundaries or fallback to original
domains.map(domain => ({
  domain_id: domain.id,
  start_pos: editedBoundaries[domain.id]?.start || domain.start_pos,
  end_pos: editedBoundaries[domain.id]?.end || domain.end_pos,
  curator_decision: editedBoundaries[domain.id] ? 'modified' : 'approved'
}))
```

### Adding Keyboard Shortcuts

To implement (UI hints already present):

```typescript
// lib/hooks/useCurationHotkeys.ts

export function useCurationHotkeys(handlers: CurationHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;

      switch(e.key.toLowerCase()) {
        case 'a': handlers.approve(); break;
        case 'r': handlers.reject(); break;
        case 'f': handlers.flag(); break;
        case 's': handlers.skip(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

// Usage in /protein/[id]/page.tsx
useCurationHotkeys({
  approve: handleApprove,
  reject: handleReject,
  flag: handleFlag,
  skip: () => router.push('/queue')
});
```

## Performance Targets

- **Page load**: < 1 second
- **Structure loading**: < 2 seconds
- **Decision save**: < 500ms
- **Queue navigation**: < 100ms
- **Curation throughput**: 30+ proteins/hour

## Common Gotchas

1. **Structure viewer re-initialization**: Use callback ref pattern, not regular ref
2. **Domain range indexing**: SEQRES numbering (1-indexed), not ATOM numbering
3. **Chain selection in 3Dmol**: Always include `chain` in selection to avoid coloring all chains
4. **Transaction cleanup**: Always release client in `finally` block
5. **SWR caching**: May need to mutate cache after POST operations
6. **Keyboard shortcuts**: Check if target is input field before handling

## Current Layout (3-Column Desktop)

The protein detail page uses a **desktop-optimized 3-column layout**:

```
┌─────────────────────────────────────────────────────────┐
│  Header: Protein ID, Quality Badge, Metrics             │
├──────────────┬────────────────────┬─────────────────────┤
│ LEFT (4 col) │  CENTER (5 col)    │  RIGHT (3 col)      │
│              │                    │                     │
│ • Summary    │  3D Structure      │  Decision Panel     │
│ • Domain     │  (3Dmol.js)        │  • Approve          │
│   Table      │                    │  • Reject           │
│ • Sequence   │  Domain Legend     │  • Flag             │
│   (collapse) │                    │  • Skip             │
│              │                    │                     │
│              │                    │  Domain Details     │
│              │                    │  (expandable)       │
└──────────────┴────────────────────┴─────────────────────┘
```

- **Grid**: 12 columns (4-5-3 split)
- **Max width**: 1800px
- **Sticky**: Structure + decision panel stay visible on scroll
- **Responsive**: Collapses on smaller screens (not priority - curators use desktops)

## Testing Strategy

While there's no formal test suite yet:

1. **Manual testing checklist**:
   - ✓ Can complete full curation workflow
   - ✓ Structure viewer loads and colors domains correctly
   - ✓ Decisions save to database (check with psql)
   - ✓ Queue pagination and sorting work
   - ✓ Boundary editing updates correctly
   - ○ Keyboard shortcuts work (not implemented yet)
   - ✓ Navigation to next protein works

2. **Test with realistic data**:
   - Proteins with 1 domain
   - Proteins with 5+ domains
   - Low coverage proteins
   - Different chain IDs (A, B, AA, etc.)

## Success Metrics

This project succeeds when:
- ✅ Curators can review 30+ proteins per hour
- ○ Workflow is keyboard-driven and efficient (shortcuts not implemented)
- ✅ Zero data loss (transactions ensure atomicity)
- ✅ New curator productive within 1 hour (clean interface)
- ✅ Codebase maintainable (clear structure, ~20 files)
- ✅ Single clear mental model (focused scope)

## References

- `CURATION_UX_IMPROVEMENTS.md` - Planned enhancements (extensive)
- `SESSION_NOTES.md` - Development session notes
- `KNOWN_ISSUES.md` - Current bugs and limitations
- 3Dmol.js docs: https://3dmol.csb.pitt.edu/
- Next.js 15 docs: https://nextjs.org/docs

## Development Notes

**Database Connection**:
- Host: `dione:45000`
- Database: `ecod_protein`
- Schema: `ecod_curation`
- Pool size: 20 connections
- Slow query threshold: 100ms

**Structure File API**:
- Endpoint: `/api/structure/[id]`
- Format: PDB or mmCIF (auto-detected)
- Source: File system on server (managed by pyecod_prod)

**Authentication**:
- Basic bcrypt-based auth
- Curator name hardcoded in frontend (temporary)
- Sessions managed via cookies

**Next Steps** (see CURATION_UX_IMPROVEMENTS.md for details):
1. Implement keyboard shortcuts
2. Add cluster-based queue view
3. Calculate and display unclassified regions
4. Fetch publication metadata from PDB API
5. Add multi-context structure views (full PDB, domain superposition)
