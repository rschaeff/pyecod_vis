# CLAUDE.md (Template for pyecod_vis)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**⚠️ IMPORTANT: This is a curation-first application with strict scope boundaries.**
**Read the full contract below before suggesting features.**

## Project Overview

pyecod_vis is a focused, efficient tool for human curation of automated ECOD domain assignments. It enables curators to review, verify, and modify domain predictions from the pyecod pipeline.

**Primary Use Case**: Batch curation of domain assignments
- Review automated predictions
- Accept correct assignments
- Modify boundaries or classifications
- Mark non-domain regions
- Flag uncertain cases for expert review

**What This Is NOT**: General-purpose protein viewer, batch processor, monitoring dashboard, or administrative tool.

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Production server
npm start

# Linting
npm run lint

# Database commands
npx prisma generate        # After schema changes
npx prisma db push         # Push schema to database
npx prisma studio          # Database GUI
```

## Environment Setup

```bash
# Required environment variables
DATABASE_URL=postgresql://user:pass@host:5432/ecod_db
NODE_ENV=development|production
```

## Architecture Overview

### Technology Stack
- **Framework**: Next.js 15 (App Router, Server Components)
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Structure Viewer**: 3Dmol.js (isolated from React)
- **State**: React state + minimal URL params (NO Zustand unless proven necessary)

### Core Principles

1. **Curation-First Design**: Everything optimized for efficient curation workflow
2. **Database-Only**: No filesystem access from frontend
3. **Write Operations First-Class**: Not an afterthought
4. **Structure Viewer Isolation**: Imperative code completely outside React
5. **Component Composition**: Max ~150 lines per component
6. **Reject Features by Default**: When in doubt, say no

### Data Contract with pyecod_prod

**pyecod_prod responsibilities**:
- Run domain prediction pipeline
- Load predictions into database
- Populate curation queue
- Manage file system and batch operations

**pyecod_vis responsibilities**:
- Read curation queue
- Display proteins with context
- Capture curator decisions
- Save modifications to database

**Interface**: See `SCHEMA_CONTRACT.md` for detailed database schema contract.

### Application Structure

```
app/
├── curate/              # Main curation interface (PRIMARY)
│   └── page.tsx
├── api/
│   ├── curation/        # Curation endpoints (writes)
│   │   ├── queue/
│   │   ├── accept/
│   │   ├── modify/
│   │   └── reject/
│   └── proteins/        # Protein data endpoints (reads)
└── layout.tsx

components/
├── curation/            # Curation workflow components
│   ├── CurationWorkspace.tsx
│   ├── QueueSidebar.tsx
│   ├── DomainEditor.tsx
│   ├── CurationActions.tsx
│   └── ContextPanel.tsx
├── structure/           # Structure viewer (isolated)
│   └── ProteinStructureViewer.tsx
└── ui/                  # Reusable UI primitives

lib/
├── structure-viewer/    # Structure viewer manager (imperative, NO React)
│   └── editable-viewer-manager.ts
├── database.ts          # Prisma client
└── types.ts             # TypeScript types
```

## Core Workflows

### Curation Workflow (Primary)

```typescript
// User flow:
1. Open curation session
2. System shows next protein from queue
3. User reviews:
   - Structure with domain highlights
   - Domain list with boundaries
   - Supporting evidence
4. User makes decision:
   - Accept (automated assignment correct)
   - Modify (adjust boundaries/classification)
   - Mark non-domain (region is linker/disordered)
   - Flag for expert (uncertain)
5. System saves decision
6. Repeat with next protein

// Performance target: < 2 minutes per protein
```

### Structure Viewer Integration Pattern

**CRITICAL**: Structure viewer (3Dmol) must be isolated from React to prevent lifecycle conflicts.

```typescript
// lib/structure-viewer/editable-viewer-manager.ts
// Pure imperative code, NO React imports

export class EditableStructureViewerManager {
  private viewer: any = null;
  private container: HTMLElement | null = null;

  // Initialize once, never re-initialize
  initialize(container: HTMLElement, callbacks: Callbacks) {
    if (this.viewer) return; // Already initialized

    this.viewer = $3Dmol.createViewer(container, { ... });
    this.setupCallbacks(callbacks);
  }

  // Imperative update methods (called when props change)
  async loadStructure(pdbId: string) { ... }
  highlightDomains(domains: Domain[]) { ... }
  enableBoundaryEditing(domain: Domain) { ... }

  destroy() { ... }
}
```

```typescript
// components/structure/ProteinStructureViewer.tsx
// Thin React wrapper

'use client';

import { useEffect, useRef } from 'react';
import { structureViewer } from '@/lib/structure-viewer/viewer-instance';

export function ProteinStructureViewer({ pdbId, domains, selectedId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  // Initialize ONCE (empty deps)
  useEffect(() => {
    if (!containerRef.current || mountedRef.current) return;

    structureViewer.initialize(containerRef.current);
    mountedRef.current = true;

    return () => {
      structureViewer.destroy();
      mountedRef.current = false;
    };
  }, []);

  // Update imperatively (don't re-initialize)
  useEffect(() => {
    if (!mountedRef.current) return;
    structureViewer.loadStructure(pdbId);
  }, [pdbId]);

  useEffect(() => {
    if (!mountedRef.current) return;
    structureViewer.highlightDomains(domains, selectedId);
  }, [domains, selectedId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[600px]"
      suppressHydrationWarning
    />
  );
}
```

### Database Query Patterns

**Use Prisma for simple queries**:
```typescript
const protein = await prisma.protein.findUnique({
  where: { id: proteinId },
  include: { domains: true }
});
```

**Use raw SQL for complex queries** (but keep type-safe):
```typescript
const results = await prisma.$queryRaw<DomainWithEvidence[]>`
  SELECT d.*, COUNT(e.id) as evidence_count
  FROM domain_assignments d
  LEFT JOIN domain_evidence e ON d.id = e.domain_id
  WHERE d.protein_id = ${proteinId}
  GROUP BY d.id
`;
```

**Avoid mixing patterns in same route**. Choose one approach per API endpoint.

## Feature Decision Framework

Before implementing ANY feature, ask:

1. **Is this core to the curation workflow?**
   - If NO → REJECT

2. **Can this be done in pyecod_prod CLI?**
   - If YES → REJECT (belongs in prod, not vis)

3. **Can this be a separate tool?**
   - If YES → REJECT (avoid scope creep)

4. **Does this add write operations?**
   - If NO → PROBABLY REJECT (we're a curation tool, not a viewer)

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
❌ **Protein browsing** - Beyond queue navigation

If someone requests these features, point them to:
1. `LESSONS_LEARNED.md` in domain-analysis-dashboard (the cautionary tale)
2. This contract section
3. pyecod_prod CLI documentation

## Common Development Tasks

### Adding a New Curation Decision Type

```typescript
// 1. Update database schema
// schema.prisma - add to enum
enum DecisionType {
  ACCEPT
  MODIFY_BOUNDARIES
  MODIFY_CLASSIFICATION
  MARK_NON_DOMAIN
  FLAG_FOR_EXPERT
  NEW_TYPE_HERE  // <-- add here
}

// 2. Run migration
npx prisma generate

// 3. Add API handler
// app/api/curation/new-decision-type/route.ts
export async function POST(request: NextRequest) {
  const { protein_id, ...data } = await request.json();

  await prisma.curationDecision.create({
    data: {
      protein_id,
      decision_type: 'NEW_TYPE_HERE',
      ...data
    }
  });

  return NextResponse.json({ success: true });
}

// 4. Add UI button/shortcut
// components/curation/CurationActions.tsx
<Button
  onClick={() => handleNewDecisionType(protein)}
  shortcut="x"  // Add keyboard shortcut
>
  New Action
</Button>
```

### Modifying Domain Boundaries

```typescript
// Pattern: Form-based input with visual feedback

function DomainEditor({ domain, onUpdate }: Props) {
  const [start, setStart] = useState(domain.start);
  const [end, setEnd] = useState(domain.end);

  const handleUpdate = () => {
    // Update domain in database
    onUpdate({ ...domain, start, end });

    // Visual feedback on structure
    structureViewer.highlightRegion(start, end);
  };

  return (
    <div>
      <Input
        label="Start"
        value={start}
        onChange={setStart}
        type="number"
      />
      <Input
        label="End"
        value={end}
        onChange={setEnd}
        type="number"
      />
      <Button onClick={handleUpdate}>Update</Button>
    </div>
  );
}
```

### Adding Keyboard Shortcuts

```typescript
// lib/hooks/useCurationHotkeys.ts

export function useCurationHotkeys(handlers: CurationHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement) return;

      switch(e.key) {
        case 'a': handlers.accept(); break;
        case 'r': handlers.reject(); break;
        case 'm': handlers.modify(); break;
        case 'n': handlers.markNonDomain(); break;
        case 'f': handlers.flagForExpert(); break;
        case 'Enter': handlers.saveAndNext(); break;
        case 'j': handlers.nextProtein(); break;
        case 'k': handlers.previousProtein(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
```

## Performance Targets

- **Page load**: < 1 second
- **Structure loading**: < 2 seconds
- **Decision save**: < 500ms
- **Queue navigation**: Instant (< 100ms)
- **Curation throughput**: 30+ proteins/hour

## Common Gotchas

1. **Structure viewer re-initialization**: Always use `useRef` + empty deps for viewer initialization
2. **Domain range indexing**: PostgreSQL ranges are 1-indexed, match PDB/SEQRES numbering
3. **Keyboard shortcuts conflicting with inputs**: Always check `e.target instanceof HTMLInputElement`
4. **Confidence values**: Store as REAL (0-1), display as percentages
5. **Queue priority**: Higher number = higher priority (counterintuitive but conventional)

## Testing Strategy

While there's no formal test suite yet:

1. **Manual testing checklist**:
   - Can complete full curation workflow
   - Keyboard shortcuts work
   - Decisions save correctly
   - Structure viewer doesn't break on navigation
   - No data loss on error

2. **Test with realistic data**:
   - Proteins with 1 domain
   - Proteins with 10+ domains
   - Proteins with no structure
   - Edge cases (single residue domains, overlapping regions)

## Success Metrics

This project succeeds when:
- ✅ Curators can review 30+ proteins per hour
- ✅ Workflow is keyboard-driven and efficient
- ✅ Zero data loss (all decisions saved)
- ✅ New curator productive within 1 hour of training
- ✅ Codebase maintainable (new dev productive in < 1 day)
- ✅ Single clear mental model (no confusion about purpose)

## References

- `SCHEMA_CONTRACT.md` - Database interface with pyecod_prod
- `../domain-analysis-dashboard/LESSONS_LEARNED.md` - What NOT to do
- Prisma docs: https://www.prisma.io/docs
- 3Dmol.js docs: https://3dmol.csb.pitt.edu/
