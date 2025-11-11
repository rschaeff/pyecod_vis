# Curation Interface UX Improvements

## Problems Identified

### Queue View
1. **PDB chain IDs (9ay5_B) convey no information** - users can't distinguish proteins
2. **Uninformative metrics** - domain count and length don't help with curation decisions
3. **No clustering** - seeing identical chains repeatedly
4. **Not sortable or paginated** - can't navigate efficiently
5. **Scalability issue** - what happens with 10-12 weeks of data?
6. **Action button placement** - "Curate" on right is unintuitive

### Protein Detail View
7. **Unclear action consequences** - what does Approve/Reject actually do?
8. **Ambiguous edge cases** - "no domains" protein: reject (no domains) or approve (no bad domains)?
9. **Sequence pagination** - current format is awkward

## Proposed Solutions

### 1. Queue Table Redesign

#### A. More Informative Columns

**Replace:**
- ~~Protein (9ay5_B)~~ → **Representative + Description**
- ~~Length~~ → **Issues** (actionable information)
- ~~Domains~~ → **Classification** (what we're assigning)

**New column structure:**
```
[Action] | Representative | Issues | Coverage | Classification | Status
[Review] | 9ay5_B (n=47)  | • Low cov | 47%   | T:2004.1.1    | Pending
                          | • Fragment|       | H:2004.1      |
```

**Column Details:**

**Representative Column:**
- Show cluster representative with count: `9ay5_B (n=47)`
- On hover: Show all 47 members
- Single click: Expand to show all members inline
- Color code by experiment type (X-ray, cryo-EM, NMR, model)

**Issues Column (replaces Length/Domains):**
- `• Low coverage (47%)`
- `• Fragment detected`
- `• No classification`
- `• Multiple unassigned regions`
- `• Conflicting evidence`
- Green checkmark if no issues

**Classification Column:**
- Show highest confidence assignment:
  ```
  T: 2004.1.1 (98%)
  H: 2004.1 (87%)
  X: 2004 (45%)
  ```
- Or: `No classification` in gray

#### B. Action Button on Left

**Current:**
```
[Protein] [Length] [Domains] [Coverage] [Quality] [Status] [Curate →]
```

**Proposed:**
```
[🔍] [Representative] [Issues] [Coverage] [Classification] [Status] [⋮]
```

- **Left column:** Primary action button
  - Not clicked: `[Review]` button (prominent, blue)
  - Clicked once: Expand to show quick actions (Approve/Reject/Flag)
  - Full click: Navigate to detail page
- **Right column:** `⋮` menu for secondary actions (export, notes, history)

#### C. Sortable & Paginated

**Add to table header:**
- Click to sort by any column
- Default sort: Most problematic first (low coverage, conflicts)
- Pagination: 50/100/200 per page
- "Load more" infinite scroll option
- Sticky header when scrolling

**Smart sorting options:**
- "Hardest first" - low coverage, conflicts, no classification
- "Easiest first" - good coverage, high confidence, single domain
- "Similar together" - group by T-group

#### D. Clustering Integration

**When clustering is ready:**
- Default view: Show only cluster representatives
- Indicate cluster size: `9ay5_B (n=47 identical)`
- Toggle to "Show all chains" (for manual inspection)
- Batch operations: "Apply decision to entire cluster"

**Visual treatment:**
- Representative row: Normal font weight
- Cluster members (when expanded): Indented, lighter gray
- Applying to cluster: "This will affect 47 proteins"

### 2. Protein Detail View Improvements

#### A. Clear Action Explanations

**Add decision helper at top:**

```
┌─────────────────────────────────────────────────────────────┐
│ Make a decision:                                             │
│                                                               │
│ [✓ Accept]     Domain boundaries and classification are      │
│                correct. Mark as curated.                      │
│                                                               │
│ [✗ Reject]     This protein is a fragment, has errors, or    │
│                cannot be reliably classified. Flag for review.│
│                                                               │
│ [⚠ Needs Work] Boundaries need adjustment or classification  │
│                is uncertain. Will return to queue.            │
│                                                               │
│ [→ Skip]       Not sure yet. Leave for later.                │
└─────────────────────────────────────────────────────────────┘
```

#### B. Guided Decision Tree

**For ambiguous cases, show decision helper:**

**Example: Protein has no domains**
```
This protein has no detected domains.

Is this correct?
( ) Yes, this is a single-domain protein (Accept)
( ) Yes, but coverage is too low to be sure (Reject - fragment)
( ) No, I see domains that weren't detected (Needs Work)
```

**Example: Low coverage**
```
Coverage: 47% (167/288 residues)

Why is coverage low?
( ) Fragment - missing regions in structure (Reject)
( ) Disordered regions - expected (Accept if domains are good)
( ) Classification missed regions (Needs Work)
```

#### C. Action Consequences Preview

**Before confirming, show what will happen:**

```
You are about to ACCEPT 9ay5_B

This will:
✓ Mark protein as curated
✓ Accept domain boundaries: 1-167
✓ Accept classification: T:2004.1.1, H:2004.1
✓ Remove from your queue
✗ Cannot be undone (only by admin)

[Cancel] [Confirm Accept]
```

#### D. Quick Actions Sidebar

**Left sidebar with context:**
```
┌─────────────┐
│ Quick Info  │
├─────────────┤
│ 9ay5_B      │
│ Chain B     │
│ 288 residues│
│             │
│ Issues:     │
│ • Low cov   │
│             │
│ Similar:    │
│ 9ay5_A      │
│ 9ay5_C      │
│ ...47 total │
│             │
│ [View all]  │
└─────────────┘
```

### 3. Better Metrics

#### A. Unclassified Regions

**Add to queue:**
```
Unassigned: 121 residues (42%)
  • 1-45 (N-term)
  • 168-288 (C-term)
```

**Visual:** Sequence bar showing classified (blue) vs unclassified (gray) regions

#### B. Secondary Structure Coverage

**Requires DSSP or similar:**
```
Structure: 73% helix, 12% sheet, 15% coil
Classified: Covers 85% of structured regions ✓
Unassigned: Mostly coil (probably OK)
```

**Visual indicator:**
```
Structure: [====HHHH====SSSS====]
Domains:   [====DDDD=========DDD]
Match:     [✓✓✓✓✓✓✓✓----✓✓✓✓✓✓✓]
```

### 4. Experimental Information

**Add to protein header:**
```
9ay5_B | X-ray Diffraction | 2.1 Å | Released: 2024-09-05
```

**Indicators:**
- 🔬 X-ray
- ❄️ Cryo-EM
- 📡 NMR
- 🖥️ AlphaFold/Model

**Quality flags:**
- High res (<2.5 Å): Green
- Medium res (2.5-3.5 Å): Yellow
- Low res (>3.5 Å): Orange
- Model: Blue

### 5. Sequence View Alternatives

#### Option A: Keep Simple, Fix Pagination

**Current issue:** Paginated in 60-residue chunks with line numbers

**Fix:**
```
  1 SEKILFTGLD NSGKTSIIKVLQKEISQIAMLKPTRQAQRK IFEFLGNDIS EWDLGGQEKY  60
 61 RIAYLKEPTK YFDRSNVCIY VIDIQDRGRM EESISYFSDE VYYTGRHMQE LSGIISGRTL  120
```

- Blocks of 10, spaces every 30 for readability
- Colored by domain assignment
- Hover: Show residue details

#### Option B: Nightingale Integration

**Pros:**
- Professional sequence viewer
- Domain track visualization
- Feature annotations
- Industry standard (used by PDBe, UniProt)

**Cons:**
- Large library (~500 KB gzipped)
- Complexity for simple needs
- Potential version conflicts

**Recommendation:** Start with Option A, consider Nightingale later if you add:
- Variant annotations
- PTM sites
- Active site residues
- Multiple sequence alignments

#### Option C: Hybrid - Custom Domain Track + Simple Sequence

**Best of both worlds:**
```
Domains:  [=====Domain 1=====]         [===Domain 2===]
          1                167       200            288

Sequence: SEKILFTGLD NSGKTSIIKVLQKEISQIAMLKPTRQAQRK IFEFLGNDIS...
```

- Custom SVG domain track (lightweight)
- Simple monospace sequence below
- Click domain → highlight in sequence

### 6. Scalability (10-12 weeks data)

#### A. Pagination & Virtual Scrolling

**For large datasets:**
- Server-side pagination (50-100 proteins per page)
- Virtual scrolling for huge lists (render only visible rows)
- Indexed database queries

**Query optimization:**
```sql
-- Add index on curation_status + partition_quality
CREATE INDEX idx_curation_queue ON protein(curation_status, partition_quality);
```

#### B. Batch Management

**Organize by batches:**
- Default view: Current week only
- Dropdown: "Show batch: ecod_weekly_20250905"
- Archive old batches after curation

#### C. Progress Tracking

```
Your Progress:
  This week: 47 / 125 curated (38%)
  Total: 2,453 proteins curated

Queue Status:
  Pending: 1,847
  In progress: 23 (other curators)
  Completed: 3,201
```

### 7. Implementation Priority

**Phase 1: Critical Fixes (1-2 days)**
- ✓ Move action button to left
- ✓ Add sorting to table
- ✓ Add pagination (50 per page)
- ✓ Add "Issues" column
- ✓ Clear action explanations
- ✓ Decision confirmation dialogs

**Phase 2: Better Metrics (3-5 days)**
- ✓ Calculate unclassified regions
- ✓ Add experimental info (from PDB API)
- ✓ Representative + cluster count
- ✓ Improve sequence display

**Phase 3: Advanced Features (1-2 weeks)**
- ✓ Clustering integration
- ✓ Batch operations
- ✓ Progress tracking
- ✓ Secondary structure analysis

## Example: Improved Queue Row

### Before
```
| 9ay5_B | 288 | 2 | 47% | low_coverage | pending | Curate → |
```

### After
```
[Review] | 9ay5_B (n=47) | • Low coverage (47%)  | 47%  | T: 2004.1.1 (98%) | Pending | ⋮ |
         | 🔬 X-ray 2.1Å | • Fragment detected   |      | H: 2004.1 (87%)   |         |   |
                                                                Click to see 47 identical ↓
```

## Mockup: Decision Helper

```
┌─────────────────────────────────────────────────────────┐
│ 9ay5_B - Decision Assistant                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Current situation:                                       │
│ • Coverage: 47% (167/288 residues)                      │
│ • Domains: 1 detected (residues 1-167)                  │
│ • Unassigned: 121 residues (168-288)                    │
│                                                          │
│ Why is residues 168-288 unassigned?                     │
│                                                          │
│ ( ) Missing in structure (fragment)                     │
│     → Reject: "Incomplete protein, cannot curate"       │
│                                                          │
│ ( ) Disordered/flexible region (normal)                 │
│     → Accept: "Single domain protein with flexible tail"│
│                                                          │
│ ( ) Should be classified but was missed                 │
│     → Needs Work: "Requires manual boundary adjustment"  │
│                                                          │
│                                [Cancel] [Confirm Choice] │
└─────────────────────────────────────────────────────────┘
```

### 8. Protein Detail Layout Redesign

**Current Problem:**
- Responsive design wastes space (curators use desktops, not phones)
- Structure viewer is full width
- Domain cards are sparse and take too much vertical space
- Information is scattered - have to scroll to see everything

**Proposed: Desktop-Optimized 3-Column Layout**

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Back to Queue        9ay5_B • Chain B • 288aa • X-ray 2.1Å       │
├──────────────┬──────────────────────┬─────────────────────────────┤
│   PROTEIN    │    STRUCTURE (3D)    │   DOMAINS & DECISION        │
│              │                      │                             │
│ Info:        │  ┌────────────────┐  │ Domain 1 (1-167)            │
│ PDB: 9ay5    │  │                │  │ T: 2004.1.1 ✓ 98%           │
│ Method:      │  │     [3D VIEW]  │  │ H: 2004.1   ✓ 87%           │
│  X-ray 2.1Å  │  │                │  │ E: 2.7e-45 | Cov: 93%       │
│              │  │                │  │                             │
│ Coverage:    │  └────────────────┘  │ Evidence (3):               │
│ ▓▓▓▓░░░ 47%  │                      │ • blast_domain e8cesA1      │
│              │  Colors:              │   E:2.7e-45 ID:34%         │
│ Issues:      │  ▓ Domain 1          │ • hhsearch                  │
│ • Low cov    │  ░ Unassigned        │   E:1.2e-12                │
│ • Fragment?  │                      │ • profile_match             │
│              │  Controls:            │                             │
│ Experiment:  │  [Rotate][Zoom]      │ Unassigned: 168-288 (121aa) │
│ Released:    │  [Reset]             │ ░░░░░░░░░░░░░░ 42%           │
│ 2024-09-05   │                      │ Likely: C-term disorder     │
│              │                      │                             │
│ Similar (47):│                      │ ┌─────────────────────────┐ │
│ • 9ay5_A     │                      │ │ DECISION                │ │
│ • 9ay5_C     │                      │ ├─────────────────────────┤ │
│ • 9ay5_D     │                      │ │ Issue: Low coverage     │ │
│ [Show all]   │                      │ │                         │ │
│              │                      │ │ [✓ Accept]              │ │
│ Sequence:    │                      │ │ Domain is correct,      │ │
│ SEKILFTGLD   │                      │ │ C-term is disordered    │ │
│ NSGKTSII..   │                      │ │                         │ │
│ [View full]  │                      │ │ [✗ Reject]              │ │
│              │                      │ │ Fragment, cannot curate │ │
│              │                      │ │                         │ │
│              │                      │ │ [⚠ Adjust Boundaries]   │ │
│              │                      │ │                         │ │
│              │                      │ │ [→ Skip]                │ │
│              │                      │ └─────────────────────────┘ │
└──────────────┴──────────────────────┴─────────────────────────────┘
```

**Layout Specifications:**

**Left Column (25% width):**
- Protein metadata (compact)
- Quality indicators
- Cluster information
- Collapsed sequence (expand on click)

**Middle Column (40% width):**
- 3D structure viewer (fixed aspect ratio)
- Domain color legend directly below
- Viewer controls underneath

**Right Column (35% width):**
- Dense domain information (table format, not cards)
- Evidence list (compact, expandable)
- Unassigned regions summary
- Decision panel (always visible, sticky)

**Domain Information - Dense Format:**

Instead of cards:
```
┌─────────────────────────────────────┐
│ DOMAINS (1)                          │
├───┬─────────┬───────────┬───────────┤
│ # │ Range   │ Class     │ Conf      │
├───┼─────────┼───────────┼───────────┤
│ 1 │ 1-167   │ T:2004.1.1│ 98% ✓     │
│   │ 167aa   │ H:2004.1  │ 87% ✓     │
│   │         │           │           │
│   │ Evidence: 3 hits    │           │
│   │ Best: blast e8cesA1 │           │
│   │ E:2.7e-45 ID:34%    │           │
│   │ [Show all ↓]        │           │
└───┴─────────┴───────────┴───────────┘

UNASSIGNED REGIONS (1)
168-288 (121aa, 42%)
Likely: C-term disorder
```

**Benefits:**
- See everything at once (no scrolling for critical info)
- Structure viewer is appropriately sized
- Decision panel always visible
- Denser information layout
- Optimized for 1920x1080+ screens

**Responsive Breakpoint:**
- Desktop (>1400px): 3-column layout
- Laptop (1024-1400px): 2-column (stack decision panel below)
- Tablet/Phone (<1024px): Single column (but who curates on a phone?)

### 9. Recency & Scientific Significance

**Problem:**
Curators are more motivated when they know:
- Their work matters (recent/important structures)
- Context of what they're curating (published research)
- Currency of the queue (is this fresh data or 6 months old?)

**Solution: Add Scientific Context Indicators**

#### A. Recency Indicators

**In Queue Table:**
```
┌──────────────────────────────────────────────────────────────┐
│ Representative    │ Released    │ In Queue │ Issues          │
├──────────────────────────────────────────────────────────────┤
│ 9ay5_B (n=47)     │ 2 days ago  │ 2 days   │ • Low coverage  │
│ 🔬 X-ray 2.1Å     │ ⚡ NEW      │          │                 │
├──────────────────────────────────────────────────────────────┤
│ 8s72_A            │ 3 weeks ago │ 18 days  │ ✓ No issues     │
│ 🔬 X-ray 1.8Å     │             │ ⚠️ OLD   │                 │
└──────────────────────────────────────────────────────────────┘
```

**Badges:**
- ⚡ **NEW** (< 7 days old): Bright green badge
- 📅 **RECENT** (7-30 days): Light green
- ⚠️ **OLD** (30-90 days): Yellow - "Getting stale"
- 🔴 **STALE** (> 90 days): Red - "Needs attention!"

**Sorting Priority:**
- Default: "Newest first" - keep queue fresh
- Option: "Oldest first" - clear backlog
- Smart: "High priority" - new + important

#### B. Publication Information

**In Protein Detail View Header:**
```
┌────────────────────────────────────────────────────────────────┐
│ ← Back to Queue                                                 │
│                                                                 │
│ 9ay5 Chain B • 288 residues • X-ray Diffraction 2.1Å          │
│                                                                 │
│ 📅 Released: 2024-09-05 (2 days ago) ⚡ NEW                    │
│ 📊 In Queue: 2 days                                            │
│                                                                 │
│ 📄 Publication: Nature (2024)                                  │
│    "Structure of novel glycosyltransferase reveals..."         │
│    DOI: 10.1038/s41586-024-xxxxx [View Article →]             │
│    Citations: 0 (too new)                                      │
│                                                                 │
│ 🎯 Priority: HIGH (Recent + High-impact journal)              │
└────────────────────────────────────────────────────────────────┘
```

**Data Sources:**
- PDB release date: From PDB REST API
- Publication info: PDB primary citation
- DOI link: Direct to article
- Citations: Europe PMC or CrossRef API
- Impact: Journal ranking (optional)

**Priority Calculation:**
```
Priority = (Recency Score) × (Impact Score)

Recency Score:
- < 7 days:    1.0 (urgent)
- 7-30 days:   0.8
- 30-90 days:  0.5
- > 90 days:   0.3 (backlog)

Impact Score:
- Nature/Science/Cell:        1.0
- High-impact (IF > 10):      0.8
- Mid-impact (IF 5-10):       0.6
- Standard (IF < 5):          0.4
- Unpublished/deposited only: 0.3
```

#### C. Queue Freshness Dashboard

**At top of queue page:**
```
┌────────────────────────────────────────────────────────────┐
│ QUEUE STATUS                                                │
├────────────────────────────────────────────────────────────┤
│ Total Pending: 1,847 proteins                              │
│                                                             │
│ ⚡ New (< 7 days):      342  [==================    ] 18%  │
│ 📅 Recent (< 30 days):  891  [================      ] 48%  │
│ ⚠️ Aging (< 90 days):   456  [========              ] 25%  │
│ 🔴 Stale (> 90 days):   158  [====                  ]  9%  │
│                                                             │
│ ⏱️ Average age: 23 days                                     │
│ 🎯 Suggested action: Focus on "New" to keep queue fresh    │
└────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Visual feedback on queue health
- Motivation to keep things moving
- Clear prioritization guidance

#### D. Publication Context in Evidence

**Show relevance of structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ WHY THIS MATTERS                                             │
├─────────────────────────────────────────────────────────────┤
│ This structure is from:                                      │
│                                                              │
│ 📄 "Discovery of GT-family enzyme in antibiotic pathway"    │
│    Smith et al., Nature Chemical Biology (2024)             │
│    [Read Paper →]                                           │
│                                                              │
│ 🔬 Key Finding:                                             │
│    First structure of this enzyme family - fills gap in     │
│    ECOD classification. Important for understanding          │
│    antibiotic resistance mechanisms.                         │
│                                                              │
│ 💡 Your curation enables:                                   │
│    • Correct classification of 47 similar structures        │
│    • Training machine learning models                        │
│    • Evolutionary analysis of enzyme family                  │
└─────────────────────────────────────────────────────────────┘
```

**Auto-generated from:**
- PDB primary citation
- Abstract key sentences (NLP)
- Cluster size impact
- Functional annotations

#### E. Curator Impact Tracking

**Show how your work matters:**
```
┌─────────────────────────────────────────────────────────────┐
│ YOUR IMPACT                                                  │
├─────────────────────────────────────────────────────────────┤
│ This Week:                                                   │
│ • 47 proteins curated                                        │
│ • 12 new structures (< 7 days old) ⚡                        │
│ • 8 high-impact publications 📄                             │
│                                                              │
│ Recent Highlights:                                           │
│ ⭐ 9ay5: Nature paper (2 days old)                          │
│    You were first curator - structure now live in ECOD!     │
│                                                              │
│ ⭐ 8s72: Science paper (5 days old)                         │
│    Your classification used by 3 researchers already         │
│                                                              │
│ 📊 Total Impact:                                            │
│ • 2,453 proteins curated                                     │
│ • 847 from papers cited 10+ times                           │
│ • Average curation time: 18 days from release               │
│ • You're keeping the queue fresh! 🎉                        │
└─────────────────────────────────────────────────────────────┘
```

#### F. Smart Notifications

**Highlight exciting structures:**
```
┌────────────────────────────────────────────────────────┐
│ 🔔 NOTABLE STRUCTURES IN QUEUE                          │
├────────────────────────────────────────────────────────┤
│ ⚡ 3 structures from Nature this week                   │
│ 🏆 1 structure from Nobel Prize-winning lab             │
│ 🆕 5 structures representing new ECOD families          │
│ 🔬 2 cryo-EM structures > 2.0Å (high quality!)         │
│                                                         │
│ [Review High-Priority Queue →]                         │
└────────────────────────────────────────────────────────┘
```

### Implementation: Data Sources

#### PDB REST API
```bash
# Get structure metadata
curl https://data.rcsb.org/rest/v1/core/entry/9ay5

Response:
{
  "rcsb_id": "9ay5",
  "rcsb_accession_info": {
    "deposit_date": "2024-08-15",
    "initial_release_date": "2024-09-05"
  },
  "struct": {
    "title": "Crystal structure of glycosyltransferase..."
  },
  "rcsb_primary_citation": {
    "pdbx_database_id_DOI": "10.1038/s41586-024-xxxxx",
    "title": "Discovery of novel enzyme in antibiotic pathway",
    "journal_abbrev": "Nature",
    "year": 2024,
    "pdbx_database_id_PubMed": 39123456
  }
}
```

#### Europe PMC API
```bash
# Get citation count
curl "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1038/s41586-024-xxxxx&format=json"

Response:
{
  "citedByCount": 0  # New paper
}
```

#### Add to Database Schema
```sql
-- Add to protein table
ALTER TABLE ecod_curation.protein ADD COLUMN
  pdb_release_date DATE,
  pdb_deposit_date DATE,
  queue_added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  primary_citation_doi TEXT,
  primary_citation_title TEXT,
  primary_citation_journal TEXT,
  primary_citation_year INTEGER,
  citation_count INTEGER DEFAULT 0,
  priority_score FLOAT;

-- Create index for date sorting
CREATE INDEX idx_protein_dates ON ecod_curation.protein(pdb_release_date DESC, queue_added_date);

-- Add materialized view for queue metrics
CREATE MATERIALIZED VIEW ecod_curation.queue_metrics AS
SELECT
  COUNT(*) FILTER (WHERE age < 7) as new_count,
  COUNT(*) FILTER (WHERE age BETWEEN 7 AND 30) as recent_count,
  COUNT(*) FILTER (WHERE age BETWEEN 30 AND 90) as aging_count,
  COUNT(*) FILTER (WHERE age > 90) as stale_count,
  AVG(age) as avg_age
FROM (
  SELECT EXTRACT(DAY FROM NOW() - queue_added_date) as age
  FROM ecod_curation.protein
  WHERE curation_status = 'pending'
) ages;

-- Refresh daily
REFRESH MATERIALIZED VIEW ecod_curation.queue_metrics;
```

#### Background Job: Fetch Publication Metadata
```python
# scripts/fetch_publication_metadata.py
"""
Fetch publication info for structures in queue.
Run daily as cron job.
"""

import requests
from datetime import datetime

def fetch_pdb_metadata(pdb_id):
    """Fetch metadata from PDB REST API"""
    url = f"https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"
    resp = requests.get(url)
    if resp.status_code == 200:
        data = resp.json()
        return {
            'release_date': data['rcsb_accession_info']['initial_release_date'],
            'deposit_date': data['rcsb_accession_info']['deposit_date'],
            'title': data['struct']['title'],
            'citation': data.get('rcsb_primary_citation', {})
        }
    return None

def calculate_priority(release_date, journal, citation_count):
    """Calculate priority score"""
    age_days = (datetime.now().date() - release_date).days

    # Recency score
    if age_days < 7:
        recency = 1.0
    elif age_days < 30:
        recency = 0.8
    elif age_days < 90:
        recency = 0.5
    else:
        recency = 0.3

    # Impact score (simplified)
    high_impact_journals = ['Nature', 'Science', 'Cell', 'Nat Struct Mol Biol']
    if journal in high_impact_journals:
        impact = 1.0
    elif citation_count > 10:
        impact = 0.8
    else:
        impact = 0.5

    return recency * impact

# Run for all pending proteins
for protein in get_pending_proteins():
    metadata = fetch_pdb_metadata(protein.pdb_id)
    if metadata:
        update_protein_metadata(protein.id, metadata)
```

### Example: Updated Queue Row

**Before:**
```
| 9ay5_B | 288 | 2 | 47% | low_coverage | pending | Curate → |
```

**After:**
```
[Review] | 9ay5_B (n=47)        | ⚡ 2 days ago  | • Low coverage | 47% | T:2004.1.1 | Nature 2024  | ⋮ |
         | 🔬 X-ray 2.1Å        | Queue: 2 days  | • Fragment?    |     | 98% conf   | DOI →        |   |
         | ⭐ High Priority     |                |                |     |            |              |   |
```

**Hover shows full citation:**
```
┌─────────────────────────────────────────────────┐
│ Publication Details                              │
├─────────────────────────────────────────────────┤
│ "Discovery of GT-family enzyme in antibiotic     │
│  biosynthesis pathway"                           │
│                                                  │
│ Smith, J. et al.                                 │
│ Nature 634, 123-128 (2024)                      │
│                                                  │
│ DOI: 10.1038/s41586-024-xxxxx                   │
│ PMID: 39123456                                   │
│ Citations: 0 (published 5 days ago)             │
│                                                  │
│ [View Article →] [View on PubMed →]             │
└─────────────────────────────────────────────────┘
```

### 10. Multi-Context Structure Views

**Problem:**
Currently showing full chain structure, but curators need different contexts:
- **Biological context**: Full PDB (all chains) - is this part of a complex?
- **Curation target**: Full chain - what we're currently classifying
- **Validation context**: Domain comparison - does putative match the reference hit?

**Solution: Tabbed Structure Viewer with Multiple Contexts**

#### A. View Switcher Interface

```
┌────────────────────────────────────────────────────┐
│ STRUCTURE                                           │
├────────────────────────────────────────────────────┤
│ [Full PDB] [This Chain] [Domain 1] [Domain 2]      │
├────────────────────────────────────────────────────┤
│                                                     │
│           ┌──────────────────┐                     │
│           │                  │                     │
│           │   [3D Viewer]    │                     │
│           │                  │                     │
│           └──────────────────┘                     │
│                                                     │
│  Currently showing: This Chain (9ay5_B)            │
│  Colors: Domain 1 (blue) | Unassigned (gray)      │
│                                                     │
│  [Rotate] [Zoom] [Center] [Screenshot]            │
└────────────────────────────────────────────────────┘
```

#### B. View Descriptions

**Tab 1: Full PDB (Biological Assembly)**
```
Purpose: Understand biological context
Shows: All chains in asymmetric unit or biological assembly
Use case:
  • "Is this a dimer/oligomer?"
  • "Are there interaction partners?"
  • "Is the chain complete or just a fragment?"

Example visualization:
  Chain A: gray
  Chain B: gray
  Chain C: gray
  Chain D: gray
  Chain E: gray
  Chain F: colored by domain ← You are here

Info shown:
  "Full PDB: 9ay5 (6 chains)
   Biological assembly: Hexamer
   Your chain: F (1 of 6 identical copies)"
```

**Tab 2: This Chain (Current Default)**
```
Purpose: Main curation view
Shows: Just the chain being curated (9ay5_B)
Use case:
  • "Where are the domain boundaries?"
  • "How much is covered?"
  • "Any obvious issues?"

Example visualization:
  Domain 1 (1-167): blue
  Unassigned (168-288): gray

Info shown:
  "Chain B: 288 residues
   Domains: 1 detected
   Coverage: 47%"
```

**Tab 3+: Domain Context Views** (one tab per domain)
```
Purpose: Validate classification against reference
Shows: Putative domain superposed on hit domain
Use case:
  • "Does the structure actually match the hit?"
  • "Is the fold similar?"
  • "Are the boundaries correct?"

Example visualization:
  Putative domain (9ay5_B 1-167): blue (solid)
  Reference hit (e8cesA1 8-176): orange (transparent)
  Aligned regions: purple (overlap)

Info shown:
  "Domain 1 vs. Reference e8cesA1
   RMSD: 1.8 Å (178 Cα atoms)
   Sequence identity: 34%
   Structural alignment: 93% of residues
   ✓ Good match - classification likely correct"

Additional details:
  • Best hit: e8cesA1 (T:2004.1.1)
  • E-value: 2.7e-45
  • Query range: 2-167
  • Hit range: 8-176

  [View alignment details ↓]
```

#### C. Implementation Considerations

**Performance Optimization:**

**Option 1: Lazy Loading (Recommended)**
```typescript
// Only load structure when tab is clicked
const [activeView, setActiveView] = useState('chain');
const [loadedViews, setLoadedViews] = useState(new Set(['chain']));

function switchView(view) {
  setActiveView(view);

  if (!loadedViews.has(view)) {
    // Fetch structure data only when needed
    fetchStructureForView(view);
    setLoadedViews(prev => new Set([...prev, view]));
  }
}

Benefit: Don't load heavy PDB/superposition data unless curator needs it
```

**Option 2: Preload in Background**
```typescript
// Load chain immediately, others in background
useEffect(() => {
  loadStructure('chain'); // Immediate

  setTimeout(() => {
    loadStructure('full_pdb'); // After 2 sec
  }, 2000);

  setTimeout(() => {
    loadStructure('domain_1'); // After 5 sec
  }, 5000);
}, []);

Benefit: All views ready when curator switches tabs (no waiting)
Cost: More bandwidth, slower initial load
```

**Recommendation:** Hybrid approach
- Load "This Chain" immediately (primary view)
- Load "Full PDB" after 2 seconds (low cost, often useful)
- Load "Domain X" only when clicked (requires superposition, slower)

#### D. Domain Superposition

**For Domain Context View:**

**Option A: Client-Side Superposition (3Dmol.js)**
```javascript
// Fetch both structures
const putativeDomain = await fetch(`/api/structure/${proteinId}?range=1-167`);
const referenceDomain = await fetch(`/api/structure/e8cesA1?range=8-176`);

// Load into viewer
viewer.addModel(putativeDomain, 'pdb');
viewer.addModel(referenceDomain, 'pdb');

// Align (requires alignment info from backend)
const alignment = await fetch(`/api/alignment/${domainId}`);
viewer.alignModels(alignment.mapping);

// Style
viewer.setStyle({model: 0}, {cartoon: {color: 'blue', opacity: 0.9}});
viewer.setStyle({model: 1}, {cartoon: {color: 'orange', opacity: 0.5}});
```

**Pros:**
- Fast for small domains
- No server computation needed
- Real-time adjustments

**Cons:**
- 3Dmol.js alignment is basic
- Need pre-computed alignment mapping
- May not handle complex cases well

**Option B: Pre-Computed Superpositions (Server-Side)**
```python
# Backend script: precompute_domain_superpositions.py
# Run during evidence generation or as background job

from Bio.PDB import PDBParser, Superimposer, PDBIO
import numpy as np

def superpose_domains(putative_pdb, ref_pdb, alignment):
    """
    Superpose putative domain onto reference using alignment.
    Returns RMSD and superposed structure.
    """
    parser = PDBParser(QUIET=True)

    # Load structures
    putative = parser.get_structure('putative', putative_pdb)
    reference = parser.get_structure('reference', ref_pdb)

    # Extract aligned residues
    putative_atoms = get_aligned_ca_atoms(putative, alignment.query_range)
    reference_atoms = get_aligned_ca_atoms(reference, alignment.hit_range)

    # Superimpose
    super_imposer = Superimposer()
    super_imposer.set_atoms(reference_atoms, putative_atoms)
    super_imposer.apply(putative.get_atoms())

    # Save combined structure
    io = PDBIO()
    combined = combine_structures(putative, reference)
    io.set_structure(combined)
    io.save(f'superposed_{domain_id}.pdb')

    return super_imposer.rms

# Cache results
cache_superposition(domain_id, {
    'pdb_file': f'superposed_{domain_id}.pdb',
    'rmsd': rmsd,
    'aligned_residues': len(putative_atoms)
})
```

**API endpoint:**
```typescript
GET /api/domain/:domainId/superposition

Response:
{
  "pdb_data": "...",  // Combined structure with both domains
  "rmsd": 1.8,
  "aligned_residues": 178,
  "sequence_identity": 0.34,
  "structural_match": "good",  // good/moderate/poor
  "model_info": {
    "model_0": "Putative domain (9ay5_B 1-167)",
    "model_1": "Reference hit (e8cesA1 8-176)"
  }
}
```

**Pros:**
- High-quality structural alignment (using PyMOL/TMalign/etc.)
- Pre-computed = instant loading
- Can use sophisticated algorithms
- RMSD and quality metrics included

**Cons:**
- Requires storage for superposed structures
- Need to recompute if boundaries change
- Background job complexity

**Recommendation:**
- Start with Option B (pre-computed) for production
- Use Option A (client-side) for on-the-fly boundary adjustments

#### E. Visual Quality Indicators

**When showing domain superposition, auto-assess quality:**

```
Domain 1 vs. e8cesA1 Superposition

RMSD: 1.8 Å ✓ Good
  • < 2.0 Å: ✓ Excellent match
  • 2.0-3.5 Å: ~ Moderate match
  • > 3.5 Å: ✗ Poor match - check classification

Aligned: 93% ✓ High coverage
  • > 80%: ✓ Well aligned
  • 50-80%: ~ Partial match
  • < 50%: ✗ Fragments only

Sequence ID: 34% ~ Expected for distant homologs

Visual Quality: ✓ GOOD
→ Structures align well, classification supported
```

#### F. UI Mockup: All Three Views

**Full PDB View:**
```
┌────────────────────────────────────┐
│ [Full PDB] This Chain  Domain 1    │
├────────────────────────────────────┤
│        Chain F                      │
│         ↓                           │
│    ┌────────┐                      │
│    │ [PDB]  │  ← Hexamer           │
│    │ Shows  │                       │
│    │ all 6  │                       │
│    │ chains │                       │
│    └────────┘                      │
│                                     │
│ Biological Assembly: Hexamer        │
│ Your chain: F (colored)             │
│ Others: A,B,C,D,E (gray)            │
│                                     │
│ ℹ️ Curating 1 of 6 identical chains│
└────────────────────────────────────┘
```

**This Chain View (Current):**
```
┌────────────────────────────────────┐
│  Full PDB [This Chain] Domain 1    │
├────────────────────────────────────┤
│                                     │
│    ┌──────────┐                    │
│    │  Chain F │                    │
│    │  ▓▓▓▓░░░ │  ← Domain | Unass │
│    │          │                    │
│    └──────────┘                    │
│                                     │
│ Chain B: 288 residues               │
│ Domain 1: blue (1-167)              │
│ Unassigned: gray (168-288)          │
└────────────────────────────────────┘
```

**Domain Context View:**
```
┌────────────────────────────────────┐
│  Full PDB  This Chain [Domain 1]   │
├────────────────────────────────────┤
│                                     │
│  ┌──────────────┐                  │
│  │ Superposed   │                  │
│  │              │  Blue: 9ay5_B    │
│  │   ╱▓▓▓╲      │  Orange: e8cesA1│
│  │  ╱ ▓▓▓ ╲     │  Purple: overlap│
│  │ (aligned)    │                  │
│  └──────────────┘                  │
│                                     │
│ RMSD: 1.8 Å ✓                      │
│ Aligned: 93% ✓                     │
│ Quality: GOOD - match confirmed     │
│                                     │
│ [Show alignment details ↓]          │
└────────────────────────────────────┘
```

#### G. When to Show Each View

**Workflow Integration:**

1. **Initial Load:** "This Chain" (fastest, most relevant)

2. **Quick Check:** Click "Full PDB"
   - "Oh, it's a hexamer - makes sense these 6 chains are identical"
   - "Fragment detected - missing N-terminus in structure"

3. **Validation:** Click "Domain 1"
   - "Does this really match e8cesA1?"
   - RMSD 1.8 Å ✓ "Yes, good match"
   - "Boundaries look correct"
   - → Approve with confidence

4. **Problem Cases:**
   - High RMSD (> 3.5 Å) → "Structures don't match, check classification"
   - Low coverage (< 50% aligned) → "Only partial match, fragment?"
   - Multiple domains with different RMSDs → "One domain good, other questionable"

#### H. Storage & Caching Strategy

**For pre-computed superpositions:**

```
/data/ecod/superpositions/
  ├── by_domain/
  │   ├── 250.pdb          # Domain ID 250 superposed on best hit
  │   ├── 250_metadata.json
  │   ├── 251.pdb
  │   └── 251_metadata.json
  └── by_batch/
      └── ecod_weekly_20250905/
          └── 250.pdb

Metadata JSON:
{
  "domain_id": 250,
  "putative": "9ay5_B",
  "putative_range": "1-167",
  "reference": "e8cesA1",
  "reference_range": "8-176",
  "rmsd": 1.8,
  "aligned_residues": 178,
  "alignment_coverage": 0.93,
  "quality": "good",
  "computed_at": "2024-09-07T10:23:45Z"
}
```

**API endpoint caching:**
```javascript
// Cache superpositions aggressively (they don't change)
GET /api/domain/:domainId/superposition
Cache-Control: public, max-age=604800  // 7 days

// Full PDB cached per structure
GET /api/structure/:pdbId/full
Cache-Control: public, max-age=2592000  // 30 days

// Chain-specific cached
GET /api/structure/:pdbId/:chainId
Cache-Control: public, max-age=604800  // 7 days
```

**Estimated storage:**
- Chain-specific PDB: ~100 KB each
- Full PDB: ~500 KB - 5 MB (depending on size)
- Superposed domain: ~50 KB each

**For 10,000 proteins:**
- Chains: 1 GB
- Full PDBs: ~1-10 GB (deduplicated by PDB ID)
- Superpositions: ~500 MB (1-2 domains each)
- Total: ~5-15 GB (very manageable)

#### I. Progressive Enhancement

**Phase 1: Basic (Current)**
- ✓ Show full chain with domain coloring

**Phase 2: Add Full PDB View**
- Add tab for biological assembly
- Fetch from PDB API or local cache
- Highlight curation target chain

**Phase 3: Add Domain Superposition**
- Pre-compute superpositions for best hit
- Show in dedicated tab
- Display quality metrics

**Phase 4: Interactive Comparison**
- Side-by-side views
- Synchronized rotation
- Toggle between structures
- Difference highlighting

**Phase 5: Advanced (Future)**
- Multiple reference comparisons
- Confidence-weighted coloring
- Conserved residue highlighting
- Active site detection

### 11. Discontinuous Domain Range Support

**Problem:**
Currently, the system assumes domains are continuous sequences (e.g., "1-167"). However, some protein domains are **discontinuous** - composed of multiple non-contiguous sequence segments that fold together.

**Examples:**
- Immunoglobulin domains: "5-55,110-150" (two segments)
- Protease domains with inserted regions: "1-100,250-350" (catalytic domain interrupted by insertion)
- Circular permutations: "150-300,1-50" (domain wraps around)

**Impact Areas:**

#### A. Database Schema Changes

**Current:**
```sql
domain_assignment (
  start_pos INTEGER,
  end_pos INTEGER,
  residue_range TEXT  -- "1-167"
)
```

**Proposed:**
```sql
domain_assignment (
  start_pos INTEGER,      -- First segment start (for sorting)
  end_pos INTEGER,        -- Last segment end (for sorting)
  residue_range TEXT,     -- "1-50,100-150" (multi-segment format)
  is_discontinuous BOOLEAN DEFAULT FALSE,
  segment_count INTEGER DEFAULT 1
)

-- New table for detailed segment tracking
domain_segments (
  id SERIAL PRIMARY KEY,
  domain_id INTEGER REFERENCES domain_assignment(id),
  segment_number INTEGER,  -- 1, 2, 3...
  start_pos INTEGER,
  end_pos INTEGER,
  length INTEGER GENERATED ALWAYS AS (end_pos - start_pos + 1) STORED,
  UNIQUE(domain_id, segment_number)
)
```

#### B. UI Changes

**Domain Table Display:**
```
Current:
┌───┬─────────┬───────────┬───────────┐
│ # │ Range   │ Class     │ Conf      │
├───┼─────────┼───────────┼───────────┤
│ 1 │ 1-167   │ T:2004.1.1│ 98%       │
└───┴─────────┴───────────┴───────────┘

Proposed:
┌───┬──────────────────┬───────────┬───────────┐
│ # │ Range            │ Class     │ Conf      │
├───┼──────────────────┼───────────┼───────────┤
│ 1 │ 1-50, 100-150 🔗 │ T:2004.1.1│ 98%       │
│   │ (2 segments)     │           │           │
└───┴──────────────────┴───────────┴───────────┘

Legend: 🔗 = Discontinuous domain
```

**Boundary Editing Interface:**
```
Current:
[Start: 1] - [End: 167]

Proposed:
Domain Type: ( ) Continuous  (•) Discontinuous

Segment 1: [Start: 1  ] - [End: 50  ]
Segment 2: [Start: 100] - [End: 150] [× Remove]
           [+ Add Segment]

Total coverage: 101 residues (2 segments)
```

#### C. Structure Viewer Coloring

**Current:**
```javascript
// Color single range
viewer.setStyle(
  { chain: chainId, resi: `${domain.start_pos}-${domain.end_pos}` },
  { cartoon: { color: domainColor } }
);
```

**Proposed:**
```javascript
// Parse multi-segment ranges
function parseResidueRange(residueRange) {
  // "1-50,100-150" -> [{start: 1, end: 50}, {start: 100, end: 150}]
  return residueRange.split(',').map(segment => {
    const [start, end] = segment.trim().split('-').map(Number);
    return { start, end };
  });
}

// Color each segment
const segments = parseResidueRange(domain.residue_range);
segments.forEach(segment => {
  viewer.setStyle(
    { chain: chainId, resi: `${segment.start}-${segment.end}` },
    { cartoon: { color: domainColor } }
  );
});
```

#### D. Evidence Range Parsing

**Challenge:** BLAST/HHsearch hits may also have discontinuous ranges

**Current:**
```sql
domain_evidence (
  query_range TEXT,  -- "2-167"
  hit_range TEXT     -- "8-176"
)
```

**Handle discontinuous evidence:**
```
Query: 1-50,100-150
Hit:   8-58,110-160

Need to:
1. Parse multi-segment ranges
2. Calculate coverage for each segment
3. Validate alignment makes sense
```

#### E. Validation Logic

**New checks needed:**

```python
def validate_discontinuous_domain(segments):
    """Validate discontinuous domain makes sense"""
    errors = []

    # Check segments don't overlap
    for i, seg1 in enumerate(segments):
        for seg2 in segments[i+1:]:
            if ranges_overlap(seg1, seg2):
                errors.append(f"Segments {seg1} and {seg2} overlap")

    # Check segments are ordered
    if not is_sorted([seg.start for seg in segments]):
        errors.append("Segments not in sequence order")

    # Check gap sizes (warn if very large)
    for i in range(len(segments) - 1):
        gap = segments[i+1].start - segments[i].end - 1
        if gap > 200:
            errors.append(f"Large gap ({gap} residues) between segments")

    # Check biological plausibility
    total_length = sum(seg.length for seg in segments)
    if total_length < 30:
        errors.append("Total domain length very short for discontinuous domain")

    return errors
```

#### F. Curation Workflow

**New decision points:**

```
Is this domain discontinuous?

( ) No - single continuous range (default)
( ) Yes - multiple segments

If yes:
  How many segments? [2]

  Why is it discontinuous?
  ( ) Domain interrupted by insertion/linker
  ( ) Circular permutation
  ( ) Trans-splicing
  ( ) Other: ___________

  Confidence in discontinuity:
  ( ) High - clear from structure/alignment
  ( ) Medium - likely but not certain
  ( ) Low - uncertain, flag for expert review
```

#### G. Common Use Cases

**Case 1: Insertion/Deletion in Domain**
```
Full chain: 1-300
Domain 1: 1-100,200-300 (discontinuous)
  - Core domain: 1-100, 200-300
  - Insertion: 101-199 (assigned to different domain or disordered)

Visualization:
Sequence:  [===Domain 1===][Insertion][===Domain 1===]
           1              100        200            300
```

**Case 2: Circular Permutation**
```
Canonical order: A-B-C
Permuted order:  B-C-A

Domain range: "150-300,1-50"
  - C-terminus of sequence (150-300) aligns to N-terminus of canonical domain
  - N-terminus of sequence (1-50) aligns to C-terminus of canonical domain
```

**Case 3: Domain Swapping**
```
Homodimer where N-terminus of chain A forms domain with C-terminus of chain B

Chain A domain: "1-50,B:200-250" (trans-chain, even more complex!)
Note: Trans-chain discontinuity is VERY rare, defer to Phase 2
```

#### H. Implementation Phases

**Phase 1: Basic Support (Required for v1.0)**
- ✓ Update database schema
- ✓ Parse discontinuous ranges in viewer
- ✓ Display multi-segment ranges in UI
- ✓ Basic validation (no overlaps)

**Phase 2: Editing Support**
- ✓ UI for adding/removing segments
- ✓ Visual feedback in structure viewer
- ✓ Segment-by-segment alignment validation
- ✓ Auto-detect discontinuity from evidence

**Phase 3: Advanced Features**
- ✓ Circular permutation detection
- ✓ Domain insertion/linker analysis
- ✓ Confidence scoring for discontinuity
- ✓ Trans-chain domains (very rare, low priority)

#### I. Example Data

**Test cases to support:**

```sql
-- Simple continuous (current)
INSERT INTO domain_assignment (residue_range, is_discontinuous)
VALUES ('1-167', FALSE);

-- Two-segment discontinuous
INSERT INTO domain_assignment (residue_range, is_discontinuous, segment_count)
VALUES ('1-50,100-150', TRUE, 2);

INSERT INTO domain_segments (domain_id, segment_number, start_pos, end_pos)
VALUES
  (domain_id, 1, 1, 50),
  (domain_id, 2, 100, 150);

-- Three-segment (rare but valid)
INSERT INTO domain_assignment (residue_range, is_discontinuous, segment_count)
VALUES ('10-40,80-120,200-250', TRUE, 3);

-- Circular permutation
INSERT INTO domain_assignment (residue_range, is_discontinuous, segment_count)
VALUES ('150-300,1-50', TRUE, 2);
```

#### J. UI Mockup: Discontinuous Domain Editing

```
┌─────────────────────────────────────────────────────────┐
│ Domain 1 Boundaries                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Type: (•) Continuous  ( ) Discontinuous                 │
│                                                          │
│ Range: [1   ] - [167 ]                                  │
│                                                          │
│ [Preview in Structure]                                  │
└─────────────────────────────────────────────────────────┘

When "Discontinuous" is selected:

┌─────────────────────────────────────────────────────────┐
│ Domain 1 Boundaries                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Type: ( ) Continuous  (•) Discontinuous                 │
│                                                          │
│ Segment 1: [1   ] - [50  ] (50 aa)  [Preview] [Remove] │
│ Segment 2: [100 ] - [150 ] (51 aa)  [Preview] [Remove] │
│                                                          │
│ [+ Add Segment]                                          │
│                                                          │
│ Total: 101 residues in 2 segments                       │
│ Gaps: 49 residues (101-99)                              │
│                                                          │
│ Validation:                                              │
│ ✓ No overlaps                                           │
│ ✓ Segments in order                                     │
│ ⚠ Gap is large (49aa) - is this correct?               │
│                                                          │
│ [Preview All Segments in Structure]                     │
└─────────────────────────────────────────────────────────┘
```

#### K. Technical Considerations

**Performance:**
- Parsing "1-50,100-150" vs "1-167": negligible difference
- Coloring multiple segments in 3Dmol.js: tested, works fine
- Database queries: need index on `is_discontinuous` for filtering

**Backwards Compatibility:**
- Continuous domains: `is_discontinuous = FALSE`, single segment
- Existing data: migration script to populate `domain_segments` table
- Old code reading `residue_range`: still works (just more segments)

**Edge Cases:**
- Empty gaps (e.g., "1-50,51-100"): treat as continuous "1-100"
- Single-residue segments (e.g., "1-50,55-55,100-150"): allow but warn
- Reverse-order segments (circular permutation): special handling needed
- Overlapping segments: reject as invalid

#### L. Priority Assessment

**Urgency: MEDIUM-HIGH**

**Why implement:**
- Real biological phenomenon (not edge case)
- ~5-10% of domains may be discontinuous
- Incorrect handling leads to wrong classifications
- Blocks accurate curation of certain domain types

**Why defer:**
- Most domains (90%+) are continuous
- Complex UI changes required
- Can manually note discontinuity in comments (workaround)

**Recommendation:**
- Implement **Phase 1** (basic support) in v1.0
  - Allow viewing discontinuous ranges
  - Parse and display correctly
  - ~3-5 days development
- Defer **Phase 2** (editing support) to v1.1
  - Full UI for creating/editing discontinuous domains
  - ~1-2 weeks development

## Next Steps

1. **Get feedback on these proposals**
2. **Prioritize which fixes to implement first**
3. **Create new API endpoints for:**
   - Clustering data
   - Unclassified regions calculation
   - Experimental metadata from PDB
   - Discontinuous domain segment handling
4. **Redesign queue component**
5. **Add decision helper to protein view**
6. **Design discontinuous domain editing interface**
