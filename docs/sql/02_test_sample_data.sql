-- ============================================================================
-- Test Sample Data for ecod_curation Schema
-- ============================================================================
-- Purpose: Verify the schema works correctly with realistic test data
-- ============================================================================

BEGIN;

-- Test 1: Insert a sample protein
INSERT INTO ecod_curation.protein
(source_id, pdb_id, chain_id, release_date, sequence, sequence_length,
 processed_at, processing_version, partition_coverage, domain_count, partition_quality)
VALUES
('8abc_A', '8abc', 'A', '2025-01-20',
 'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLPDQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPVLEDAFELSSMGIRVDADTLKHQLALTGDEDRLELEWHQALLRGEMPQTIGGGIGQSRLTMLLLQLPHIGQVQAGVWPAAVRESVPSLL',
 295, NOW(), 'pyecod_prod_v1.0_test', 0.95, 2, 'good');

-- Get the protein_id
DO $$
DECLARE
    test_protein_id int;
    domain1_id int;
    domain2_id int;
BEGIN
    SELECT id INTO test_protein_id FROM ecod_curation.protein WHERE source_id = '8abc_A';

    -- Test 2: Insert domain assignments
    INSERT INTO ecod_curation.domain_assignment
    (protein_id, domain_number, start_pos, end_pos, residue_range,
     assigned_t_group, assigned_h_group, assigned_x_group, assigned_f_group,
     best_match_ecod_uid, assignment_method, classification_level,
     confidence, source, created_by)
    VALUES
    (test_protein_id, 1, 10, 150, '10-150',
     '1.1.13', '1.1', '1.1.13', '1.1.13.29',
     3066545, 'blast', 'f_group_specific',
     0.92, 'automated', 'pyecod_prod_v1.0_test')
    RETURNING id INTO domain1_id;

    INSERT INTO ecod_curation.domain_assignment
    (protein_id, domain_number, start_pos, end_pos, residue_range,
     assigned_t_group, assigned_h_group, assigned_x_group, assigned_f_group,
     best_match_ecod_uid, assignment_method, classification_level,
     confidence, source, created_by)
    VALUES
    (test_protein_id, 2, 160, 280, '160-280',
     '557.1.1', NULL, NULL, NULL,
     NULL, 'hhsearch', 't_group_only',
     0.65, 'automated', 'pyecod_prod_v1.0_test')
    RETURNING id INTO domain2_id;

    -- Test 3: Insert evidence for domain 1
    INSERT INTO ecod_curation.domain_evidence
    (domain_id, evidence_type, hit_ecod_uid, hit_pdb_id, hit_chain_id,
     evalue, score, query_coverage, hit_coverage, query_range, hit_range,
     ref_t_group, ref_h_group, ref_x_group, ref_f_group)
    VALUES
    (domain1_id, 'blast_domain', 3066545, '8s9s', '7',
     1.5e-45, 189.2, 0.95, 0.92, '10-150', '5-145',
     '1.1.13', '1.1', '1.1.13', '1.1.13.29');

    INSERT INTO ecod_curation.domain_evidence
    (domain_id, evidence_type, hit_ecod_uid, hit_pdb_id, hit_chain_id,
     evalue, score, query_coverage, hit_coverage, query_range, hit_range,
     ref_t_group, ref_h_group, ref_x_group, ref_f_group)
    VALUES
    (domain2_id, 'hhsearch', NULL, NULL, NULL,
     0.00012, 52.3, 0.88, 0.85, '160-280', '10-125',
     '557.1.1', NULL, NULL, NULL);

    -- Test 4: Add to curation queue
    INSERT INTO ecod_curation.curation_queue
    (protein_id, priority, priority_reason)
    VALUES
    (test_protein_id, 5, 'low_confidence_domain_2');

    RAISE NOTICE 'Test data inserted successfully. Protein ID: %', test_protein_id;
END $$;

-- Test 5: Query the views
SELECT 'Queue View Test:' as test;
SELECT * FROM ecod_curation.queue_view;

SELECT 'Curation Stats Test:' as test;
SELECT * FROM ecod_curation.curation_stats;

-- Test 6: Simulate curator accepting domain 1, modifying domain 2
UPDATE ecod_curation.domain_assignment
SET curator_decision = 'accepted',
    curator_name = 'test_curator',
    curated_at = NOW()
WHERE protein_id = (SELECT id FROM ecod_curation.protein WHERE source_id = '8abc_A')
  AND domain_number = 1;

UPDATE ecod_curation.domain_assignment
SET curator_decision = 'modified',
    curator_name = 'test_curator',
    curated_at = NOW(),
    start_pos = 165,  -- Modified boundary
    assigned_f_group = '557.1.1.1',  -- Added f-group
    source = 'curator_modified'
WHERE protein_id = (SELECT id FROM ecod_curation.protein WHERE source_id = '8abc_A')
  AND domain_number = 2;

-- Test 7: Mark protein as curated
UPDATE ecod_curation.protein
SET curation_status = 'curated',
    curator_name = 'test_curator',
    curated_at = NOW()
WHERE source_id = '8abc_A';

-- Test 8: Check ready for accession
SELECT 'Ready for Accession Test (should be YES - all domains have f-groups):' as test;
SELECT * FROM ecod_curation.ready_for_accession;

-- Test 9: Create a session
INSERT INTO ecod_curation.curation_session
(curator_name, proteins_reviewed, decisions_made)
VALUES
('test_curator', 1, 2);

-- Test 10: Log the decision
INSERT INTO ecod_curation.curation_decision_log
(session_id, protein_id, has_domains, domains_accepted, domains_modified,
 confidence_level, review_time_seconds)
SELECT
    (SELECT id FROM ecod_curation.curation_session WHERE curator_name = 'test_curator' ORDER BY id DESC LIMIT 1),
    id,
    true,
    true,
    true,
    4,
    120
FROM ecod_curation.protein
WHERE source_id = '8abc_A';

COMMIT;

-- Show final state
SELECT 'Final Test Results:' as summary;
SELECT
    p.source_id,
    p.curation_status,
    p.curator_name,
    COUNT(da.id) as domains,
    COUNT(da.id) FILTER (WHERE da.curator_decision = 'accepted') as accepted,
    COUNT(da.id) FILTER (WHERE da.curator_decision = 'modified') as modified,
    COUNT(da.id) FILTER (WHERE da.assigned_f_group IS NOT NULL) as with_f_group,
    BOOL_AND(da.assigned_f_group IS NOT NULL) as ready_for_accession
FROM ecod_curation.protein p
LEFT JOIN ecod_curation.domain_assignment da ON p.id = da.protein_id
WHERE p.source_id = '8abc_A'
GROUP BY p.source_id, p.curation_status, p.curator_name;

-- Cleanup
-- Uncomment to clean up test data:
-- DELETE FROM ecod_curation.protein WHERE source_id = '8abc_A';
