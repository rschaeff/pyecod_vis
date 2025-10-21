-- ============================================================================
-- ecod_curation Schema - Staging Area for New PDB Proteins
-- ============================================================================
-- Database: ecod_protein on dione:45000
-- Purpose: Temporary staging for proteins awaiting manual curation
-- Lifecycle: pyecod_prod writes → pyecod_vis curates → pyecod_prod accessions → ecod_commons
--
-- Created: 2025-01-20
-- See: pyecod_vis/SCHEMA_CONTRACT_v2.md for full specification
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS ecod_curation;

-- ============================================================================
-- Proteins awaiting curation
-- ============================================================================
CREATE TABLE IF NOT EXISTS ecod_curation.protein (
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
CREATE INDEX idx_curation_protein_pdb ON ecod_curation.protein(pdb_id, chain_id);

COMMENT ON TABLE ecod_curation.protein IS
    'Staging area for new PDB proteins awaiting manual curation';

COMMENT ON COLUMN ecod_curation.protein.partition_coverage IS
    'Fraction of protein sequence covered by predicted domains (0.0-1.0)';

COMMENT ON COLUMN ecod_curation.protein.curation_status IS
    'Workflow status: pending → in_progress → curated → accessioned';

-- ============================================================================
-- Domain assignments (automated + curated)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ecod_curation.domain_assignment (
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
    -- 'needs_expert' - flagged for expert review

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
CREATE INDEX idx_domain_assignment_flagged_novel ON ecod_curation.domain_assignment(flagged_as_novel)
    WHERE flagged_as_novel;
CREATE INDEX idx_domain_assignment_f_group ON ecod_curation.domain_assignment(assigned_f_group);
CREATE INDEX idx_domain_assignment_accessioned ON ecod_curation.domain_assignment(accessioned)
    WHERE NOT accessioned;

COMMENT ON TABLE ecod_curation.domain_assignment IS
    'Domain predictions and curator modifications. F-group assignment REQUIRED before accession.';

COMMENT ON COLUMN ecod_curation.domain_assignment.assigned_f_group IS
    'F-group ID from ecod_rep.cluster. MUST be assigned before accession to ecod_commons.';

-- ============================================================================
-- Evidence supporting assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS ecod_curation.domain_evidence (
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
CREATE INDEX idx_domain_evidence_hit ON ecod_curation.domain_evidence(hit_ecod_uid)
    WHERE hit_ecod_uid IS NOT NULL;
CREATE INDEX idx_domain_evidence_type ON ecod_curation.domain_evidence(evidence_type);

COMMENT ON TABLE ecod_curation.domain_evidence IS
    'BLAST/HHsearch evidence supporting domain assignments';

-- ============================================================================
-- Non-domain regions (junk that won't be accessioned)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ecod_curation.non_domain_region (
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

COMMENT ON TABLE ecod_curation.non_domain_region IS
    'Regions marked by curators as non-domain (linkers, disordered, etc.)';

-- ============================================================================
-- Curation queue
-- ============================================================================
CREATE TABLE IF NOT EXISTS ecod_curation.curation_queue (
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
CREATE INDEX idx_curation_queue_assigned ON ecod_curation.curation_queue(assigned_curator)
    WHERE assigned_curator IS NOT NULL;

COMMENT ON TABLE ecod_curation.curation_queue IS
    'Proteins prioritized for manual curation';

-- ============================================================================
-- Curation sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS ecod_curation.curation_session (
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

CREATE INDEX idx_curation_session_curator ON ecod_curation.curation_session(curator_name);
CREATE INDEX idx_curation_session_started ON ecod_curation.curation_session(started_at DESC);

COMMENT ON TABLE ecod_curation.curation_session IS
    'Track curator sessions for productivity metrics';

-- ============================================================================
-- Curation decisions log (for analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ecod_curation.curation_decision_log (
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
CREATE INDEX idx_curation_decision_log_decided ON ecod_curation.curation_decision_log(decided_at DESC);

COMMENT ON TABLE ecod_curation.curation_decision_log IS
    'Log of all curation decisions for analytics and review';

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

COMMENT ON VIEW ecod_curation.queue_view IS
    'Curation queue with protein and domain summary details';

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

COMMENT ON VIEW ecod_curation.ready_for_accession IS
    'Curated proteins ready to be accessioned to ecod_commons (all domains have f-groups)';

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

COMMENT ON VIEW ecod_curation.flagged_proteins IS
    'Proteins flagged for expert review (novel domains, new representatives, etc.)';

-- Curation statistics
CREATE OR REPLACE VIEW ecod_curation.curation_stats AS
SELECT
    COUNT(*) FILTER (WHERE curation_status = 'pending') as pending_proteins,
    COUNT(*) FILTER (WHERE curation_status = 'in_progress') as in_progress_proteins,
    COUNT(*) FILTER (WHERE curation_status = 'curated') as curated_proteins,
    COUNT(*) FILTER (WHERE curation_status = 'accessioned') as accessioned_proteins,
    COUNT(*) as total_proteins,
    AVG(domain_count) as avg_domains_per_protein,
    AVG(partition_coverage) as avg_partition_coverage,
    COUNT(DISTINCT curator_name) FILTER (WHERE curator_name IS NOT NULL) as active_curators
FROM ecod_curation.protein;

COMMENT ON VIEW ecod_curation.curation_stats IS
    'Overall curation statistics';

-- ============================================================================
-- Permissions
-- ============================================================================

-- Grant usage to ecod user (owner)
GRANT USAGE ON SCHEMA ecod_curation TO ecod;
GRANT ALL ON ALL TABLES IN SCHEMA ecod_curation TO ecod;
GRANT ALL ON ALL SEQUENCES IN SCHEMA ecod_curation TO ecod;
GRANT SELECT ON ALL TABLES IN SCHEMA ecod_curation TO PUBLIC;  -- Read-only for others

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON SCHEMA ecod_curation IS
    'Staging area for new PDB proteins awaiting manual curation. Data flows: pyecod_prod (write) → pyecod_vis (curate) → pyecod_prod accession → ecod_commons';
