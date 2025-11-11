# Curation Data Pipeline Improvements Plan

**Created**: 2025-10-20
**Goal**: Improve pyecod_prod → ecod_curation data pipeline to support better curation UX

## Problems Identified

### 1. Structure File & Residue Numbering Issues

**Current State**:
- ✅ Structure files stored at `/usr2/pdb/` (local PDB mirror)
- ✅ API endpoint serves structure files: `/api/structure/[id]`
- ❌ Domain ranges use **SEQID numbering** (1-indexed, aligned to sequence)
- ❌ 3Dmol.js requires **PDB ATOM numbering** (structure-specific)
- ❌ No mapping table between SEQID ↔ PDB numbering
- ❌ Only have full PDB files, not chain-specific extractions
- ❌ No domain-specific PDB files for superposition views

**Impact**:
- Structure viewer may not color domains correctly if numbering differs
- Cannot show multi-context views (full PDB, chain only, domain superposition)
- Cannot validate domain boundaries against actual structure coordinates

**Solution Needed**:
- SEQID → PDB numbering mapping (SIFTS or computed)
- Chain-specific PDB extraction
- Domain PDB files for superposition views

---

### 2. Missing Metadata

**Current State**:
- ✅ Have: PDB ID, chain ID, sequence, domain assignments, BLAST/HHsearch evidence
- ❌ Missing: PDB deposition title
- ❌ Missing: PDB experimental method (X-ray, cryo-EM, NMR, AlphaFold)
- ❌ Missing: Resolution
- ❌ Missing: Release/deposition dates (have in workflow but not stored in DB)
- ❌ Missing: UniProt crossreferences
- ❌ Missing: Biological assembly info
- ❌ Missing: Chain name/description from PDB

**Impact**:
- Cannot sort queue by recency (see CURATION_UX_IMPROVEMENTS.md § 9)
- Cannot show publication context
- Cannot calculate scientific priority scores
- Cannot display experimental quality indicators
- No UniProt integration for functional context

**Solution Needed**:
- Fetch PDB metadata from RCSB PDB REST API
- Get UniProt xrefs from SIFTS
- Store in `ecod_curation.protein` table (extend schema)
- Background job to populate metadata for existing proteins

---

### 3. Redundant Chain Curation

**Current State**:
- ✅ CD-HIT clustering implemented (`load_clustering.py`)
- ✅ Production workflow uses clustering (`run_production_week_with_cdhit.py`)
- ✅ Schema tables exist: `sequence_cluster`, `cluster_membership`
- ✅ Clustering at 70% identity threshold
- ❌ Queue shows **all chains**, not just representatives
- ❌ UI doesn't indicate cluster size or membership
- ❌ No batch propagation of curation decisions

**Impact**:
- Curators waste time on redundant chains
- Queue appears larger than necessary
- Cannot leverage sequence similarity for efficient curation

**Solution Needed**:
- Modify queue API to return only cluster representatives
- Add cluster size/members to UI
- Implement decision propagation across cluster

---

## Proposed Solution Architecture

### Phase 1: Schema Extensions (pyecod_prod)

**1.1 Extend `ecod_curation.protein` table**:

```sql
-- Add metadata columns
ALTER TABLE ecod_curation.protein ADD COLUMN IF NOT EXISTS
    pdb_title TEXT,
    pdb_deposition_date DATE,
    pdb_release_date DATE,
    experimental_method VARCHAR(50),  -- X-ray, Cryo-EM, NMR, Model
    resolution_angstrom REAL,
    biological_assembly_count INTEGER,
    chain_entity_id INTEGER,  -- PDB entity ID for this chain
    chain_description TEXT;

-- Add UniProt crossreference
ALTER TABLE ecod_curation.protein ADD COLUMN IF NOT EXISTS
    uniprot_accession VARCHAR(20),
    uniprot_id VARCHAR(50),
    uniprot_range VARCHAR(100);  -- e.g., "34-289" (UniProt numbering)

-- Add for queue prioritization (see CURATION_UX_IMPROVEMENTS.md § 9)
ALTER TABLE ecod_curation.protein ADD COLUMN IF NOT EXISTS
    queue_added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    priority_score REAL;

CREATE INDEX idx_protein_release_date ON ecod_curation.protein(pdb_release_date);
CREATE INDEX idx_protein_queue_priority ON ecod_curation.protein(priority_score DESC)
    WHERE curation_status = 'pending';
```

**1.2 Create residue numbering mapping table**:

```sql
CREATE TABLE IF NOT EXISTS ecod_curation.residue_mapping (
    protein_id INTEGER REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,
    seqid_position INTEGER NOT NULL,  -- Position in SEQRES (1-indexed)
    pdb_position INTEGER,             -- PDB ATOM numbering (may have gaps)
    pdb_insertion_code CHAR(1),       -- PDB insertion code (usually NULL)
    residue_name CHAR(3),             -- Three-letter amino acid code
    is_observed BOOLEAN,              -- Present in ATOM records?
    uniprot_position INTEGER,         -- Position in UniProt sequence (if mapped)

    PRIMARY KEY (protein_id, seqid_position)
);

CREATE INDEX idx_residue_mapping_protein ON ecod_curation.residue_mapping(protein_id);
```

**1.3 Create structure file cache table**:

```sql
CREATE TABLE IF NOT EXISTS ecod_curation.structure_files (
    protein_id INTEGER REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,
    file_type VARCHAR(20),  -- 'full_pdb', 'chain_only', 'domain_N'
    file_format VARCHAR(10), -- 'pdb', 'cif'
    file_path TEXT,
    file_size_bytes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (protein_id, file_type)
);
```

---

### Phase 2: Metadata Fetching Scripts (pyecod_prod)

**2.1 Fetch PDB metadata** (`scripts/fetch_pdb_metadata.py`):

```python
#!/usr/bin/env python3
"""
Fetch PDB metadata from RCSB PDB REST API and update ecod_curation.protein.

Fetches:
- Title, deposition/release dates
- Experimental method, resolution
- Biological assembly count
- Entity/chain descriptions

Usage:
    # Fetch for all proteins missing metadata
    python scripts/fetch_pdb_metadata.py --update-missing

    # Fetch for specific batch
    python scripts/fetch_pdb_metadata.py --batch ecod_weekly_20250905

    # Dry run
    python scripts/fetch_pdb_metadata.py --update-missing --dry-run
"""

import requests
from typing import Dict, Optional

PDB_API_URL = "https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"

def fetch_pdb_metadata(pdb_id: str) -> Optional[Dict]:
    """Fetch metadata from RCSB PDB REST API."""
    try:
        response = requests.get(PDB_API_URL.format(pdb_id=pdb_id), timeout=10)
        response.raise_for_status()
        data = response.json()

        # Extract relevant fields
        metadata = {
            'title': data.get('struct', {}).get('title'),
            'deposition_date': data['rcsb_accession_info']['deposit_date'],
            'release_date': data['rcsb_accession_info']['initial_release_date'],
            'experimental_method': data.get('exptl', [{}])[0].get('method'),
            'resolution': data.get('rcsb_entry_info', {}).get('resolution_combined', [None])[0],
            'biological_assembly_count': len(data.get('rcsb_struct_symmetry', {}).get('assemblies', [])),
        }

        return metadata
    except Exception as e:
        print(f"Error fetching {pdb_id}: {e}")
        return None

def update_protein_metadata(protein_id: int, pdb_id: str, conn):
    """Update ecod_curation.protein with fetched metadata."""
    metadata = fetch_pdb_metadata(pdb_id)
    if not metadata:
        return False

    cursor = conn.cursor()
    cursor.execute("""
        UPDATE ecod_curation.protein
        SET
            pdb_title = %s,
            pdb_deposition_date = %s,
            pdb_release_date = %s,
            experimental_method = %s,
            resolution_angstrom = %s,
            biological_assembly_count = %s
        WHERE id = %s
    """, (
        metadata['title'],
        metadata['deposition_date'],
        metadata['release_date'],
        metadata['experimental_method'],
        metadata['resolution'],
        metadata['biological_assembly_count'],
        protein_id
    ))
    conn.commit()
    return True
```

**2.2 Fetch SIFTS mappings** (`scripts/fetch_sifts_mappings.py`):

```python
#!/usr/bin/env python3
"""
Fetch SIFTS (Structure Integration with Function, Taxonomy and Sequences) mappings.

Provides:
- SEQID → PDB ATOM numbering
- PDB → UniProt crossreferences
- Observed vs. unobserved residues

SIFTS files: ftp://ftp.ebi.ac.uk/pub/databases/msd/sifts/xml/{pdb_id.lower()}.xml.gz

Usage:
    python scripts/fetch_sifts_mappings.py --pdb 8yl2 --chain F
    python scripts/fetch_sifts_mappings.py --batch ecod_weekly_20250905
"""

import gzip
import requests
import xml.etree.ElementTree as ET
from typing import Dict, List

SIFTS_URL = "https://ftp.ebi.ac.uk/pub/databases/msd/sifts/xml/{pdb_id}.xml.gz"

def parse_sifts_xml(pdb_id: str, chain_id: str) -> Dict:
    """
    Parse SIFTS XML for residue mappings.

    Returns:
        {
            'uniprot_accession': 'P12345',
            'uniprot_id': 'PROT_HUMAN',
            'residues': [
                {
                    'seqid': 1,
                    'pdb_num': 34,
                    'pdb_ins_code': None,
                    'residue': 'ALA',
                    'observed': True,
                    'uniprot_pos': 34
                },
                ...
            ]
        }
    """
    url = SIFTS_URL.format(pdb_id=pdb_id.lower())

    # Download and decompress
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    xml_content = gzip.decompress(response.content)

    # Parse XML
    root = ET.fromstring(xml_content)

    # Find target chain entity
    # SIFTS uses entity/segment structure
    # This is simplified - real implementation needs careful XML parsing

    residues = []
    uniprot_accession = None
    uniprot_id = None

    # ... XML parsing logic ...

    return {
        'uniprot_accession': uniprot_accession,
        'uniprot_id': uniprot_id,
        'residues': residues
    }

def load_residue_mapping(protein_id: int, mappings: Dict, conn):
    """Load residue mappings to ecod_curation.residue_mapping."""
    cursor = conn.cursor()

    # Update protein table with UniProt info
    cursor.execute("""
        UPDATE ecod_curation.protein
        SET
            uniprot_accession = %s,
            uniprot_id = %s
        WHERE id = %s
    """, (mappings['uniprot_accession'], mappings['uniprot_id'], protein_id))

    # Insert residue mappings
    for res in mappings['residues']:
        cursor.execute("""
            INSERT INTO ecod_curation.residue_mapping
            (protein_id, seqid_position, pdb_position, pdb_insertion_code,
             residue_name, is_observed, uniprot_position)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (protein_id, seqid_position) DO UPDATE SET
                pdb_position = EXCLUDED.pdb_position,
                pdb_insertion_code = EXCLUDED.pdb_insertion_code,
                residue_name = EXCLUDED.residue_name,
                is_observed = EXCLUDED.is_observed,
                uniprot_position = EXCLUDED.uniprot_position
        """, (
            protein_id,
            res['seqid'],
            res['pdb_num'],
            res['pdb_ins_code'],
            res['residue'],
            res['observed'],
            res['uniprot_pos']
        ))

    conn.commit()
```

**2.3 Extract chain-specific PDB files** (`scripts/extract_chain_pdbs.py`):

```python
#!/usr/bin/env python3
"""
Extract chain-specific PDB files from full PDB structures.

Creates:
- {pdb_id}_{chain_id}_chain.pdb - Full chain (SEQRES numbering)
- {pdb_id}_{chain_id}_observed.pdb - Observed residues only (ATOM numbering)

Usage:
    python scripts/extract_chain_pdbs.py --batch ecod_weekly_20250905
"""

from Bio.PDB import PDBParser, PDBIO, Select

class ChainSelector(Select):
    """BioPython Select class for extracting specific chain."""
    def __init__(self, chain_id):
        self.chain_id = chain_id

    def accept_chain(self, chain):
        return chain.id == self.chain_id

def extract_chain(pdb_file: str, chain_id: str, output_file: str):
    """Extract chain from PDB file."""
    parser = PDBParser(QUIET=True)
    structure = parser.get_structure('protein', pdb_file)

    io = PDBIO()
    io.set_structure(structure)
    io.save(output_file, ChainSelector(chain_id))
```

---

### Phase 3: Integrate into Production Workflow

**3.1 Modify `scripts/load_to_curation.py`**:

After loading partition results, immediately fetch metadata:

```python
def load_batch_to_curation(batch_path: str, dry_run: bool = False):
    """Load batch with metadata fetching."""

    # ... existing loading logic ...

    if not dry_run:
        print("\n[Post-processing] Fetching PDB metadata...")
        unique_pdbs = set(p['pdb_id'] for p in loaded_proteins)

        for pdb_id in unique_pdbs:
            fetch_and_update_pdb_metadata(pdb_id, conn)

        print("\n[Post-processing] Fetching SIFTS mappings...")
        for protein in loaded_proteins:
            fetch_and_load_sifts_mapping(
                protein['id'],
                protein['pdb_id'],
                protein['chain_id'],
                conn
            )

        print("\n[Post-processing] Extracting chain PDB files...")
        for protein in loaded_proteins:
            extract_and_cache_chain_pdb(
                protein['id'],
                protein['pdb_id'],
                protein['chain_id'],
                batch_path
            )
```

**3.2 Add to `run_production_week_with_cdhit.py`**:

After loading to curation (step 9):

```python
# [10/11] Fetch metadata for all proteins
print("\n[10/11] Fetching PDB metadata and SIFTS mappings...")
subprocess.run([
    "python", "scripts/fetch_pdb_metadata.py",
    "--batch", batch.batch_name
], check=True)

subprocess.run([
    "python", "scripts/fetch_sifts_mappings.py",
    "--batch", batch.batch_name
], check=True)

# [11/11] Extract chain-specific PDB files
print("\n[11/11] Extracting chain-specific structure files...")
subprocess.run([
    "python", "scripts/extract_chain_pdbs.py",
    "--batch", batch.batch_name
], check=True)
```

---

### Phase 4: Queue API Changes (pyecod_vis)

**4.1 Modify `/api/queue/all/route.ts`**:

Use cluster representatives when clustering is available:

```typescript
// src/app/api/queue/all/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get('show_all') === 'true';

  let query_text;

  if (showAll) {
    // Show all proteins (existing behavior)
    query_text = `
      SELECT
        source_id,
        domain_count,
        partition_coverage,
        partition_quality,
        curation_status,
        sequence_length,
        pdb_release_date,
        experimental_method,
        resolution_angstrom
      FROM ecod_curation.protein
      WHERE curation_status = 'pending'
      ORDER BY source_id
    `;
  } else {
    // Show only cluster representatives (NEW)
    query_text = `
      SELECT
        p.source_id,
        p.domain_count,
        p.partition_coverage,
        p.partition_quality,
        p.curation_status,
        p.sequence_length,
        p.pdb_release_date,
        p.experimental_method,
        p.resolution_angstrom,
        COUNT(cm2.protein_id) as cluster_size
      FROM ecod_curation.protein p
      LEFT JOIN ecod_curation.cluster_membership cm ON p.id = cm.protein_id
      LEFT JOIN ecod_curation.cluster_membership cm2
        ON cm.cluster_id = cm2.cluster_id
      WHERE p.curation_status = 'pending'
        AND (cm.is_representative = TRUE OR cm.is_representative IS NULL)
      GROUP BY p.id, p.source_id, ...
      ORDER BY p.priority_score DESC NULLS LAST, p.source_id
    `;
  }

  const result = await query(query_text);
  return NextResponse.json({ proteins: result.rows });
}
```

**4.2 Add cluster details API** (`/api/cluster/[id]/route.ts`):

```typescript
// src/app/api/cluster/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const proteinId = params.id;

  const result = await query(`
    SELECT
      p2.source_id,
      p2.sequence_length,
      p2.curation_status,
      cm.sequence_identity_to_rep
    FROM ecod_curation.cluster_membership cm
    JOIN ecod_curation.cluster_membership cm_rep
      ON cm.cluster_id = cm_rep.cluster_id
    JOIN ecod_curation.protein p1
      ON cm_rep.protein_id = p1.id
    JOIN ecod_curation.protein p2
      ON cm.protein_id = p2.id
    WHERE p1.source_id = $1
      AND cm_rep.is_representative = TRUE
    ORDER BY cm.sequence_identity_to_rep DESC
  `, [proteinId]);

  return NextResponse.json({ cluster_members: result.rows });
}
```

---

### Phase 5: Structure Viewer Improvements (pyecod_vis)

**5.1 Add residue mapping API** (`/api/protein/[id]/residue-mapping/route.ts`):

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sourceId = params.id;

  // Get protein_id
  const proteinResult = await query(
    'SELECT id FROM ecod_curation.protein WHERE source_id = $1',
    [sourceId]
  );

  if (proteinResult.rows.length === 0) {
    return NextResponse.json({ error: 'Protein not found' }, { status: 404 });
  }

  const proteinId = proteinResult.rows[0].id;

  // Get residue mappings
  const mappings = await query(`
    SELECT
      seqid_position,
      pdb_position,
      pdb_insertion_code,
      residue_name,
      is_observed,
      uniprot_position
    FROM ecod_curation.residue_mapping
    WHERE protein_id = $1
    ORDER BY seqid_position
  `, [proteinId]);

  return NextResponse.json({ mappings: mappings.rows });
}
```

**5.2 Modify StructureViewer to use PDB numbering**:

```typescript
// src/components/StructureViewer.tsx

// Fetch residue mappings along with structure
const [residueMappings, setResidueMappings] = useState<Map<number, number>>(new Map());

useEffect(() => {
  async function fetchMappings() {
    const response = await fetch(`/api/protein/${proteinId}/residue-mapping`);
    const data = await response.json();

    // Build SEQID → PDB position map
    const map = new Map<number, number>();
    data.mappings.forEach((m: any) => {
      map.set(m.seqid_position, m.pdb_position);
    });
    setResidueMappings(map);
  }

  fetchMappings();
}, [proteinId]);

// When coloring domains, convert SEQID ranges to PDB ranges
domains.forEach((domain, index) => {
  const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length];

  // Convert SEQID positions to PDB positions
  const pdbStart = residueMappings.get(domain.start_pos) || domain.start_pos;
  const pdbEnd = residueMappings.get(domain.end_pos) || domain.end_pos;

  viewerInstance.setStyle(
    { chain: chainId, resi: `${pdbStart}-${pdbEnd}` },
    { cartoon: { color, opacity: 0.9 } }
  );
});
```

---

## Implementation Phases

### Phase 1: Schema & Basic Metadata (Week 1)

**pyecod_prod**:
- [ ] Add metadata columns to `ecod_curation.protein`
- [ ] Create `residue_mapping` table
- [ ] Create `structure_files` table
- [ ] Create `fetch_pdb_metadata.py` script
- [ ] Test metadata fetching on small batch

**Deliverable**: Schema ready, metadata fetching working

---

### Phase 2: SIFTS Integration (Week 2)

**pyecod_prod**:
- [ ] Create `fetch_sifts_mappings.py` script
- [ ] Parse SIFTS XML for SEQID↔PDB mapping
- [ ] Parse SIFTS for UniProt crossrefs
- [ ] Load mappings to `residue_mapping` table
- [ ] Test on sample proteins (with known discrepancies in numbering)

**Deliverable**: Residue mapping working, UniProt xrefs populated

---

### Phase 3: Structure File Extraction (Week 2)

**pyecod_prod**:
- [ ] Create `extract_chain_pdbs.py` script
- [ ] Extract chain-specific PDB files using BioPython
- [ ] Store in organized directory structure
- [ ] Record file paths in `structure_files` table
- [ ] Modify `/api/structure/[id]` to serve chain-specific files

**Deliverable**: Chain-specific PDB files available

---

### Phase 4: Queue Clustering (Week 3)

**pyecod_prod**:
- [ ] Verify clustering workflow is running in production
- [ ] Check `cluster_membership` table is populated

**pyecod_vis**:
- [ ] Modify `/api/queue/all` to filter to representatives
- [ ] Create `/api/cluster/[id]` endpoint
- [ ] Add cluster size badge to queue table
- [ ] Add "Show all chains" toggle
- [ ] Add expandable cluster members view

**Deliverable**: Queue shows representatives with cluster info

---

### Phase 5: Improved Structure Viewer (Week 4)

**pyecod_vis**:
- [ ] Create `/api/protein/[id]/residue-mapping` endpoint
- [ ] Modify StructureViewer to fetch mappings
- [ ] Convert SEQID → PDB numbering for domain coloring
- [ ] Test with proteins known to have numbering discrepancies
- [ ] Add metadata display (resolution, method, dates)

**Deliverable**: Structure viewer correctly colors domains with PDB numbering

---

### Phase 6: Curation Decision Propagation (Week 5)

**pyecod_vis**:
- [ ] Add "Apply to cluster" checkbox in curation UI
- [ ] Modify `/api/curate` to propagate decisions
- [ ] Create `curation_propagation` records
- [ ] Update all cluster members' status
- [ ] Show propagation status in queue

**Deliverable**: Efficient cluster-based curation working

---

## Testing Strategy

### Unit Tests
- Metadata fetching from PDB API
- SIFTS XML parsing
- SEQID → PDB conversion logic
- Chain extraction

### Integration Tests
- Full batch loading with metadata
- Queue API returns correct representatives
- Structure viewer colors domains correctly
- Decision propagation updates all cluster members

### Manual Testing
- Load known test batch (ecod_weekly_20250905)
- Verify metadata populated for all proteins
- Check residue mappings for proteins with insertion codes
- Test structure viewer on proteins with non-sequential PDB numbering
- Curate cluster representative and verify propagation

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| PDB API rate limiting | Slow metadata fetching | Batch requests, add delays, cache results |
| SIFTS files not available for all PDBs | Missing mappings | Fallback to computed mapping from SEQRES |
| Large structure files | Storage/bandwidth | Compress, cache strategically, use mmCIF |
| Numbering edge cases (insertions) | Incorrect coloring | Extensive testing, manual validation |
| Breaking existing queue functionality | User disruption | Feature flags, gradual rollout |

---

## Success Metrics

- ✅ All proteins have PDB metadata (title, date, method, resolution)
- ✅ >95% of proteins have SEQID↔PDB mappings
- ✅ Structure viewer correctly colors domains (verify on 10 test cases)
- ✅ Queue shows only representatives by default
- ✅ Cluster-based curation reduces queue size by 60-80%
- ✅ Decision propagation works correctly (audit trail verified)

---

## Open Questions

1. **SIFTS vs. Computed Mapping**: SIFTS is authoritative but may not cover all structures. Fallback strategy?
2. **Storage for structure files**: Keep on local filesystem or move to object storage?
3. **Priority score calculation**: How to weight recency vs. impact vs. quality?
4. **Cluster threshold**: 70% is standard, but should we offer multiple thresholds?
5. **Metadata refresh**: How often to update PDB metadata for existing proteins?

---

## Next Steps

1. Review this plan with team
2. Decide on Phase 1 priorities
3. Set up development branch in pyecod_prod
4. Create schema migration scripts
5. Begin implementation

---

## References

- **SIFTS**: https://www.ebi.ac.uk/pdbe/docs/sifts/
- **PDB REST API**: https://data.rcsb.org/
- **CD-HIT**: http://weizhong-lab.ucsd.edu/cd-hit/
- **BioPython**: https://biopython.org/wiki/PDB_module
- **CURATION_UX_IMPROVEMENTS.md**: Detailed UX requirements
