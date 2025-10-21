# pyecod_vis: Frontend Strategy Document

**Purpose**: Interactive curation UI for manual domain boundary review and classification assignment in the ECOD workflow.

**Target Users**: 3-5 ECOD curators working concurrently inside firewall

**Primary Goal**: Fast, efficient curation of domain boundaries with minimal friction

---

## 1. Technology Stack Recommendation

### Frontend Framework: **Next.js 14+ (React)**

**Rationale**:
- **Server-side rendering (SSR)**: Pre-render protein pages for instant load
- **API Routes**: Built-in API layer, no separate backend needed
- **File-based routing**: Natural URL structure (`/protein/8s72_A`, `/queue`, `/browse`)
- **React Server Components**: Reduce client-side JS bundle for faster initial load
- **TypeScript support**: Type safety for domain structures
- **Mature ecosystem**: Easy deployment, good documentation

**Alternative considered**: Plain React + Express
- **Rejected**: More boilerplate, no SSR out of box, separate API server complexity

### Structure Visualization: **3Dmol.js**

**Rationale**:
- **Lightweight**: ~200KB, loads fast
- **WebGL-based**: Smooth rendering even for large structures
- **Simple API**: Easy to highlight domains with different colors
- **PDB/CIF support**: Direct file loading
- **No server rendering needed**: Client-side only
- **Proven**: Used by RCSB PDB, many structural biology tools

**Example integration**:
```javascript
// Highlight domain 1-64 in red, 65-120 in blue
viewer.addModel(pdb_data, "pdb");
viewer.setStyle({resi: '1-64'}, {cartoon: {color: 'red'}});
viewer.setStyle({resi: '65-120'}, {cartoon: {color: 'blue'}});
viewer.render();
```

**Alternative considered**: Mol* (RCSB's new viewer)
- **Rejected**: Much heavier (~2MB bundle), slower load, overkill for domain highlighting

### Database Access: **PostgreSQL with pg (node-postgres)**

**Rationale**:
- Direct connection from Next.js API routes
- Leverage existing ecod_curation schema views
- Server-side queries only (no client exposure)

### Structure Files: **Filesystem (Read-Only)**

**Decision**: Use filesystem paths for structure files (justified contract violation)

**Rationale**:
- **Performance**: Reading CIF files (100KB-5MB) from filesystem is 10-100x faster than DB blob storage
- **Size**: Storing in ecod_curation would bloat schema with data that doesn't belong there
- **Immutability**: Structure files are read-only during curation (no writes from pyecod_vis)
- **Operational reality**: pdb_update already manages structures; don't duplicate
- **Clear boundary**: Read-only dependency on stable filesystem location

**Contract Exception**:
```
pyecod_vis READS from:
  ✓ ecod_curation.* (primary data source)
  ✓ Filesystem: /data/ecod/*/structures/*.cif (read-only, PERFORMANCE EXCEPTION)

pyecod_vis NEVER writes to:
  ✗ Filesystem (no structure modifications)
  ✗ pdb_update schema
  ✗ ecod_commons schema
```

**Implementation**:
```typescript
// Structure path resolution
const structurePath = `/data/ecod/batches/${batch}/structures/${pdb_id}_${chain_id}.cif`;
const cif = fs.readFileSync(structurePath, 'utf8');
```

### State Management: **React Context + SWR (stale-while-revalidate)**

**Rationale**:
- **SWR**: Automatic caching, revalidation, optimistic updates
- **React Context**: Simple global state for user session
- **No Redux needed**: Curation is mostly read-heavy with occasional writes

### Styling: **Tailwind CSS**

**Rationale**:
- Rapid prototyping
- Small bundle size (purges unused styles)
- Good for data-heavy UIs (tables, grids)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Queue View   │  │ Protein View │  │  Browse View     │  │
│  │ (Next.js)    │  │ (Next.js)    │  │  (Next.js)       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
│         │                 │                  │              │
│         └─────────────────┴──────────────────┘              │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  3Dmol.js       │ (client-side only)     │
│                  │  Viewer         │                        │
│                  └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                           │
                  HTTPS (JSON API)
                           │
┌─────────────────────────▼───────────────────────────────────┐
│              Next.js Server (API Routes)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  /api/queue          - Get curation queue           │   │
│  │  /api/protein/:id    - Get protein + domains        │   │
│  │  /api/curate         - Submit curation decision     │   │
│  │  /api/structure/:id  - Get cached PDB/CIF           │   │
│  │  /api/search         - Search proteins              │   │
│  │  /api/auth           - Session management           │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  Redis Cache    │ (optional, Phase 2)    │
│                  │  - Structure    │                        │
│                  │  - ECOD lookups │                        │
│                  └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                           │
                  PostgreSQL Connection
                           │
┌─────────────────────────▼───────────────────────────────────┐
│              PostgreSQL (dione:45000)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ecod_curation schema:                              │   │
│  │    - cluster_representatives (queue)                │   │
│  │    - protein (details)                              │   │
│  │    - domain_assignment (boundaries)                 │   │
│  │    - domain_evidence (BLAST hits)                   │   │
│  │                                                      │   │
│  │  ecod_commons schema:                               │   │
│  │    - domains (reference for lookups)                │   │
│  │                                                      │   │
│  │  pdb_update schema:                                 │   │
│  │    - pdb_chain_data (structures)                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Key Views

### 3.1 Queue View (`/queue`)

**Purpose**: Show curators what to work on next

**Data Source**: `ecod_curation.cluster_representatives` view

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  ECOD Curation Queue                    [User: rschaeff ▼] │
│                                                             │
│  Filters: [All] [Low Coverage] [Unassigned] [Large Gaps]  │
│           Cluster: [weekly_20250905_70pct ▼]              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Protein  │ Domains │ Coverage │ Gap │ Cluster │ Pri │  │
│  ├──────────┼─────────┼──────────┼─────┼─────────┼─────┤  │
│  │ 8s72_A   │    1    │   95%    │  -  │  6 mbrs │  5  │  │
│  │ 8yl2_A   │    2    │   87%    │ 40  │  8 mbrs │  8  │  │
│  │ 8abc_A   │    3    │   78%    │ 15  │  2 mbrs │  3  │  │
│  └──────────┴─────────┴──────────┴─────┴─────────┴─────┘  │
│                                                             │
│  [Curate Next] - Opens top priority protein in editor     │
└────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Priority sorting**: High priority (gaps, low coverage, large clusters) at top
- **Cluster indicator**: Shows cluster size (how many members in this cluster) for context
- **Filters**: Quick access to common curation scenarios
- **Keyboard shortcut**: `Enter` → curate next protein
- **Phase 1 note**: Queue shows representatives only; propagation added in Phase 2

**API Endpoint**:
```typescript
GET /api/queue?cluster=weekly_20250905_70pct&filter=all&limit=50

Response:
{
  proteins: [
    {
      protein_id: 123,
      source_id: "8s72_A",
      domain_count: 1,
      partition_coverage: 0.95,
      cluster_size: 6,
      priority: 5,
      has_gap: false
    },
    ...
  ],
  total: 100,
  curated: 12,
  remaining: 88
}
```

### 3.2 Protein Curation View (`/protein/:source_id`)

**Purpose**: Main curation interface - review automated boundaries, approve/modify

**Data Source**:
- `ecod_curation.protein`
- `ecod_curation.domain_assignment`
- `ecod_curation.domain_evidence`
- Structure from `pdb_update.pdb_chain_data` or filesystem

**Layout**:
```
┌────────────────────────────────────────────────────────────────────┐
│  8s72_A                                      [← Queue] [Next: 8yl2_A →] │
│  Representative of cluster with 6 members                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  3D Structure Viewer                          │  │
│  │                                                                │  │
│  │         [Red: Domain 1 (1-64)]                                │  │
│  │         [Structure rendering via 3Dmol.js]                    │  │
│  │                                                                │  │
│  │  Controls: [Cartoon] [Surface] [Rotate] [Reset]              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Sequence (64 residues): MKRILLV...                                │
│  Coverage: 95% (61/64 residues)                                    │
│  Gap: None                                                          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Domain 1                                                      │  │
│  │ ┌────────────────────────────────────────────────────────┐   │  │
│  │ │ Boundaries:                                             │   │  │
│  │ │   Automated:  1-64   [Use These]                       │   │  │
│  │ │   Evidence:   1-63   (BLAST alignment range)           │   │  │
│  │ │   Manual:     [ 1 ] - [ 64 ]  [Update]                │   │  │
│  │ └────────────────────────────────────────────────────────┘   │  │
│  │                                                               │  │
│  │ Classification:                                               │  │
│  │   T-group: 382.1.1  ✓                                        │  │
│  │   H-group: 382.1    ✓                                        │  │
│  │   X-group: 382.1.1  ✓                                        │  │
│  │   F-group: [Unassigned - will run hmmscan in staging]       │  │
│  │   Suggested: 382.1.1.7 (from hit e6wjcC1)                   │  │
│  │                                                               │  │
│  │ Evidence (sorted by evalue):                                 │  │
│  │ ┌────────────────────────────────────────────────────────┐  │  │
│  │ │ BLAST | e6wjcC1 | T:382.1.1 | F:382.1.1.7 | e=2e-18   │  │  │
│  │ │   Identity: 88%  Coverage: 98%  Range: 1-63           │  │  │
│  │ │   [View in ECOD] [View Alignment]                     │  │  │
│  │ └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Cluster members (informational - Phase 1 does not propagate):     │
│    8s72_N (95% identity), 8s72_H (88%), 8s72_L (87%), ...         │
│    Note: In Phase 2, you'll be able to propagate to these members │
│                                                                      │
│  Decision: [✓ Approve] [✗ Reject] [⚠ Needs Review]                │
│  Notes: [Optional curator comments...]                             │
│                                                                      │
│  [Submit and Next →]  [Save Draft]                                 │
└────────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Split view**: Structure (top) + Domain details (bottom)
- **Boundary comparison**: Automated vs Evidence vs Manual override (text input for edits)
- **Evidence context**: Show BLAST hits that led to T/H/X assignment
- **Cluster info**: See cluster members for context (Phase 1: informational only, Phase 2: propagation)
- **Keyboard shortcuts**:
  - `a` → Approve
  - `r` → Reject
  - `n` → Next protein
  - `←/→` → Navigate domains (multi-domain proteins)

**API Endpoints**:
```typescript
GET /api/protein/8s72_A

Response:
{
  protein: {
    id: 123,
    source_id: "8s72_A",
    sequence: "MKRILLV...",
    sequence_length: 64,
    partition_coverage: 0.95,
    cluster_size: 6,
    cluster_members: ["8s72_N", "8s72_H", "8s72_L", ...]
  },
  domains: [
    {
      id: 456,
      domain_number: 1,
      automated_start: 1,
      automated_end: 64,
      current_start: 1,
      current_end: 64,
      assigned_t_group: "382.1.1",
      assigned_h_group: "382.1",
      assigned_x_group: "382.1.1",
      assigned_f_group: null,
      suggested_f_group: "382.1.1.7",
      confidence: 0.92,
      evidence: [
        {
          type: "blast",
          hit_domain_id: "e6wjcC1",
          hit_ecod_uid: 2639608,
          evalue: 2e-18,
          identity: 88.0,
          query_range: "1-64",
          hit_range: "1-63",
          ref_t_group: "382.1.1",
          ref_f_group: "382.1.1.7"
        }
      ]
    }
  ],
  structure_url: "/api/structure/8s72_A.cif"
}
```

```typescript
POST /api/curate

Body:
{
  protein_id: 123,
  curator: "rschaeff",
  decision: "approved", // or "rejected", "needs_review"
  domains: [
    {
      domain_id: 456,
      start_pos: 1,
      end_pos: 64,
      curator_decision: "approved"
    }
  ],
  notes: "Boundaries look good, matches BLAST alignment"
}

Response (Phase 1):
{
  success: true,
  protein_id: 123,
  next_protein: "8yl2_A"
}

Response (Phase 2 with propagation):
{
  success: true,
  protein_id: 123,
  propagated_to: ["8s72_N", "8s72_H", "8s72_L", "8s72_X", "8s72_Y"],
  next_protein: "8yl2_A"
}
```

### 3.3 Browse View (`/browse`)

**Purpose**: Explore curated proteins, cluster statistics, history

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  Browse Proteins                                            │
│                                                             │
│  Tabs: [All Proteins] [By Cluster] [By T-group] [History] │
│                                                             │
│  Search: [8s72_A or T-group or date...        ] [🔍]       │
│                                                             │
│  Filters:                                                   │
│    Status: [☑ Pending] [☑ Curated] [☐ Rejected]           │
│    Batch:  [weekly_20250905 ▼]                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Protein  │ Status  │ Domains │ Curator │ Date       │  │
│  ├──────────┼─────────┼─────────┼─────────┼────────────┤  │
│  │ 8s72_A   │ Curated │    1    │ rschaeff│ 2025-01-20│  │
│  │ 8s72_N   │ Curated │    1    │ auto    │ 2025-01-20│  │
│  │ 8yl2_A   │ Pending │    2    │    -    │     -     │  │
│  └──────────┴─────────┴─────────┴─────────┴────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**API Endpoint**:
```typescript
GET /api/browse?status=curated&batch=weekly_20250905&limit=50

Response:
{
  proteins: [...],
  total: 100,
  stats: {
    pending: 88,
    curated: 12,
    rejected: 0
  }
}
```

### 3.4 Statistics Dashboard (`/stats`)

**Purpose**: Track curation progress, efficiency metrics

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  Curation Statistics                                        │
│                                                             │
│  Batch: weekly_20250905_70pct                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Progress                                              │  │
│  │ ████████████░░░░░░░░░░░░░░░░░░░░░░ 12/100 (12%)     │  │
│  │                                                       │  │
│  │ Representatives curated:  3/18 (17%)                 │  │
│  │ Auto-propagated:          9 proteins                 │  │
│  │ Time saved:              ~18 minutes (9×2min)        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Curator Activity (Last 7 Days)                       │  │
│  │                                                       │  │
│  │ rschaeff:   8 proteins curated                       │  │
│  │ hcheng:     5 proteins curated                       │  │
│  │ auto:       9 proteins (propagated)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Boundary Modifications                                │  │
│  │                                                       │  │
│  │ Accepted automated boundaries: 10 (83%)              │  │
│  │ Modified boundaries:            2 (17%)              │  │
│  │   Avg N-term shift: 1 residue                        │  │
│  │   Avg C-term shift: 3 residues                       │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Data Source**: `ecod_curation.clustering_efficiency` + custom queries

---

## 4. Search Functionality

### Search Bar (Global, in header)

**Scope**: Search proteins by:
- Source ID (e.g., "8s72_A")
- PDB ID (e.g., "8s72") → returns all chains
- T-group (e.g., "382.1.1") → returns all proteins with domains in that T-group
- Date range (e.g., "2025-01-20")
- Curator name (e.g., "rschaeff")

**Implementation**:
```typescript
GET /api/search?q=8s72

Response:
{
  proteins: [
    {source_id: "8s72_A", status: "curated", ...},
    {source_id: "8s72_N", status: "curated", ...},
    ...
  ],
  count: 6
}
```

**PostgreSQL Query**:
```sql
SELECT DISTINCT p.source_id, p.curation_status, p.domain_count
FROM ecod_curation.protein p
LEFT JOIN ecod_curation.domain_assignment da ON p.id = da.protein_id
WHERE
  p.source_id ILIKE '%' || $1 || '%' OR
  p.pdb_id ILIKE '%' || $1 || '%' OR
  da.assigned_t_group ILIKE '%' || $1 || '%'
ORDER BY p.source_id
LIMIT 50;
```

**Performance**: Add GIN index on `source_id`, `pdb_id` for fast text search

---

## 5. Authentication Strategy

### Requirements:
- **Light authentication**: Inside firewall, not expecting attacks
- **Multi-user support**: Track who curated what
- **Session persistence**: Don't re-login every time
- **Simple**: No OAuth/SSO complexity needed

### Recommended Approach: **Session-based auth with simple password**

**Flow**:
1. User visits `/login`
2. Enters username (e.g., "rschaeff") + password
3. Server validates against config file or simple DB table
4. Creates session cookie (httpOnly, secure)
5. Session stored in server memory or Redis

**Implementation**:
```typescript
// pages/api/auth/login.ts
export default async function handler(req, res) {
  const { username, password } = req.body;

  // Validate against simple users table
  const user = await db.query(
    'SELECT * FROM ecod_curation.users WHERE username = $1 AND password_hash = crypt($2, password_hash)',
    [username, password]
  );

  if (user.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create session
  const session = await createSession(username);
  res.setHeader('Set-Cookie', `session=${session}; HttpOnly; Secure; Path=/; Max-Age=86400`);
  res.json({ success: true, username });
}
```

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS ecod_curation.users (
  id serial PRIMARY KEY,
  username varchar(50) UNIQUE NOT NULL,
  password_hash text NOT NULL,  -- bcrypt hash
  full_name varchar(100),
  email varchar(100),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Example users
INSERT INTO ecod_curation.users (username, password_hash, full_name)
VALUES
  ('rschaeff', crypt('password123', gen_salt('bf')), 'R. Dustin Schaeffer'),
  ('hcheng', crypt('password123', gen_salt('bf')), 'Hong Cheng');
```

**Alternative considered**: No authentication
- **Rejected**: Need to track curator decisions for audit trail

**Alternative considered**: OAuth/LDAP
- **Rejected**: Overkill for 3-5 users inside firewall

---

## 6. Performance Optimization

### 6.1 Structure File Caching

**Problem**: Loading CIF files from disk/database on every page load is slow (100-500ms)

**Solution**: Pre-cache structures on server, serve via static endpoint

**Implementation**:
```bash
# On server startup or cron job
mkdir -p /tmp/ecod_vis_cache/structures

# Pre-cache all structures for current batch
SELECT source_id FROM ecod_curation.protein WHERE batch = 'weekly_20250905';
# For each protein:
#   - Fetch CIF from pdb_update.pdb_chain_data or filesystem
#   - Write to /tmp/ecod_vis_cache/structures/8s72_A.cif
#   - Serve via /api/structure/8s72_A.cif
```

**Next.js API Route**:
```typescript
// pages/api/structure/[id].ts
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { id } = req.query; // e.g., "8s72_A"

  const cachePath = `/tmp/ecod_vis_cache/structures/${id}.cif`;

  // Check cache first
  if (fs.existsSync(cachePath)) {
    const cif = fs.readFileSync(cachePath, 'utf8');
    res.setHeader('Content-Type', 'chemical/x-cif');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h browser cache
    return res.send(cif);
  }

  // Fetch from database if not cached
  const result = await db.query(
    'SELECT cif_data FROM pdb_update.pdb_chain_data WHERE pdb_id = $1 AND chain_id = $2',
    [id.substring(0, 4), id.substring(5)]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Structure not found' });
  }

  const cif = result.rows[0].cif_data;

  // Cache for next time
  fs.writeFileSync(cachePath, cif);

  res.setHeader('Content-Type', 'chemical/x-cif');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(cif);
}
```

**Expected performance**:
- Cold load: 100-500ms (database fetch)
- Warm load: 5-10ms (filesystem cache)
- Browser cache: 0ms (served from browser)

### 6.2 ECOD Lookup Pre-calculation

**Problem**: Looking up reference F-groups from ecod_commons on every domain load

**Solution**: Denormalize into `domain_evidence` table during loading

**Already implemented**: `load_to_curation.py` calls `lookup_ecod_domain_info()` and stores `ref_f_group` in evidence table

**No additional work needed**

### 6.3 Queue Pre-calculation

**Problem**: Complex query to compute priority, cluster size, etc.

**Solution**: Use materialized view for queue, refresh on batch load

**Implementation**:
```sql
-- Create materialized view
CREATE MATERIALIZED VIEW ecod_curation.curation_queue_materialized AS
SELECT * FROM ecod_curation.cluster_representatives
WHERE curation_status = 'pending'
ORDER BY priority DESC, cluster_size DESC;

CREATE INDEX idx_queue_mat_priority ON ecod_curation.curation_queue_materialized(priority DESC);

-- Refresh after batch load or curation
REFRESH MATERIALIZED VIEW ecod_curation.curation_queue_materialized;
```

**Alternative**: Regular view is probably fast enough (<100ms) for small batches (100-1000 proteins)

**Recommendation**: Start with regular view, add materialized view if performance degrades

### 6.4 Database Connection Pooling

**Problem**: Opening new DB connection on every API request is slow (50-100ms)

**Solution**: Use connection pool

**Implementation**:
```typescript
// lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: 'dione',
  port: 45000,
  database: 'ecod_protein',
  user: 'ecod',
  password: 'ecod#badmin',
  max: 20, // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}
```

**Expected performance**: <5ms per query (vs 50-100ms without pooling)

### 6.5 Client-side SWR Caching

**Problem**: Re-fetching same protein data when navigating back/forward

**Solution**: Use SWR (stale-while-revalidate) for client-side caching

**Implementation**:
```typescript
// hooks/useProtein.ts
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useProtein(sourceId: string) {
  const { data, error, mutate } = useSWR(
    `/api/protein/${sourceId}`,
    fetcher,
    {
      revalidateOnFocus: false, // Don't refetch on window focus
      dedupingInterval: 60000,  // Dedupe requests within 1min
    }
  );

  return {
    protein: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate
  };
}
```

**Usage in component**:
```typescript
function ProteinPage({ sourceId }) {
  const { protein, isLoading } = useProtein(sourceId);

  if (isLoading) return <Spinner />;

  return <ProteinView protein={protein} />;
}
```

**Expected performance**: Instant navigation between proteins (cached in browser memory)

### 6.6 Pre-fetch Next Protein

**Problem**: Clicking "Next" has a loading delay while fetching next protein

**Solution**: Pre-fetch next protein in queue while curator is reviewing current one

**Implementation**:
```typescript
function ProteinPage({ sourceId, nextSourceId }) {
  const { protein } = useProtein(sourceId);

  // Pre-fetch next protein
  useSWR(`/api/protein/${nextSourceId}`, fetcher);

  return <ProteinView protein={protein} />;
}
```

**Expected performance**: Instant transition to next protein (already loaded)

### 6.7 Summary of Optimizations

| Optimization | Expected Gain | Effort | Priority |
|--------------|---------------|--------|----------|
| Structure caching | 100-500ms → 5ms | Medium | **High** |
| Connection pooling | 50-100ms → 5ms | Low | **High** |
| SWR client cache | 100ms → 0ms (instant) | Low | **High** |
| Pre-fetch next | 100ms → 0ms (instant) | Low | **Medium** |
| Queue materialized view | Minimal (<100ms already) | Medium | **Low** |
| ECOD lookup denorm | Already done | N/A | ✓ Done |

**Total expected page load time**:
- **Initial load**: ~500ms (structure fetch + domain data)
- **With optimizations**: ~50-100ms (cached structure + pooled query)
- **Navigate to next**: ~0ms (pre-fetched)

---

## 7. Deployment Strategy

### Development Environment

```bash
# Clone repo
git clone <pyecod_vis_repo>
cd pyecod_vis

# Install dependencies
npm install

# Configure .env.local
DATABASE_URL=postgresql://ecod:ecod#badmin@dione:45000/ecod_protein
STRUCTURE_CACHE_DIR=/tmp/ecod_vis_cache/structures
SESSION_SECRET=random_secret_key

# Run dev server
npm run dev

# Visit http://localhost:3000
```

### Production Deployment (Inside Firewall)

**Option 1: PM2 (Node.js process manager)**
```bash
# Build production bundle
npm run build

# Start with PM2
pm2 start npm --name "pyecod_vis" -- start
pm2 save
pm2 startup
```

**Option 2: Docker**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**Recommended**: PM2 for simplicity (no Docker overhead)

### Reverse Proxy (Optional)

If deploying alongside other services, use nginx:

```nginx
server {
  listen 80;
  server_name ecod-vis.internal;

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### Monitoring

**Simple approach**: PM2 built-in monitoring
```bash
pm2 monit
pm2 logs pyecod_vis
```

**Advanced** (if needed): Add Sentry for error tracking

---

## 8. Development Phases

### Phase 1: Core Curation (MVP)
**Goal**: Basic curation workflow for single curator

**Features**:
- ✓ Queue view (simple table, shows representatives only)
- ✓ Protein curation view (structure + domains)
- ✓ Approve/reject decisions (text input for boundary edits)
- ✓ Structure viewer (3Dmol.js)
- ✓ Simple authentication (username/password)
- ✓ Database integration
- ✓ Show cluster membership for context (informational only)
- ✗ NO propagation (curators manually curate representatives only)

**Timeline**: 2-3 weeks

**Success Criteria**: Curator can load queue, view protein, approve boundaries, submit decision

**Note**: Phase 1 shows cluster info ("Representative of 6 members") but does NOT propagate decisions. This allows testing the workflow before adding propagation complexity.

### Phase 2: Manual Propagation + Multi-user
**Goal**: Add manual propagation with preview, support multiple curators

**Features**:
- ✓ Manual "Propagate to Cluster" button
- ✓ Propagation preview (show what will happen before confirming)
- ✓ Allow excluding specific cluster members
- ✓ Multi-user session management
- ✓ Curation history view
- ✓ Browse/search functionality

**Timeline**: 1-2 weeks

**Success Criteria**:
- Multiple curators can work concurrently
- Curator can propagate decisions to cluster members after reviewing preview
- No accidental propagation of bad boundaries

**Note**: Phase 2 requires manual action to propagate. Auto-propagation may be considered in Phase 3+ after analyzing real curation data.

### Phase 3: Performance + Polish
**Goal**: Fast, production-ready

**Features**:
- ✓ Structure caching
- ✓ Pre-fetch next protein
- ✓ Statistics dashboard
- ✓ Keyboard shortcuts
- ✓ Mobile-responsive (optional)

**Timeline**: 1 week

**Success Criteria**: <100ms page loads, curator can process 1 protein/minute

### Phase 4: Advanced Features (Post-MVP)
**Optional enhancements**:
- **Graphical boundary editing** (drag on structure or sequence alignment view)
- Batch operations (approve all in cluster)
- Auto-propagation with validation rules (after Phase 2 analysis)
- Export to ECOD commons (accession workflow)
- Integration with hmmscan for F-group assignment
- Automated tests (Playwright)

**Timeline**: As needed

**Note**: Graphical boundary editing was deferred from Phase 1 - implement if curators find text input insufficient after real-world testing.

---

## 9. Technical Risks & Mitigations

### Risk 1: Structure files too large for fast loading
**Likelihood**: Medium
**Impact**: High (slow curation)

**Mitigation**:
- Pre-cache CIF files on server
- Use gzip compression
- Consider PDB format instead of CIF (smaller, faster to parse)
- Lazy-load structure (show domain details first, structure loads async)

### Risk 2: Multiple curators editing same protein
**Likelihood**: Low (inside firewall, small team)
**Impact**: Medium (lost work)

**Mitigation**:
- Optimistic locking: Check `curation_status` before updating
- Show warning if protein curated by someone else since page load
- Add `locked_by` and `locked_at` fields for pessimistic locking (Phase 2)

### Risk 3: Database connection issues (dione:45000)
**Likelihood**: Low (stable internal DB)
**Impact**: High (app unusable)

**Mitigation**:
- Connection pooling with retry logic
- Health check endpoint (`/api/health`)
- Graceful error messages to user

### Risk 4: Next.js complexity for small team
**Likelihood**: Low (good docs, mature ecosystem)
**Impact**: Medium (slower development)

**Mitigation**:
- Use Next.js starter template
- Stick to simple patterns (no advanced features like ISR, Edge Runtime)
- Good documentation in README

---

## 10. API Specification Summary

### Core Endpoints

| Endpoint | Method | Purpose | Response Time Goal |
|----------|--------|---------|-------------------|
| `/api/queue` | GET | Get curation queue | <50ms |
| `/api/protein/:id` | GET | Get protein details | <100ms |
| `/api/curate` | POST | Submit curation decision | <200ms |
| `/api/structure/:id` | GET | Get cached structure | <10ms (cached) |
| `/api/search` | GET | Search proteins | <100ms |
| `/api/auth/login` | POST | Authenticate user | <50ms |
| `/api/auth/logout` | POST | End session | <10ms |
| `/api/stats` | GET | Get curation statistics | <100ms |

### Data Models (TypeScript)

```typescript
interface Protein {
  id: number;
  source_id: string;
  pdb_id: string;
  chain_id: string;
  sequence: string;
  sequence_length: number;
  partition_coverage: number;
  domain_count: number;
  curation_status: 'pending' | 'curated' | 'rejected' | 'needs_review';
  cluster_size?: number;
  cluster_members?: string[];
}

interface Domain {
  id: number;
  domain_number: number;
  automated_start: number;
  automated_end: number;
  current_start: number;
  current_end: number;
  assigned_t_group: string;
  assigned_h_group?: string;
  assigned_x_group?: string;
  assigned_f_group?: string;
  suggested_f_group?: string;
  confidence: number;
  evidence: Evidence[];
}

interface Evidence {
  type: 'blast' | 'hhsearch';
  hit_domain_id: string;
  hit_ecod_uid: number;
  evalue: number;
  identity?: number;
  query_range: string;
  hit_range: string;
  ref_t_group: string;
  ref_f_group?: string;
}

interface CurationDecision {
  protein_id: number;
  curator: string;
  decision: 'approved' | 'rejected' | 'needs_review';
  domains: DomainDecision[];
  notes?: string;
}

interface DomainDecision {
  domain_id: number;
  start_pos: number;
  end_pos: number;
  curator_decision: 'approved' | 'modified' | 'rejected';
}
```

---

## 11. Design Decisions (FINAL)

1. **Structure source**: ✅ **FILESYSTEM (read-only)**
   - **Decision**: Use filesystem paths (`/data/ecod/batches/*/structures/*.cif`)
   - **Rationale**: 10-100x faster than DB, justified contract violation (read-only, performance)
   - **See**: Section 1 for full justification

2. **Domain boundary editing**: ✅ **TEXT INPUT (Phase 1), Graphical (Phase 2+)**
   - **Decision**: Start with simple text input fields for start/end positions
   - **Future**: Graphical drag-on-structure editing in Phase 2+ if curators want it
   - **Rationale**: Simpler to implement, test with real curators first

3. **F-group assignment**: ✅ **SHOW SUGGESTED, NO MANUAL OVERRIDE**
   - **Decision**: Display suggested F-group from reference hit, but don't allow manual assignment
   - **Rationale**: F-groups are NEVER manually assigned, always via hmmscan or inheritance

4. **Cluster propagation**: ✅ **NO AUTO-PROPAGATION (Phase 1), Manual with preview (Phase 2)**
   - **Phase 1 (MVP)**: NO propagation at all, just show cluster membership for context
   - **Phase 2**: Add manual "Propagate to Cluster" button with preview and confirmation
   - **Phase 3+**: Consider auto-propagate only after real curation data analysis
   - **Rationale**: Too many edge cases (sequence length differences, boundary adjustments, errors)

5. **Mobile support**: ✅ **DESKTOP-FIRST**
   - **Decision**: Desktop-first, basic mobile responsiveness (Phase 3)
   - **Rationale**: Curators work at desks, complex UI not suitable for mobile

---

## 12. Summary

**Recommended Stack**:
- **Frontend**: Next.js 14 + React + TypeScript + Tailwind CSS
- **Structure Viewer**: 3Dmol.js
- **Database**: PostgreSQL (existing ecod_curation schema)
- **Auth**: Simple session-based (username/password)
- **Caching**: Server-side structure cache + client-side SWR
- **Deployment**: PM2 on internal server

**Key Performance Optimizations**:
1. Structure file caching (100-500ms → 5ms)
2. Database connection pooling (50ms → 5ms)
3. Client-side SWR caching (instant navigation)
4. Pre-fetch next protein (instant "Next" button)

**Development Timeline**:
- Phase 1 (MVP): 2-3 weeks
- Phase 2 (Multi-user): 1-2 weeks
- Phase 3 (Performance): 1 week
- **Total**: ~4-6 weeks to production-ready

**Success Metrics**:
- Curator can process 1 protein/minute (2min → 1min with optimizations)
- Page loads <100ms
- Zero data loss (audit trail via curation_decision_log)
- 70-90% reduction in manual curation via clustering

---

## Next Steps

1. **Review this strategy document** with team
2. **Set up Next.js project** structure
3. **Create mockups** for Queue and Protein views (Figma or simple HTML)
4. **Begin Phase 1 implementation** (core curation workflow)
5. **Test with real curator** (pilot with 1-2 proteins)
6. **Iterate based on feedback**
