-- Archaea Visualization Schema Extensions
-- Created for pyecod_vis archaea module
-- Run with: psql -h dione -p 45000 -d ecod_protein -U ecod -f scripts/archaea_schema.sql

-- ============================================
-- VIEWS
-- ============================================

-- v_curation_queue_full: Prioritized curation queue with all relevant metadata
CREATE OR REPLACE VIEW archaea.v_curation_queue_full AS
SELECT
    cc.id,
    cc.protein_id,
    cc.novelty_category,
    cc.priority_category,
    cc.priority_rank,
    cc.curation_status,
    cc.structural_cluster_id,
    cc.structural_cluster_rep,
    cc.structural_cluster_size,
    cc.unified_by_structure,
    cc.is_novel_fold,
    cc.ecod_x_group,
    cc.assigned_curator,
    tp.uniprot_acc,
    tp.sequence_length,
    tp.source,
    tp.cif_file,
    tp.has_structure,
    sqm.mean_plddt,
    sqm.ptm,
    sqm.quality_score,
    sqm.af3_quality_category,
    sqm.ss_category,
    sqm.rg_category,
    sqm.fraction_disordered,
    tc.class_name AS taxonomy_class,
    tc.phylum,
    tc.major_group
FROM archaea.curation_candidates cc
JOIN archaea.target_proteins tp ON cc.protein_id = tp.protein_id
LEFT JOIN archaea.structure_quality_metrics sqm ON cc.protein_id = sqm.protein_id
LEFT JOIN archaea.target_classes tc ON tp.target_class_id = tc.id;

-- v_protein_detail: Full protein info for detail page
CREATE OR REPLACE VIEW archaea.v_protein_detail AS
SELECT
    tp.id AS protein_table_id,
    tp.protein_id,
    tp.uniprot_acc,
    tp.uniparc_id,
    tp.sequence_length,
    tp.source,
    tp.cif_file,
    tp.pae_file,
    tp.has_structure,
    tp.has_pae,
    ps.sequence,
    tc.class_name,
    tc.phylum,
    tc.major_group,
    tc.organism_name,
    tc.genome_accession,
    sqm.mean_plddt,
    sqm.ptm,
    sqm.quality_score,
    sqm.af3_quality_category,
    sqm.fraction_disordered,
    sqm.helix_fraction,
    sqm.sheet_fraction,
    sqm.coil_fraction,
    sqm.ss_category,
    sqm.rg,
    sqm.rg_expected,
    sqm.rg_ratio,
    sqm.rg_category,
    cc.novelty_category,
    cc.priority_category,
    cc.priority_rank,
    cc.curation_status,
    cc.structural_cluster_id,
    cc.structural_cluster_rep,
    cc.structural_cluster_size,
    cc.is_novel_fold,
    cc.is_novel_topology,
    cc.ecod_x_group,
    cc.ecod_h_group,
    cc.ecod_t_group,
    cc.ecod_f_group,
    cc.curator_notes,
    sc.cluster_size AS actual_cluster_size,
    scm.is_representative
FROM archaea.target_proteins tp
LEFT JOIN archaea.protein_sequences ps ON tp.protein_id = ps.protein_id
LEFT JOIN archaea.target_classes tc ON tp.target_class_id = tc.id
LEFT JOIN archaea.structure_quality_metrics sqm ON tp.protein_id = sqm.protein_id
LEFT JOIN archaea.curation_candidates cc ON tp.protein_id = cc.protein_id
LEFT JOIN archaea.structural_cluster_members scm ON tp.protein_id = scm.protein_id
LEFT JOIN archaea.structural_clusters sc ON scm.cluster_id = sc.id;

-- v_curation_progress: Statistics for dashboard
CREATE OR REPLACE VIEW archaea.v_curation_progress AS
SELECT
    novelty_category,
    priority_category,
    curation_status,
    COUNT(*) AS count,
    COUNT(*) FILTER (WHERE is_novel_fold = TRUE) AS novel_fold_count
FROM archaea.curation_candidates
GROUP BY novelty_category, priority_category, curation_status
ORDER BY novelty_category, priority_category, curation_status;

-- v_cluster_summary: Cluster information for browsing
CREATE OR REPLACE VIEW archaea.v_cluster_summary AS
SELECT
    sc.id AS cluster_id,
    sc.cluster_rep_id,
    sc.cluster_size,
    sc.clustering_method,
    sc.tm_threshold,
    COUNT(DISTINCT scm.protein_id) AS member_count,
    AVG(sqm.mean_plddt) AS avg_plddt,
    AVG(sqm.quality_score) AS avg_quality_score,
    COUNT(DISTINCT cc.protein_id) FILTER (WHERE cc.novelty_category = 'dark') AS dark_count,
    COUNT(DISTINCT cc.protein_id) FILTER (WHERE cc.curation_status = 'pending') AS pending_count
FROM archaea.structural_clusters sc
LEFT JOIN archaea.structural_cluster_members scm ON sc.id = scm.cluster_id
LEFT JOIN archaea.structure_quality_metrics sqm ON scm.protein_id = sqm.protein_id
LEFT JOIN archaea.curation_candidates cc ON scm.protein_id = cc.protein_id
GROUP BY sc.id, sc.cluster_rep_id, sc.cluster_size, sc.clustering_method, sc.tm_threshold;

-- ============================================
-- CURATION AUDIT TABLES
-- ============================================

-- curation_sessions: Track curator work sessions
CREATE TABLE IF NOT EXISTS archaea.curation_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL UNIQUE,
    curator_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    proteins_reviewed INTEGER DEFAULT 0,
    decisions_made INTEGER DEFAULT 0,
    novel_flags_added INTEGER DEFAULT 0,
    session_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_arch_cs_curator ON archaea.curation_sessions(curator_name);
CREATE INDEX IF NOT EXISTS idx_arch_cs_started ON archaea.curation_sessions(started_at);

-- curation_decisions: Detailed log of each curation decision
CREATE TABLE IF NOT EXISTS archaea.curation_decisions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES archaea.curation_sessions(session_id),
    protein_id VARCHAR(100) NOT NULL,
    curator_name VARCHAR(100) NOT NULL,

    -- Decision details
    decision_type VARCHAR(30) NOT NULL,  -- 'approve', 'flag_novel', 'defer', 'reject', 'skip'

    -- Previous and new status
    previous_status VARCHAR(30),
    new_status VARCHAR(30),

    -- Classification if assigned
    ecod_x_group INTEGER,
    ecod_h_group INTEGER,
    ecod_t_group INTEGER,
    ecod_f_group INTEGER,
    is_novel_fold BOOLEAN,
    is_novel_topology BOOLEAN,

    -- Curator input
    confidence_level INTEGER CHECK (confidence_level IS NULL OR confidence_level BETWEEN 1 AND 5),
    notes TEXT,

    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_arch_decision_type CHECK (
        decision_type IN ('approve', 'flag_novel', 'defer', 'reject', 'skip', 'classify')
    )
);

CREATE INDEX IF NOT EXISTS idx_arch_cd_session ON archaea.curation_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_arch_cd_protein ON archaea.curation_decisions(protein_id);
CREATE INDEX IF NOT EXISTS idx_arch_cd_curator ON archaea.curation_decisions(curator_name);
CREATE INDEX IF NOT EXISTS idx_arch_cd_type ON archaea.curation_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_arch_cd_decided ON archaea.curation_decisions(decided_at);

-- ============================================
-- GRANTS (if needed)
-- ============================================
-- GRANT SELECT ON archaea.v_curation_queue_full TO ecod;
-- GRANT SELECT ON archaea.v_protein_detail TO ecod;
-- GRANT SELECT ON archaea.v_curation_progress TO ecod;
-- GRANT SELECT ON archaea.v_cluster_summary TO ecod;
-- GRANT ALL ON archaea.curation_sessions TO ecod;
-- GRANT ALL ON archaea.curation_decisions TO ecod;

-- Done
SELECT 'Archaea schema extensions created successfully' AS status;
