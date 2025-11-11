# Low-Evidence Chain Display Enhancement Plan

**Created**: 2025-10-25
**Context**: Integrate multi-dimensional evidence for low-evidence chains into pyecod_vis curator dashboard
**Related**: `CURATION_DATA_PIPELINE_PLAN.md`, backfill low-evidence analysis

---

## Problem Statement

Low-evidence chains (~3,586 from backfill with <50% BLAST+HHsearch coverage) are the most scientifically interesting:
- Novel fold candidates
- Remote homologs
- Intrinsically disordered proteins
- Low-quality or fragmentary structures

Curators need comprehensive evidence beyond BLAST/HHsearch to make informed decisions.

---

## Additional Evidence Sources

### 1. Pfam Domain Hits ⭐⭐⭐

**What**: HMM-based family classification (may catch what BLAST missed)

**Schema Addition**:
```sql
CREATE TABLE IF NOT EXISTS ecod_curation.pfam_evidence (
    id SERIAL PRIMARY KEY,
    protein_id INTEGER REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,
    family_name VARCHAR(100),      -- e.g., "PF00001" or "7tm_1"
    family_accession VARCHAR(50),  -- Pfam accession
    evalue DOUBLE PRECISION,
    score DOUBLE PRECISION,
    query_start INTEGER,
    query_end INTEGER,
    query_coverage REAL,
    description TEXT,              -- Family description

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pfam_protein ON ecod_curation.pfam_evidence(protein_id);
CREATE INDEX idx_pfam_evalue ON ecod_curation.pfam_evidence(evalue);
```

**Display in UI**:
- New "Pfam Hits" section in evidence panel (right column)
- Show top 5 hits sorted by E-value
- Highlight if E < 0.01 (significant)
- Visual indicator: Green badge if Pfam hit where ECOD has none

---

### 2. Foldseek Structural Hits ⭐⭐⭐ CRITICAL

**What**: Structure-based search against ECOD (can rescue 10-20% of unknowns)

**Schema Addition**:
```sql
CREATE TABLE IF NOT EXISTS ecod_curation.foldseek_evidence (
    id SERIAL PRIMARY KEY,
    protein_id INTEGER REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,
    target_ecod_domain VARCHAR(100),
    target_ecod_uid VARCHAR(20),
    tm_score REAL,                 -- TM-score (0-1, >0.5 significant)
    fident REAL,                   -- Sequence identity
    alnlen INTEGER,                -- Alignment length
    query_start INTEGER,
    query_end INTEGER,
    evalue DOUBLE PRECISION,
    bits REAL,

    -- ECOD classification of hit
    ref_t_group VARCHAR(50),
    ref_h_group VARCHAR(50),
    ref_x_group VARCHAR(50),
    ref_f_group VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_foldseek_protein ON ecod_curation.foldseek_evidence(protein_id);
CREATE INDEX idx_foldseek_tm ON ecod_curation.foldseek_evidence(tm_score DESC);
```

**Display in UI**:
- **PROMINENT placement** - structural hits are most valuable for PDB chains!
- New "Structural Similarity (Foldseek)" section ABOVE sequence hits
- Show top 5 hits sorted by TM-score
- Color-code by TM-score:
  - TM > 0.7: Green (strong match - likely same fold)
  - TM 0.5-0.7: Yellow (possible homolog)
  - TM < 0.5: Gray (weak match)
- "Rescued by structure" badge if TM > 0.5 with ECOD hit

---

### 3. Secondary Structure Analysis

**What**: % helix/sheet/coil from DSSP

**Schema Addition**:
```sql
ALTER TABLE ecod_curation.protein ADD COLUMN IF NOT EXISTS
    pct_helix REAL,
    pct_sheet REAL,
    pct_coil REAL,
    dssp_total_residues INTEGER;
```

**Display in UI**:
- Add to protein metadata header (below sequence length)
- Visual bar chart: `[Helix: 45%] [Sheet: 12%] [Coil: 43%]`
- Color bars: Helix = red, Sheet = blue, Coil = gray
- Flag if >70% coil (likely disordered)

---

### 4. Disorder Prediction

**What**: IUPred3 disorder score + missing residues

**Schema Addition**:
```sql
ALTER TABLE ecod_curation.protein ADD COLUMN IF NOT EXISTS
    disorder_prediction_pct REAL,  -- % residues with disorder score >0.5
    missing_residues_count INTEGER, -- Unobserved residues in structure
    disorder_method VARCHAR(50);    -- 'iupred3', 'experimental', etc.

CREATE TABLE IF NOT EXISTS ecod_curation.disorder_regions (
    id SERIAL PRIMARY KEY,
    protein_id INTEGER REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,
    start_pos INTEGER,
    end_pos INTEGER,
    disorder_score REAL,           -- Mean IUPred3 score for region
    is_missing BOOLEAN,            -- Missing from structure?

    PRIMARY KEY (protein_id, start_pos, end_pos)
);
```

**Display in UI**:
- Add disorder badge to protein header if >50% disordered
- "Disorder Regions" expandable section
- Overlay disorder regions on sequence viewer (hatched pattern)
- Flag: "High disorder - may not be domain classification target"

---

### 5. Experimental Quality Metrics

**What**: Resolution, R-factor, B-factors (already planned in CURATION_DATA_PIPELINE_PLAN.md)

**Schema** (from existing plan):
```sql
ALTER TABLE ecod_curation.protein ADD COLUMN IF NOT EXISTS
    resolution_angstrom REAL,
    experimental_method VARCHAR(50),
    rfactor_observed REAL,
    mean_bfactor REAL;
```

**Display in UI**:
- Quality badge in protein header:
  - High quality: Resolution <2.5Å, green
  - Medium quality: 2.5-3.5Å, yellow
  - Low quality: >3.5Å, orange
- Show in metadata: "X-ray, 2.1Å, R=0.18"
- Flag low-quality structures: "Low resolution - evidence may be unreliable"

---

### 6. Low Complexity / Compositional Bias

**What**: SEG masked regions

**Schema Addition**:
```sql
ALTER TABLE ecod_curation.protein ADD COLUMN IF NOT EXISTS
    low_complexity_pct REAL,      -- % residues masked by SEG
    has_compositional_bias BOOLEAN;

CREATE TABLE IF NOT EXISTS ecod_curation.low_complexity_regions (
    id SERIAL PRIMARY KEY,
    protein_id INTEGER REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,
    start_pos INTEGER,
    end_pos INTEGER,
    complexity_type VARCHAR(50),   -- 'seg', 'tandem_repeat', 'homopolymer', etc.

    PRIMARY KEY (protein_id, start_pos, end_pos)
);
```

**Display in UI**:
- Badge if >30% low complexity
- Overlay on sequence viewer (different color from disorder)
- Note: "Compositional bias may interfere with homology detection"

---

## UI Layout Enhancements

### Current Layout (from PYECOD_VIS_CLAUDE.md):
```
┌────────────┬──────────────────┬───────────────┐
│ LEFT       │  CENTER          │  RIGHT        │
│ • Summary  │  3D Structure    │  Decision     │
│ • Domains  │  (3Dmol.js)      │  Panel        │
│ • Sequence │                  │               │
└────────────┴──────────────────┴───────────────┘
```

### Enhanced Layout for Low-Evidence Chains:
```
┌────────────┬──────────────────┬───────────────┐
│ LEFT       │  CENTER          │  RIGHT        │
│            │                  │               │
│ Summary    │  3D Structure    │  Decision     │
│ • Quality  │  (3Dmol.js)      │  Panel        │
│ • SS: ████ │                  │               │
│ • Disorder │                  │  ★ NEW ★      │
│            │                  │               │
│ Domains    │  Domain Legend   │  Evidence     │
│ (table)    │                  │  Summary      │
│            │                  │  • Foldseek   │
│            │                  │  • Pfam       │
│ Sequence   │                  │  • BLAST      │
│ (with      │                  │  • HHsearch   │
│ disorder   │                  │               │
│ overlay)   │                  │  Curator      │
│            │                  │  Guidance     │
│            │                  │  (recommendation)
└────────────┴──────────────────┴───────────────┘
```

---

## API Endpoints (pyecod_vis)

### 1. Enhanced Protein Detail
```typescript
// MODIFY: /api/protein/[id]/route.ts

// Add to existing response:
{
  protein: { ...existing fields },
  domains: [ ...existing ],
  evidence: {
    blast: [ ...existing ],
    hhsearch: [ ...existing ],
    pfam: [ ...NEW ],      // From pfam_evidence table
    foldseek: [ ...NEW ],  // From foldseek_evidence table
  },
  quality: {
    resolution: 2.1,
    experimental_method: "X-ray",
    pct_helix: 45.2,
    pct_sheet: 12.1,
    pct_coil: 42.7,
    disorder_pct: 15.3,
    low_complexity_pct: 8.2,
  },
  curation_guidance: {
    recommendation: "rescued_foldseek",  // or "novel_fold", "disordered", etc.
    priority: "high",
    notes: "Foldseek TM=0.72 to e1234A1 suggests ECOD X.1.2.3"
  }
}
```

### 2. Low-Evidence Queue Filter
```typescript
// NEW: /api/queue/low-evidence/route.ts

export async function GET(request: NextRequest) {
  const result = await query(`
    SELECT
      p.*,
      COALESCE(COUNT(f.id), 0) as foldseek_hit_count,
      COALESCE(COUNT(pf.id), 0) as pfam_hit_count,
      MAX(f.tm_score) as best_tm_score
    FROM ecod_curation.protein p
    LEFT JOIN ecod_curation.foldseek_evidence f ON p.id = f.protein_id AND f.tm_score > 0.5
    LEFT JOIN ecod_curation.pfam_evidence pf ON p.id = pf.protein_id AND pf.evalue < 0.01
    WHERE p.partition_coverage < 0.5  -- Low evidence threshold
      AND p.curation_status = 'pending'
    GROUP BY p.id
    ORDER BY
      CASE
        WHEN MAX(f.tm_score) > 0.7 THEN 1  -- Strong Foldseek hit = high priority
        WHEN COUNT(pf.id) > 0 THEN 2       -- Pfam rescue = medium priority
        WHEN p.disorder_prediction_pct < 30 THEN 3  -- Ordered = novel fold candidate
        ELSE 4  -- Low priority
      END,
      p.pdb_release_date DESC
  `);

  return NextResponse.json({ proteins: result.rows });
}
```

---

## UI Components

### 1. Evidence Summary Card (Right Column)

```typescript
// components/EvidenceSummary.tsx
interface EvidenceSummaryProps {
  protein: Protein;
  evidence: {
    blast: BlastHit[];
    hhsearch: HHsearchHit[];
    pfam?: PfamHit[];
    foldseek?: FoldseekHit[];
  };
}

export function EvidenceSummary({ protein, evidence }: EvidenceSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Foldseek (most important for structures!) */}
      {evidence.foldseek && evidence.foldseek.length > 0 && (
        <EvidenceSection
          title="Structural Similarity (Foldseek)"
          icon="🔬"
          priority="high"
        >
          {evidence.foldseek.slice(0, 5).map(hit => (
            <FoldseekHitRow
              key={hit.id}
              hit={hit}
              highlight={hit.tm_score > 0.7}
            />
          ))}
        </EvidenceSection>
      )}

      {/* Pfam */}
      {evidence.pfam && evidence.pfam.length > 0 && (
        <EvidenceSection title="Pfam Domains" icon="🧬">
          {evidence.pfam.slice(0, 5).map(hit => (
            <PfamHitRow key={hit.id} hit={hit} />
          ))}
        </EvidenceSection>
      )}

      {/* Existing BLAST/HHsearch */}
      <EvidenceSection title="Sequence Similarity (BLAST)" icon="🔍">
        {/* ...existing */}
      </EvidenceSection>

      <EvidenceSection title="Profile Search (HHsearch)" icon="🎯">
        {/* ...existing */}
      </EvidenceSection>
    </div>
  );
}
```

### 2. Curation Guidance Panel

```typescript
// components/CurationGuidance.tsx
interface GuidanceProps {
  recommendation: string;
  priority: string;
  notes: string;
}

export function CurationGuidance({ recommendation, priority, notes }: GuidanceProps) {
  const badges = {
    rescued_foldseek: { color: 'green', icon: '🔬', label: 'Rescued by Structure' },
    rescued_pfam: { color: 'green', icon: '🧬', label: 'Rescued by Pfam' },
    novel_fold: { color: 'purple', icon: '⭐', label: 'Novel Fold Candidate' },
    disordered: { color: 'gray', icon: '〰️', label: 'Likely Disordered' },
    low_complexity: { color: 'gray', icon: '▓', label: 'Low Complexity' },
  };

  const badge = badges[recommendation] || badges.novel_fold;

  return (
    <div className={`p-4 rounded border-2 border-${badge.color}-500`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{badge.icon}</span>
        <span className="font-bold">{badge.label}</span>
        <PriorityBadge priority={priority} />
      </div>
      <p className="text-sm text-gray-700">{notes}</p>
    </div>
  );
}
```

### 3. Quality Metrics Display

```typescript
// components/QualityMetrics.tsx
export function QualityMetrics({ protein }: { protein: Protein }) {
  return (
    <div className="space-y-2">
      {/* Resolution badge */}
      <QualityBadge
        value={protein.resolution_angstrom}
        label="Resolution"
        thresholds={[2.5, 3.5]}
        colors={['green', 'yellow', 'orange']}
        unit="Å"
      />

      {/* Secondary structure bar */}
      <div className="flex gap-1 h-4">
        <div
          className="bg-red-500"
          style={{ width: `${protein.pct_helix}%` }}
          title={`Helix: ${protein.pct_helix.toFixed(1)}%`}
        />
        <div
          className="bg-blue-500"
          style={{ width: `${protein.pct_sheet}%` }}
          title={`Sheet: ${protein.pct_sheet.toFixed(1)}%`}
        />
        <div
          className="bg-gray-300"
          style={{ width: `${protein.pct_coil}%` }}
          title={`Coil: ${protein.pct_coil.toFixed(1)}%`}
        />
      </div>

      {/* Disorder warning */}
      {protein.disorder_prediction_pct > 50 && (
        <div className="text-sm text-orange-600 flex items-center gap-1">
          <span>⚠️</span>
          <span>{protein.disorder_prediction_pct.toFixed(0)}% disordered</span>
        </div>
      )}
    </div>
  );
}
```

---

## Data Pipeline (pyecod_prod)

### Integration Point

After HHsearch post-processing completes, run additional analysis:

```bash
# In production workflow
cd /data/ecod/pdb_updates/backfill_2023_2025/blast

# 1. Identify low-evidence chains
python analyze_hhsearch_impact.py  # Generates list of <50% coverage chains

# 2. Run comprehensive analysis
python run_low_evidence_analysis.py \
    --chains low_evidence_chains.txt \
    --output-dir low_evidence_analysis/ \
    --submit  # SLURM batch submission

# 3. Load results to database
python load_low_evidence_analysis.py \
    --analysis-dir low_evidence_analysis/ \
    --target-schema ecod_curation
```

---

## Implementation Phases

### Phase 1: Schema & Data Collection (Week 1)

**pyecod_prod**:
- [ ] Create schema tables (pfam_evidence, foldseek_evidence, disorder_regions, etc.)
- [ ] Implement Pfam search script
- [ ] Implement Foldseek search script
- [ ] Implement IUPred3 disorder prediction
- [ ] Test on small sample (~100 chains)

### Phase 2: Database Loading (Week 2)

**pyecod_prod**:
- [ ] Create `load_low_evidence_analysis.py` script
- [ ] Batch process 4,038 HHsearch chains (identify low-evidence subset)
- [ ] Run Pfam + Foldseek on low-evidence chains
- [ ] Load results to ecod_curation schema

### Phase 3: API Integration (Week 3)

**pyecod_vis**:
- [ ] Modify `/api/protein/[id]/route.ts` to include new evidence
- [ ] Create `/api/queue/low-evidence/route.ts`
- [ ] Add quality metrics to protein response
- [ ] Add curation guidance logic

### Phase 4: UI Components (Week 4)

**pyecod_vis**:
- [ ] Build `EvidenceSummary` component
- [ ] Build `CurationGuidance` component
- [ ] Build `QualityMetrics` component
- [ ] Update protein detail page layout
- [ ] Add low-evidence queue filter

### Phase 5: Testing & Refinement (Week 5)

- [ ] Test on known novel folds
- [ ] Test on known disordered proteins
- [ ] Test on rescued chains (Foldseek/Pfam hits)
- [ ] Curator user testing
- [ ] Adjust recommendation logic based on feedback

---

## Success Metrics

- ✅ All low-evidence chains have Foldseek + Pfam analysis
- ✅ Foldseek rescues 10-20% of unknowns (TM > 0.5)
- ✅ Pfam rescues additional 15-25% (E < 0.01)
- ✅ Curators can identify novel fold candidates in <1 minute
- ✅ Disordered proteins flagged automatically (>50% disorder)
- ✅ Curation guidance accuracy >80% (validated by curator feedback)

---

## Notes

- **Foldseek is CRITICAL** for PDB chains (we have structures!)
- Build on existing CURATION_DATA_PIPELINE_PLAN.md (don't duplicate)
- Keep UI focused - don't overwhelm curators with data
- Recommendation logic should be conservative (flag uncertainty)
- Integrate with existing evidence display (don't replace BLAST/HHsearch)

---

**Dependencies**:
- Requires completion of HHsearch post-processing (Job 322407)
- Leverages existing pyecod_vis infrastructure
- Complements CURATION_DATA_PIPELINE_PLAN.md

**Next Steps**:
1. Wait for HHsearch results analysis to identify final low-evidence set
2. Prioritize Foldseek + Pfam search (highest value)
3. Create schema tables in ecod_curation
4. Begin data collection pipeline
