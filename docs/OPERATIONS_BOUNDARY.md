# Operations Boundary: What pyecod_vis Does NOT Do

**Critical**: This document defines what pyecod_vis explicitly does NOT handle to maintain focus.

## Clear Separation

```
┌──────────────────────────────────────────────────────────┐
│ pyecod_vis: CURATION INTERFACE ONLY                      │
│                                                           │
│ ✅ Human reviews proteins                                │
│ ✅ Accept/modify/reject domain assignments               │
│ ✅ Assign f-groups (via UI dropdown/autocomplete)        │
│ ✅ Mark junk regions                                     │
│ ✅ Flag for expert review                                │
│ ✅ Track curation sessions                               │
│                                                           │
│ Reads from: ecod_curation                                │
│ Writes to: ecod_curation (decisions only)                │
└──────────────────────────────────────────────────────────┘
                        │
                        │ Data sits in ecod_curation
                        │ waiting for accession
                        ↓
┌──────────────────────────────────────────────────────────┐
│ pyecod_prod: OPERATIONS (accession script)               │
│                                                           │
│ ✅ Batch curated proteins                                 │
│ ✅ Validate f-group assignments                           │
│ ✅ Migrate ecod_curation → ecod_commons                   │
│ ✅ Assign ECOD UIDs and domain IDs                        │
│ ✅ Create f_group_assignments records                     │
│ ✅ Handle versioning                                      │
│ ✅ Cleanup accessioned records from ecod_curation         │
│                                                           │
│ This is a CLI script, not part of pyecod_vis             │
└──────────────────────────────────────────────────────────┘
```

## What pyecod_vis Does

### Curation Workflow (ONLY)

1. **Display Queue**
   - Read from `ecod_curation.curation_queue`
   - Show proteins prioritized for review
   - Filter by confidence, coverage, etc.

2. **Review Protein**
   - Display structure (3Dmol)
   - Display domain assignments
   - Display evidence (BLAST/HHsearch hits)
   - Show suggested f-group assignments

3. **Make Decisions**
   ```typescript
   // Accept automated assignment
   UPDATE domain_assignment
   SET curator_decision = 'accepted',
       curator_name = 'curator1'
   WHERE id = ...;

   // Modify boundaries
   UPDATE domain_assignment
   SET start_pos = 95,
       end_pos = 205,
       source = 'curator_modified',
       curator_decision = 'modified'
   WHERE id = ...;

   // Assign/change f-group (via dropdown)
   UPDATE domain_assignment
   SET assigned_f_group = '1.1.13.29',
       assigned_t_group = '1.1.13',
       assigned_h_group = '1.1',
       assigned_x_group = '1.1.13',
       assignment_method = 'manual'
   WHERE id = ...;

   // Mark as junk
   INSERT INTO non_domain_region
   (protein_id, start_pos, end_pos, reason, curator_name)
   VALUES (...);

   // Flag for expert
   UPDATE domain_assignment
   SET curator_decision = 'needs_expert',
       flagged_as_novel = true,
       flag_reason = 'Potential new fold, no hits'
   WHERE id = ...;
   ```

4. **Complete Protein**
   ```typescript
   UPDATE protein
   SET curation_status = 'curated',
       curator_name = 'curator1',
       curated_at = NOW()
   WHERE id = ...;

   // Move to next protein in queue
   ```

**That's it.** pyecod_vis never touches ecod_commons or ecod_rep for writes.

## What pyecod_vis Does NOT Do

### ❌ Accession Operations

**NOT in pyecod_vis**:
- Batching curated proteins
- Assigning ECOD UIDs (e.g., 3066545)
- Assigning domain IDs (e.g., "e8abcA1")
- Creating records in `ecod_commons.proteins`
- Creating records in `ecod_commons.domains`
- Creating records in `ecod_commons.f_group_assignments`
- Version management in `ecod_commons.versions`
- Cleanup of accessioned records

**Why?**: These are operational tasks that require:
- Coordination across the database
- Atomic transactions
- Error handling and rollback
- Validation against existing ECOD
- You (the maintainer) reviewing exceptional cases

**Where?**: `pyecod_prod/scripts/accession.py` (CLI tool)

### ❌ Group Management

**NOT in pyecod_vis**:
- Creating new T/H/X/F groups in `ecod_rep.cluster`
- Modifying group hierarchies
- Adding representatives to `ecod_rep.domain`
- Changing group names or descriptions

**Why?**: Requires expert knowledge and affects the entire ECOD hierarchy.

**Where?**: You do this manually or via separate admin tools.

### ❌ Validation and Quality Control

**NOT in pyecod_vis**:
- Validating that all domains have f-groups before accession
- Checking for conflicts with existing ECOD domains
- Running validation rules
- Generating accession reports

**Why?**: Quality gates before promoting to production data.

**Where?**: `pyecod_prod/scripts/validate_batch.py` → `accession.py`

## Interface: What pyecod_vis Provides to Operations

pyecod_vis curates data in `ecod_curation`. When done, the data is ready for accession:

```sql
-- View: Proteins ready for accession
CREATE VIEW ecod_curation.ready_for_accession AS
SELECT
    p.id,
    p.source_id,
    p.pdb_id,
    p.chain_id,
    p.curator_name,
    p.curated_at,
    COUNT(da.id) as domain_count,
    BOOL_AND(da.assigned_f_group IS NOT NULL) as all_have_f_group,
    BOOL_AND(da.curator_decision IN ('accepted', 'modified')) as all_decided
FROM ecod_curation.protein p
JOIN ecod_curation.domain_assignment da ON p.id = da.protein_id
WHERE p.curation_status = 'curated'
  AND NOT p.accessioned
GROUP BY p.id
HAVING BOOL_AND(da.assigned_f_group IS NOT NULL)  -- All domains MUST have f-group
   AND BOOL_AND(da.curator_decision IN ('accepted', 'modified'));
```

Then you (or your accession script) can:

```bash
# In pyecod_prod
python -m pyecod_prod accession batch --name weekly_20250120

# This script:
# 1. Reads from ecod_curation.ready_for_accession
# 2. Validates all domains have f-groups
# 3. Assigns ECOD UIDs and domain IDs
# 4. Writes to ecod_commons
# 5. Marks as accessioned in ecod_curation
# 6. Optionally cleans up old ecod_curation records
```

## For pyecod_prod Team

### What to Add to pyecod_prod

**New script needed**: `pyecod_prod/scripts/accession.py`

```python
"""
Accession script: Move curated proteins from ecod_curation → ecod_commons

Usage:
    python -m pyecod_prod accession batch --name weekly_20250120
    python -m pyecod_prod accession validate --protein-id 12345
    python -m pyecod_prod accession cleanup --older-than 30days
"""

@click.group()
def accession():
    """Accession commands for moving curated proteins to ecod_commons"""
    pass

@accession.command()
@click.option('--name', required=True, help='Batch name (e.g., weekly_20250120)')
@click.option('--dry-run', is_flag=True, help='Show what would be done')
def batch(name, dry_run):
    """Accession a batch of curated proteins"""

    # 1. Get proteins ready for accession
    ready = db.query("SELECT * FROM ecod_curation.ready_for_accession")

    console.print(f"Found {len(ready)} proteins ready for accession")

    if dry_run:
        # Show what would happen
        return

    # 2. For each protein
    for protein in ready:
        # a. Assign ECOD UIDs
        # b. Create ecod_commons.proteins record
        # c. Create ecod_commons.domains records
        # d. Create ecod_commons.f_group_assignments records
        # e. Mark as accessioned in ecod_curation

    console.print(f"[green]✓ Accessioned {len(ready)} proteins to ecod_commons[/green]")

@accession.command()
@click.option('--protein-id', type=int, required=True)
def validate(protein_id):
    """Validate a protein is ready for accession"""

    # Check:
    # - All domains have curator decision
    # - All domains have f-group
    # - No conflicting assignments
    # - etc.

@accession.command()
@click.option('--older-than', default='30days', help='Clean up records older than this')
def cleanup(older_than):
    """Clean up old accessioned records from ecod_curation"""

    # Delete proteins from ecod_curation that were accessioned > 30 days ago
    # (Keep a historical window for debugging)
```

**New validation logic**: `pyecod_prod/validation/accession_checks.py`

```python
def validate_protein_for_accession(protein_id: int) -> tuple[bool, list[str]]:
    """
    Check if a protein in ecod_curation is ready for accession.

    Returns: (is_valid, list_of_errors)
    """
    errors = []

    # 1. All domains must have f-group
    domains = db.query("""
        SELECT * FROM ecod_curation.domain_assignment
        WHERE protein_id = %s
    """, (protein_id,))

    for domain in domains:
        if not domain.assigned_f_group:
            errors.append(f"Domain {domain.domain_number} missing f-group")

        if domain.curator_decision not in ('accepted', 'modified'):
            errors.append(f"Domain {domain.domain_number} not curated")

    # 2. F-groups must exist in ecod_rep
    f_groups = [d.assigned_f_group for d in domains if d.assigned_f_group]
    existing = db.query("""
        SELECT id FROM ecod_rep.cluster WHERE id = ANY(%s)
    """, (f_groups,))

    missing = set(f_groups) - set(e.id for e in existing)
    if missing:
        errors.append(f"F-groups not found in ecod_rep: {missing}")

    # 3. No duplicate domain boundaries
    # ... more checks

    return (len(errors) == 0, errors)
```

## Summary

**pyecod_vis contract**:
- Input: `ecod_curation.*` (proteins from pyecod_prod pipeline)
- Output: `ecod_curation.*` (curated decisions)
- Never touches: `ecod_commons.*` or `ecod_rep.*` for writes

**pyecod_prod contract**:
- Writes TO: `ecod_curation.*` (pipeline results)
- Reads FROM: `ecod_curation.*` (curated decisions)
- Writes TO: `ecod_commons.*` (accession)
- Owns: Operational scripts for accession, validation, cleanup

This keeps pyecod_vis focused and pyecod_prod in control of all data migration.
