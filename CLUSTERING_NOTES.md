# Clustering Architecture Notes

**Created**: 2025-10-21
**Status**: Clustering loaded, but API queries need fixes

## Clustering Schema Design

The clustering schema uses a **two-level hierarchy**:

### 1. `sequence_cluster` - Clustering RUN
One record per weekly batch clustering:
```sql
id: 1
cluster_name: "ecod_weekly_20250905_70pct"
clustering_method: "cd-hit"
sequence_identity_threshold: 0.70
total_proteins: 497 (all proteins in .clstr file)
total_clusters: 357 (number of CD-HIT clusters)
representative_count: 12 (only loaded proteins that are reps)
```

### 2. `cluster_membership` - Individual memberships
Many records linking proteins to clusters:
```sql
cluster_id: 1  ← references sequence_cluster.id (NOT individual cluster!)
protein_id: 42
is_representative: true
cluster_rank: 5  ← THIS identifies the individual CD-HIT cluster!
```

## Current Data State

**Loaded**: `ecod_weekly_20250905_70pct`
- Only 97 out of 497 proteins loaded (these existed in ecod_curation.protein)
- All share `cluster_id = 1` (the clustering run)
- Grouped by `cluster_rank` into individual clusters

**Example cluster (cluster_rank = 5)**:
- Representative: `8yl2_A`
- Members: `8yl2_B`, `8yl2_C`, `8yl2_D`, ...

## ⚠️ Problem with Current API Queries

Our queue and cluster APIs use `cluster_id` to group proteins, but they should use `cluster_rank`!

### Wrong (current):
```sql
-- This groups ALL proteins together (cluster_id=1 for all)
SELECT p.*, COUNT(cm2.protein_id) as cluster_size
FROM protein p
LEFT JOIN cluster_membership cm ON p.id = cm.protein_id
LEFT JOIN cluster_membership cm2 ON cm.cluster_id = cm2.cluster_id
```

### Correct (needs fix):
```sql
-- Group by cluster_rank to get individual CD-HIT clusters
SELECT p.*, COUNT(cm2.protein_id) as cluster_size
FROM protein p
LEFT JOIN cluster_membership cm ON p.id = cm.protein_id
LEFT JOIN cluster_membership cm2
  ON cm.cluster_id = cm2.cluster_id
  AND cm.cluster_rank = cm2.cluster_rank
```

## Files That Need Updates

### pyecod_vis APIs:
1. `/api/queue/all/route.ts` (lines 68-80) - Fix JOIN to use cluster_rank
2. `/api/cluster/[id]/route.ts` (lines 63-79) - Fix JOIN to use cluster_rank

### Test after fixes:
```bash
# Should show ~12 representatives (not 100)
curl http://localhost:3000/api/queue/all

# Should show cluster members for 8yl2_A
curl http://localhost:3000/api/cluster/8yl2_A
```

## Production Workflow Integration

**Updated**: `/home/rschaeff/dev/pyecod_prod/scripts/run_production_week_with_cdhit.py`
- Added step [7/11]: Load clustering to database
- Added step [10/11]: Load to curation schema

**Result**: Future batches will automatically populate clustering data

## Batch Isolation

**Good news**: Clustering IS scoped per batch!
- Each weekly batch gets its own `sequence_cluster` record
- `cluster_id` increments: batch 1 → cluster_id=1, batch 2 → cluster_id=2
- No cross-batch cluster collisions

**Future consideration**: Add batch filtering to queue UI
- Add `processing_version` or `cluster_id` filter
- Show which batch proteins came from
