# Schema Contract v2: pyecod_prod ↔ pyecod_vis ↔ ecod_commons

**Date**: 2025-01-20
**Status**: Based on actual ecod_commons and ecod_rep schemas
**Database**: dione:45000/ecod_protein

## Architecture Overview

```
┌──────────────────┐
│   ecod_rep       │ HIERARCHY AUTHORITY
│                  │ - T/H/X/F group definitions (ecod_rep.cluster)
│                  │ - Representative domains (ecod_rep.domain)
│                  │ - Group metadata and names
│                  │ READ-ONLY for pyecod_vis
└──────────────────┘
         ↑ references
         │
┌──────────────────┐
│  ecod_commons    │ DOMAIN AUTHORITY (All active ECOD domains)
│                  │ - ecod_commons.proteins (PDB + AFDB)
│                  │ - ecod_commons.domains (all accessioned domains)
│                  │ - ecod_commons.f_group_assignments (domain → hierarchy)
│                  │ - ecod_commons.versions (version control)
│                  │ WRITE via accession process (you control)
│                  │ READ-ONLY for pyecod_vis (for lookups)
└──────────────────┘
         ↑ accession
         │
┌──────────────────┐
│ ecod_curation    │ STAGING AREA (New domains being curated)
│                  │ - Temporary: awaiting curation
│                  │ - pyecod_prod writes automated assignments
│                  │ - pyecod_vis reads/writes curation decisions
│                  │ - After curation + f-group assignment → ecod_commons
└──────────────────┘
         ↑ writes
         │
┌──────────────────┐
│  pdb_update      │ OPERATIONS (Pipeline state tracking)
│                  │ - BLAST/HHsearch/partition status
│                  │ - Weekly release tracking
│                  │ pyecod_prod owns completely
└──────────────────┘
```

## Key Insights from Existing Schemas

### ecod_rep Structure
```sql
-- Hierarchy: Single table with parent pointers
ecod_rep.cluster (
    id dom_cid,          -- e.g., "1.1.13.29" (F-group) or "1.1.13" (X-group)
    type ctype,          -- 'T', 'H', 'X', 'F'
    name text,           -- Human-readable name
    parent dom_cid       -- Parent group
)

-- Representatives
ecod_rep.domain (
    ecod_domain_id varchar,    -- e.g., "e8s9s71"
    t_id varchar,              -- References cluster(id)
    f_id varchar,              -- References cluster(id)
    manual_rep boolean
)
```

### ecod_commons Structure
```sql
-- All proteins (PDB + AFDB)
ecod_commons.proteins (
    id serial,
    source_id varchar,         -- e.g., "1abc_A" or "AF-P12345-F1"
    source_type varchar,       -- 'pdb' or 'afdb'
    pdb_id varchar,
    chain_id varchar
)

-- All domains (versioned)
ecod_commons.domains (
    id serial,
    ecod_uid int UNIQUE,       -- Global ECOD identifier
    domain_id varchar,         -- e.g., "e8abcA1"
    protein_id int,            -- FK to proteins
    version_id int,            -- FK to versions
    classification_status varchar,  -- 'unclassified', 'classified', 'manual'
    is_representative boolean,
    is_manual_representative boolean
)

-- Domain → Hierarchy mapping
ecod_commons.f_group_assignments (
    domain_id int,             -- FK to domains
    version_id int,
    t_group_id varchar,        -- e.g., "1.1.13"
    h_group_id varchar,
    x_group_id varchar,
    f_group_id varchar,        -- e.g., "1.1.13.29"
    assignment_method varchar, -- 'blast', 'hhsearch', 'manual', 'inheritance'
    classification_level varchar  -- 'f_group_specific', 't_group_only', etc.
)

-- Versioning system
ecod_commons.versions (
    id serial,
    version_name varchar,      -- e.g., "develop_350", "release_349"
    status varchar,            -- 'development', 'active', 'deprecated'
    parent_version_id int
)
```

## Proposed: ecod_curation Schema (Staging)

**Purpose**: Temporary holding area for new PDB proteins being reviewed.

**Lifecycle**: Created by pyecod_prod → Curated in pyecod_vis → Accessioned to ecod_commons → Deleted

```sql
CREATE SCHEMA IF NOT EXISTS ecod_curation;

-- ============================================================================
-- Proteins awaiting curation
-- ============================================================================
CREATE TABLE ecod_curation.protein (
    id serial PRIMARY KEY,
    source_id varchar(50) NOT NULL UNIQUE,  -- e.g., "8abc_A"

    -- From PDB/weekly release
    pdb_id varchar(4) NOT NULL,
    chain_id varchar(10) NOT NULL,
    release_date date NOT NULL,             -- Which PDB weekly release

    -- Sequence
    sequence text NOT NULL,
    sequence_length int NOT NULL,
    sequence_md5 varchar(32),               -- Detect PDB updates

    -- Processing results (from pyecod_prod)
    processed_at timestamp NOT NULL,
    processing_version varchar(50),         -- e.g., 'pyecod_prod_v1.0'
    partition_coverage real,                -- 0.0-1.0
    domain_count int DEFAULT 0,
    partition_quality varchar(20),          -- 'good', 'low_coverage', 'fragmentary'

    -- Eligibility
    can_curate boolean DEFAULT true,
    cannot_curate_reason varchar(50),       -- 'peptide', 'nucleic_acid', 'too_short'

    -- Curation workflow status
    curation_status varchar(20) DEFAULT 'pending',
    -- 'pending' - awaiting review
    -- 'in_progress' - curator working on it
    -- 'curated' - decisions made, awaiting accession
    -- 'accessioned' - moved to ecod_commons
    -- 'rejected' - not suitable for ECOD

    curated_at timestamp,
    curator_name varchar(50),

    -- Accession tracking
    accessioned boolean DEFAULT false,
    accession_date timestamp,
    accession_batch varchar(100),           -- e.g., 'weekly_20250120'
    ecod_commons_protein_id int,            -- ID in ecod_commons.proteins after accession

    -- Metadata
    created_at timestamp DEFAULT now(),

    CONSTRAINT valid_partition_quality CHECK (partition_quality IN (
        'good', 'low_coverage', 'fragmentary', 'failed', NULL
    )),
    CONSTRAINT valid_curation_status CHECK (curation_status IN (
        'pending', 'in_progress', 'curated', 'accessioned', 'rejected'
    ))
);

CREATE INDEX idx_curation_protein_status ON ecod_curation.protein(curation_status);
CREATE INDEX idx_curation_protein_release ON ecod_curation.protein(release_date);
CREATE INDEX idx_curation_protein_accessioned ON ecod_curation.protein(accessioned) WHERE NOT accessioned;

-- ============================================================================
-- Domain assignments (automated + curated)
-- ============================================================================
CREATE TABLE ecod_curation.domain_assignment (
    id serial PRIMARY KEY,

    protein_id int NOT NULL REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,
    domain_number int NOT NULL,             -- 1, 2, 3, ... for this protein

    -- Boundaries
    start_pos int NOT NULL,
    end_pos int NOT NULL,
    residue_range text,                     -- e.g., "10-150,200-250" for discontinuous

    -- Classification (references ecod_rep.cluster)
    -- Note: F-group assignment is REQUIRED before accession
    assigned_t_group varchar(50),           -- e.g., "1.1.13"
    assigned_h_group varchar(50),           -- e.g., "1.1"
    assigned_x_group varchar(50),           -- e.g., "1.1.13"
    assigned_f_group varchar(50),           -- e.g., "1.1.13.29" - REQUIRED for accession

    -- If assigned, which domain from ecod_commons is the best match?
    best_match_ecod_domain_id varchar(50),  -- e.g., "e6a5jB1" from ecod_commons
    best_match_ecod_uid int,                -- ecod_commons.domains.ecod_uid

    -- Assignment metadata
    assignment_method varchar(20),          -- 'blast', 'hhsearch', 'manual', 'inheritance'
    classification_level varchar(20),       -- 'f_group_specific', 't_group_only', etc.
    confidence real,                        -- 0.0-1.0

    -- Provenance
    source varchar(20) NOT NULL,            -- 'automated', 'curator_modified', 'curator_created'
    created_by varchar(50),                 -- 'pyecod_prod_v1.0' or curator username
    created_at timestamp DEFAULT now(),

    -- Curator decision
    curator_decision varchar(20) DEFAULT 'pending',
    -- 'pending' - not yet reviewed
    -- 'accepted' - automated assignment is correct
    -- 'modified' - boundaries or classification changed
    -- 'rejected' - this is not a domain
    -- 'needs_expert' - flagged for your review

    curator_name varchar(50),
    curated_at timestamp,
    curator_notes text,

    -- Flags for exceptional cases
    flagged_as_novel boolean DEFAULT false,          -- Potential new fold/family
    flagged_as_representative boolean DEFAULT false, -- Should be added to ecod_rep
    flag_reason text,

    -- After accession to ecod_commons
    accessioned boolean DEFAULT false,
    ecod_commons_domain_id int,             -- ID in ecod_commons.domains
    ecod_uid int,                           -- Assigned ecod_uid in commons
    assigned_domain_id varchar(50),         -- Assigned domain_id like "e8abcA1"

    UNIQUE(protein_id, domain_number),

    CONSTRAINT valid_boundaries CHECK (start_pos > 0 AND end_pos >= start_pos),
    CONSTRAINT valid_confidence CHECK (confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)),
    CONSTRAINT valid_source CHECK (source IN ('automated', 'curator_modified', 'curator_created')),
    CONSTRAINT valid_curator_decision CHECK (curator_decision IN (
        'pending', 'accepted', 'modified', 'rejected', 'needs_expert'
    )),
    CONSTRAINT valid_assignment_method CHECK (assignment_method IN (
        'blast', 'hhsearch', 'manual', 'inheritance', 'hhblits', NULL
    )),
    CONSTRAINT valid_classification_level CHECK (classification_level IN (
        'f_group_specific', 't_group_only', 'h_group_only', 'x_group_only', 'unclassified', NULL
    ))
);

CREATE INDEX idx_domain_assignment_protein ON ecod_curation.domain_assignment(protein_id);
CREATE INDEX idx_domain_assignment_decision ON ecod_curation.domain_assignment(curator_decision);
CREATE INDEX idx_domain_assignment_flagged_novel ON ecod_curation.domain_assignment(flagged_as_novel) WHERE flagged_as_novel;
CREATE INDEX idx_domain_assignment_f_group ON ecod_curation.domain_assignment(assigned_f_group);

-- ============================================================================
-- Evidence supporting assignments
-- ============================================================================
CREATE TABLE ecod_curation.domain_evidence (
    id serial PRIMARY KEY,

    domain_id int NOT NULL REFERENCES ecod_curation.domain_assignment(id) ON DELETE CASCADE,

    evidence_type varchar(20) NOT NULL,     -- 'blast_chain', 'blast_domain', 'hhsearch'

    -- Hit information
    hit_ecod_domain_id varchar(50),         -- e.g., "e6a5jB1" if hit is in ECOD
    hit_ecod_uid int,                       -- ecod_commons.domains.ecod_uid if known
    hit_pdb_id varchar(4),
    hit_chain_id varchar(10),
    hit_description text,

    -- Scores
    evalue real,
    score real,
    identity real,                          -- 0.0-1.0
    similarity real,                        -- 0.0-1.0

    -- Coverage
    query_coverage real,                    -- 0.0-1.0
    hit_coverage real,                      -- 0.0-1.0

    -- Alignment regions
    query_range text,                       -- e.g., "10-150"
    hit_range text,

    -- If hit is from ecod_commons, inherit classification
    ref_t_group varchar(50),
    ref_h_group varchar(50),
    ref_x_group varchar(50),
    ref_f_group varchar(50),

    -- Provenance (for debugging)
    source_file text,                       -- Relative path to BLAST XML or HHR file
    created_at timestamp DEFAULT now(),

    CONSTRAINT valid_evidence_type CHECK (evidence_type IN (
        'blast_chain', 'blast_domain', 'hhsearch', 'hhblits', 'structure', 'manual'
    ))
);

CREATE INDEX idx_domain_evidence_domain ON ecod_curation.domain_evidence(domain_id);
CREATE INDEX idx_domain_evidence_hit ON ecod_curation.domain_evidence(hit_ecod_uid) WHERE hit_ecod_uid IS NOT NULL;

-- ============================================================================
-- Non-domain regions (junk that won't be accessioned)
-- ============================================================================
CREATE TABLE ecod_curation.non_domain_region (
    id serial PRIMARY KEY,

    protein_id int NOT NULL REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,

    start_pos int NOT NULL,
    end_pos int NOT NULL,

    reason varchar(50) NOT NULL,            -- 'disordered', 'linker', 'uncurable', etc.

    curator_name varchar(50) NOT NULL,
    created_at timestamp DEFAULT now(),
    notes text,

    CONSTRAINT valid_boundaries CHECK (start_pos > 0 AND end_pos >= start_pos),
    CONSTRAINT valid_reason CHECK (reason IN (
        'disordered', 'linker', 'membrane', 'signal_peptide',
        'low_complexity', 'transmembrane', 'coiled_coil', 'uncurable', 'other'
    ))
);

CREATE INDEX idx_non_domain_region_protein ON ecod_curation.non_domain_region(protein_id);

-- ============================================================================
-- Curation queue
-- ============================================================================
CREATE TABLE ecod_curation.curation_queue (
    id serial PRIMARY KEY,

    protein_id int NOT NULL UNIQUE REFERENCES ecod_curation.protein(id) ON DELETE CASCADE,

    -- Priority (higher = more urgent)
    priority int DEFAULT 0,
    priority_reason text,                   -- 'low_confidence', 'novel_architecture', etc.

    -- Assignment
    assigned_curator varchar(50),

    -- Status
    status varchar(20) DEFAULT 'pending',   -- 'pending', 'in_progress', 'completed', 'skipped'

    -- Timestamps
    added_at timestamp DEFAULT now(),
    assigned_at timestamp,
    started_at timestamp,
    completed_at timestamp,

    notes text,

    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped'))
);

CREATE INDEX idx_curation_queue_status ON ecod_curation.curation_queue(status);
CREATE INDEX idx_curation_queue_priority ON ecod_curation.curation_queue(priority DESC, added_at)
    WHERE status IN ('pending', 'in_progress');

-- ============================================================================
-- Curation sessions
-- ============================================================================
CREATE TABLE ecod_curation.curation_session (
    id serial PRIMARY KEY,

    curator_name varchar(50) NOT NULL,

    started_at timestamp DEFAULT now(),
    ended_at timestamp,

    -- Metrics
    proteins_reviewed int DEFAULT 0,
    decisions_made int DEFAULT 0,
    avg_review_time_seconds real,

    notes text
);

-- ============================================================================
-- Curation decisions log (for analytics)
-- ============================================================================
CREATE TABLE ecod_curation.curation_decision_log (
    id serial PRIMARY KEY,

    session_id int REFERENCES ecod_curation.curation_session(id),
    protein_id int NOT NULL REFERENCES ecod_curation.protein(id),

    -- High-level decision about the protein
    has_domains boolean,                    -- Does this protein have domains?
    is_fragment boolean,                    -- Is this a fragment?
    is_repeat_protein boolean,              -- Is this a repeat protein?

    -- Domains modified?
    domains_accepted boolean,               -- All automated assignments accepted?
    domains_modified boolean,               -- Any boundaries/classifications changed?
    domains_created boolean,                -- Any new domains added?
    domains_rejected boolean,               -- Any domains rejected?

    -- Flags
    flagged_for_expert boolean DEFAULT false,
    flagged_as_novel boolean DEFAULT false,

    -- Timing
    review_time_seconds int,

    -- Curator assessment
    confidence_level int CHECK (confidence_level BETWEEN 1 AND 5),

    decided_at timestamp DEFAULT now(),
    notes text
);

CREATE INDEX idx_curation_decision_log_session ON ecod_curation.curation_decision_log(session_id);
CREATE INDEX idx_curation_decision_log_protein ON ecod_curation.curation_decision_log(protein_id);

-- ============================================================================
-- Useful views
-- ============================================================================

-- Queue with protein details
CREATE OR REPLACE VIEW ecod_curation.queue_view AS
SELECT
    cq.id as queue_id,
    cq.priority,
    cq.priority_reason,
    cq.status as queue_status,
    cq.assigned_curator,
    p.id as protein_id,
    p.source_id,
    p.pdb_id,
    p.chain_id,
    p.sequence_length,
    p.domain_count,
    p.partition_coverage,
    p.partition_quality,
    p.curation_status,
    COUNT(da.id) as domain_assignments,
    AVG(da.confidence) as avg_confidence,
    MIN(da.confidence) as min_confidence,
    cq.added_at,
    cq.started_at
FROM ecod_curation.curation_queue cq
JOIN ecod_curation.protein p ON cq.protein_id = p.id
LEFT JOIN ecod_curation.domain_assignment da ON p.id = da.protein_id
WHERE cq.status IN ('pending', 'in_progress')
GROUP BY cq.id, cq.priority, cq.priority_reason, cq.status, cq.assigned_curator,
         p.id, p.source_id, p.pdb_id, p.chain_id, p.sequence_length,
         p.domain_count, p.partition_coverage, p.partition_quality,
         p.curation_status, cq.added_at, cq.started_at
ORDER BY cq.priority DESC, cq.added_at;

-- Proteins ready for accession (curated + f-group assigned)
CREATE OR REPLACE VIEW ecod_curation.ready_for_accession AS
SELECT
    p.id as protein_id,
    p.source_id,
    p.pdb_id,
    p.chain_id,
    p.curator_name,
    p.curated_at,
    COUNT(da.id) as domain_count,
    COUNT(da.id) FILTER (WHERE da.assigned_f_group IS NOT NULL) as domains_with_f_group,
    COUNT(da.id) FILTER (WHERE da.curator_decision = 'accepted') as domains_accepted,
    COUNT(da.id) FILTER (WHERE da.curator_decision = 'modified') as domains_modified,
    BOOL_AND(da.assigned_f_group IS NOT NULL) as all_have_f_group
FROM ecod_curation.protein p
JOIN ecod_curation.domain_assignment da ON p.id = da.protein_id
WHERE p.curation_status = 'curated'
  AND NOT p.accessioned
  AND da.curator_decision IN ('accepted', 'modified')
GROUP BY p.id, p.source_id, p.pdb_id, p.chain_id, p.curator_name, p.curated_at
HAVING BOOL_AND(da.assigned_f_group IS NOT NULL);  -- All domains must have f-group

-- Flagged proteins (need expert review)
CREATE OR REPLACE VIEW ecod_curation.flagged_proteins AS
SELECT
    p.id as protein_id,
    p.source_id,
    p.pdb_id,
    p.chain_id,
    p.curator_name,
    p.curated_at,
    STRING_AGG(DISTINCT
        CASE
            WHEN da.flagged_as_novel THEN 'novel_domain'
            WHEN da.flagged_as_representative THEN 'new_representative'
            WHEN da.curator_decision = 'needs_expert' THEN 'needs_expert'
        END, ', ') as flag_types,
    STRING_AGG(da.flag_reason, ' | ') as flag_reasons
FROM ecod_curation.protein p
JOIN ecod_curation.domain_assignment da ON p.id = da.protein_id
WHERE da.flagged_as_novel
   OR da.flagged_as_representative
   OR da.curator_decision = 'needs_expert'
GROUP BY p.id, p.source_id, p.pdb_id, p.chain_id, p.curator_name, p.curated_at;
```

## Data Flow

### 1. pyecod_prod → ecod_curation (Automated Processing)

After running partitioning on a new PDB protein:

```python
# pyecod_prod writes to ecod_curation after step 8 (partition) completes

def load_partition_to_curation(pdb_id: str, chain_id: str, release_date: date,
                               partition_result: PartitionResult):

    # 1. Insert protein
    protein_id = db.execute("""
        INSERT INTO ecod_curation.protein
        (source_id, pdb_id, chain_id, release_date, sequence, sequence_length,
         processed_at, processing_version, partition_coverage, domain_count, partition_quality)
        VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s)
        RETURNING id
    """, (f"{pdb_id}_{chain_id}", pdb_id, chain_id, release_date,
          sequence, len(sequence), 'pyecod_prod_v1.0',
          partition_result.coverage, len(partition_result.domains),
          partition_result.quality))

    # 2. Insert domain assignments
    for i, domain in enumerate(partition_result.domains, 1):
        domain_id = db.execute("""
            INSERT INTO ecod_curation.domain_assignment
            (protein_id, domain_number, start_pos, end_pos, residue_range,
             assigned_t_group, assigned_h_group, assigned_x_group, assigned_f_group,
             best_match_ecod_uid, assignment_method, classification_level,
             confidence, source, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (protein_id, i, domain.start, domain.end, domain.range,
              domain.t_group, domain.h_group, domain.x_group, domain.f_group,
              domain.best_match_ecod_uid, domain.assignment_method,
              domain.classification_level, domain.confidence,
              'automated', 'pyecod_prod_v1.0'))

        # 3. Insert evidence for this domain
        for evidence in domain.evidence:
            db.execute("""
                INSERT INTO ecod_curation.domain_evidence
                (domain_id, evidence_type, hit_ecod_uid, hit_pdb_id, hit_chain_id,
                 evalue, score, query_coverage, hit_coverage, query_range, hit_range,
                 ref_t_group, ref_h_group, ref_x_group, ref_f_group, source_file)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (domain_id, evidence.type, evidence.hit_ecod_uid,
                  evidence.hit_pdb_id, evidence.hit_chain_id,
                  evidence.evalue, evidence.score, evidence.query_cov, evidence.hit_cov,
                  evidence.query_range, evidence.hit_range,
                  evidence.ref_t, evidence.ref_h, evidence.ref_x, evidence.ref_f,
                  evidence.source_file))

    # 4. Add to curation queue if needed
    if should_queue_for_curation(partition_result):
        priority = calculate_priority(partition_result)
        reason = get_priority_reason(partition_result)

        db.execute("""
            INSERT INTO ecod_curation.curation_queue (protein_id, priority, priority_reason)
            VALUES (%s, %s, %s)
        """, (protein_id, priority, reason))
```

### 2. pyecod_vis Curation (Human Review)

Curator uses pyecod_vis to review and decide:

```typescript
// Example: Accept all domains
await prisma.domainAssignment.updateMany({
  where: { protein_id: proteinId },
  data: {
    curator_decision: 'accepted',
    curator_name: 'curator1',
    curated_at: new Date()
  }
});

await prisma.protein.update({
  where: { id: proteinId },
  data: {
    curation_status: 'curated',
    curator_name: 'curator1',
    curated_at: new Date()
  }
});

// Log decision
await prisma.curationDecisionLog.create({
  data: {
    session_id,
    protein_id: proteinId,
    has_domains: true,
    domains_accepted: true,
    confidence_level: 5,
    review_time_seconds: 45
  }
});
```

### 3. Accession to ecod_commons (You Control)

After curation, you run accession process:

```python
# Script you run to move curated proteins to ecod_commons

def accession_batch(batch_name: str):
    """
    Move curated proteins from ecod_curation → ecod_commons
    """
    # Get proteins ready for accession
    ready = db.query("""
        SELECT * FROM ecod_curation.ready_for_accession
    """)

    for protein in ready:
        # 1. Create protein in ecod_commons
        commons_protein_id = db.execute("""
            INSERT INTO ecod_commons.proteins
            (source_id, source_type, pdb_id, chain_id, sequence_length, ...)
            SELECT source_id, 'pdb', pdb_id, chain_id, sequence_length, ...
            FROM ecod_curation.protein
            WHERE id = %s
            RETURNING id
        """, (protein.protein_id,))

        # 2. Create domains in ecod_commons
        domains = db.query("""
            SELECT * FROM ecod_curation.domain_assignment
            WHERE protein_id = %s AND curator_decision IN ('accepted', 'modified')
        """, (protein.protein_id,))

        for domain in domains:
            # Assign ECOD UID and domain_id
            ecod_uid = get_next_ecod_uid()
            domain_id = generate_domain_id(protein.pdb_id, protein.chain_id, domain.domain_number)

            commons_domain_id = db.execute("""
                INSERT INTO ecod_commons.domains
                (ecod_uid, protein_id, domain_id, domain_version,
                 range_definition, classification_status, ...)
                VALUES (%s, %s, %s, 'v1', %s, 'classified', ...)
                RETURNING id
            """, (ecod_uid, commons_protein_id, domain_id, domain.residue_range))

            # 3. Create f_group_assignment
            db.execute("""
                INSERT INTO ecod_commons.f_group_assignments
                (domain_id, version_id, t_group_id, h_group_id, x_group_id, f_group_id,
                 assignment_method, classification_level, assigned_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (commons_domain_id, current_version_id,
                  domain.assigned_t_group, domain.assigned_h_group,
                  domain.assigned_x_group, domain.assigned_f_group,
                  domain.assignment_method, domain.classification_level,
                  domain.curator_name or 'pyecod_prod'))

            # 4. Mark as accessioned in ecod_curation
            db.execute("""
                UPDATE ecod_curation.domain_assignment
                SET accessioned = true,
                    ecod_commons_domain_id = %s,
                    ecod_uid = %s,
                    assigned_domain_id = %s
                WHERE id = %s
            """, (commons_domain_id, ecod_uid, domain_id, domain.id))

        # 5. Mark protein as accessioned
        db.execute("""
            UPDATE ecod_curation.protein
            SET accessioned = true,
                accession_date = NOW(),
                accession_batch = %s,
                ecod_commons_protein_id = %s
            WHERE id = %s
        """, (batch_name, commons_protein_id, protein.protein_id))
```

## Access Patterns

### pyecod_vis Reads
```sql
-- From ecod_curation (primary)
SELECT * FROM ecod_curation.protein WHERE ...;
SELECT * FROM ecod_curation.domain_assignment WHERE ...;
SELECT * FROM ecod_curation.domain_evidence WHERE ...;

-- From ecod_commons (for lookups, suggestions)
-- "Show me domains similar to this one"
SELECT * FROM ecod_commons.domains WHERE ecod_uid = ...;
SELECT * FROM ecod_commons.f_group_assignments WHERE f_group_id = ...;

-- From ecod_rep (for displaying group names)
SELECT id, name FROM ecod_rep.cluster WHERE id IN (...);
```

### pyecod_vis Writes
```sql
-- Only to ecod_curation
UPDATE ecod_curation.domain_assignment SET ...;
INSERT INTO ecod_curation.curation_decision_log ...;
INSERT INTO ecod_curation.non_domain_region ...;

-- NEVER writes to ecod_commons or ecod_rep
```

## Open Questions Resolved

1. ✅ **F-group assignment**: Must happen BEFORE accession to ecod_commons
2. ✅ **ECOD ID assignment**: During accession (you control)
3. ✅ **Versioning**: Handled in ecod_commons.versions
4. ✅ **pyecod_vis reads ecod_commons**: Yes, for lookups and suggestions
5. ✅ **pyecod_vis reads ecod_rep**: Yes, for group name display
6. ✅ **Accession process**: Batch script you run after curation

## Next Steps

1. Create `ecod_curation` schema on dione
2. Test pyecod_prod writing to it
3. Build pyecod_vis Prisma schema matching `ecod_curation.*`
4. Implement read-only joins to `ecod_commons` and `ecod_rep` for lookups
5. Test full workflow: prod → vis → accession → commons
