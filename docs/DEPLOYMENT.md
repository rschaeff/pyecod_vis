# ecod_curation Schema Deployment

**Date**: 2025-01-20
**Database**: dione:45000/ecod_protein
**Status**: ✅ Successfully Deployed and Tested

## Deployment Summary

### Schema Created

The `ecod_curation` schema has been successfully deployed to the production database.

**Location**: dione:45000/ecod_protein
**Owner**: ecod user
**Purpose**: Staging area for new PDB proteins awaiting manual curation

### Tables Created (7)

1. **ecod_curation.protein** - Proteins awaiting curation
2. **ecod_curation.domain_assignment** - Domain predictions and curator modifications
3. **ecod_curation.domain_evidence** - BLAST/HHsearch evidence supporting assignments
4. **ecod_curation.non_domain_region** - Regions marked as non-domain (junk)
5. **ecod_curation.curation_queue** - Proteins prioritized for manual review
6. **ecod_curation.curation_session** - Curator session tracking
7. **ecod_curation.curation_decision_log** - Log of all curation decisions

### Views Created (4)

1. **ecod_curation.queue_view** - Curation queue with protein details
2. **ecod_curation.ready_for_accession** - Proteins ready to move to ecod_commons
3. **ecod_curation.flagged_proteins** - Proteins needing expert review
4. **ecod_curation.curation_stats** - Overall curation statistics

### Indexes Created

- 20+ indexes for query performance
- Partial indexes on status fields for efficiency
- Foreign key indexes for joins

### Constraints

- Check constraints on status fields, confidence ranges
- Foreign key constraints with CASCADE deletes where appropriate
- Unique constraints on source_id, (protein_id, domain_number)

## Testing Results

### Test Scenario Executed

1. ✅ Insert protein with 2 domains
2. ✅ Insert evidence for domains
3. ✅ Add to curation queue
4. ✅ Simulate curator review (accept domain 1, modify domain 2)
5. ✅ Mark protein as curated
6. ✅ Verify protein appears in "ready_for_accession" view
7. ✅ Create session and log decision
8. ✅ Query all views successfully

### Sample Test Output

```sql
-- Protein after curation:
source_id | curation_status | curator_name | domains | accepted | modified | with_f_group | ready_for_accession
----------+-----------------+--------------+---------+----------+----------+--------------+---------------------
8abc_A    | curated         | test_curator |       2 |        1 |        1 |            2 | t

-- Ready for accession: YES (all domains have f-groups assigned)
```

## Permissions

- **ecod user**: Full access (owner)
- **PUBLIC**: Read-only access (SELECT only)

## Schema Files

- **Creation Script**: `sql/01_create_ecod_curation_schema.sql`
- **Test Script**: `sql/02_test_sample_data.sql`

## Data Flow

```
┌──────────────────┐
│  pdb_update      │  Pipeline operations (BLAST/HHsearch status)
└──────────────────┘
         ↓ pyecod_prod writes results
┌──────────────────┐
│ ecod_curation    │  ← YOU ARE HERE (Staging for new proteins)
│                  │  - Automated assignments from pyecod_prod
│                  │  - Curator decisions from pyecod_vis
│                  │  - Awaiting accession to ecod_commons
└──────────────────┘
         ↓ accession process (pyecod_prod script)
┌──────────────────┐
│ ecod_commons     │  Authoritative ECOD domains (PDB + AFDB)
└──────────────────┘
         ↓ references
┌──────────────────┐
│   ecod_rep       │  Hierarchy and representatives
└──────────────────┘
```

## Next Steps

### For pyecod_prod

1. **Update pipeline to write to ecod_curation**

   After step 8 (partition) completes:
   ```python
   from pyecod_prod.database.curation_loader import load_to_curation_staging

   # Load results to ecod_curation
   load_to_curation_staging(
       pdb_id=pdb_id,
       chain_id=chain_id,
       release_date=release_date,
       partition_result=partition_result,
       evidence=evidence_data
   )
   ```

2. **Implement queue population heuristics**

   Decide which proteins need manual review:
   ```python
   def should_queue_for_curation(partition_result):
       # Low confidence?
       if min(d.confidence for d in partition_result.domains) < 0.7:
           return True, 'low_confidence'

       # Low coverage?
       if partition_result.coverage < 0.8:
           return True, 'low_coverage'

       # Novel architecture?
       if is_novel_architecture(partition_result):
           return True, 'novel_architecture'

       # Auto-accept high quality
       return False, 'auto_accepted'
   ```

3. **Create accession script**

   See `OPERATIONS_BOUNDARY.md` for specification of:
   - `pyecod_prod/scripts/accession.py`
   - Reads from `ecod_curation.ready_for_accession`
   - Validates, assigns ECOD UIDs, writes to ecod_commons

### For pyecod_vis

1. **Initialize Next.js project**
   ```bash
   cd /home/rschaeff/dev/pyecod_vis
   npx create-next-app@latest . --typescript --tailwind --app
   ```

2. **Set up Prisma**
   ```bash
   npm install @prisma/client
   npm install -D prisma
   npx prisma init
   ```

3. **Generate Prisma schema**

   Introspect the database to generate Prisma schema:
   ```bash
   npx prisma db pull
   npx prisma generate
   ```

4. **Build first feature: Queue view**

   See `NEXT_STEPS.md` for phased development plan.

## Verification Queries

### Check schema exists
```sql
\dn ecod_curation
```

### Count tables and views
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'ecod_curation';
-- Should return 7 tables

SELECT COUNT(*) FROM information_schema.views
WHERE table_schema = 'ecod_curation';
-- Should return 4 views
```

### Check for data
```sql
-- Should be empty (no proteins yet)
SELECT COUNT(*) FROM ecod_curation.protein;

-- Check queue is ready
SELECT * FROM ecod_curation.queue_view;

-- Check stats (should show all zeros)
SELECT * FROM ecod_curation.curation_stats;
```

## Rollback Instructions

If you need to remove the schema:

```sql
-- WARNING: This will delete all data in ecod_curation
DROP SCHEMA ecod_curation CASCADE;
```

## Support

- **Schema Contract**: See `SCHEMA_CONTRACT_v2.md`
- **Operations Boundary**: See `OPERATIONS_BOUNDARY.md`
- **Development Guide**: See `CLAUDE.md`

---

**Status**: Schema is deployed and ready for integration with pyecod_prod and pyecod_vis.
