# ECOD Validation Curation Summary & Review Strategy

**Date**: November 21, 2025
**Curation Period**: November 7-21, 2025 (15 days)
**Total Issues Curated**: 619 cross-boundary validation issues

---

## Executive Summary

We have successfully curated 619 validation issues identifying high sequence identity across ECOD classification boundaries. Our analysis reveals that **~1.3% of ECOD domains require reclassification**, affecting 24,070 total domains (846 representatives + 23,224 non-representatives).

**Critical Finding**: Manual-manual representative conflicts are 100% PDB-PDB pairs and represent the highest-priority curation challenges requiring expert structural review.

---

## Curation Results

### Overall Statistics
- **Total Curations**: 619 issues
- **Flagged for Action**: 599 (96.8%)
- **Reviewed (No Action)**: 20 (3.2%)
- **Average Throughput**: 41 issues/day

### Actions Taken
| Action | Count | Percentage |
|--------|-------|------------|
| Reclassify Both | 309 | 49.9% |
| Reclassify Domain 2 | 115 | 18.6% |
| Reclassify Domain 1 | 100 | 16.2% |
| Investigate Structure | 72 | 11.6% |
| Merge H-groups | 3 | 0.5% |

### Issues by Severity
- **Critical**: 47 (7.6%)
- **High**: 179 (28.9%)
- **Medium**: 323 (52.2%)
- **Low**: 248 (40.1%)

### Issues by Boundary Type
- **Cross X-group** (Architecture): 654 (82.1%) - Highest priority
- **Cross H-group** (Homology): 127 (15.9%)
- **Cross F-group** (Family): 16 (2.0%)

---

## Downstream Impact Analysis

### Search Library Exclusion Requirements

**Scope for Exclusion:**
- **846 unique representatives** flagged (2.57% of ECOD reps)
- **23,224 non-rep domains** affected (1.30% of ECOD non-reps)
- **Total: 24,070 domains** to exclude from search libraries (1.32% of all ECOD domains)

**Note**: The non-rep count represents unique domains. Some domains appear in multiple flagged pairs, but are only counted once for exclusion purposes.

**Impact by Action:**

| Action | Reps | Non-reps | Total | Avg Non-reps/Rep |
|--------|------|----------|-------|------------------|
| Reclassify Domain 2 | 202 | 20,331 | 20,533 | 88 |
| Reclassify Domain 1 | 177 | 16,450 | 16,627 | 82 |
| Investigate Structure | 136 | 8,828 | 8,964 | 48 |
| Reclassify Both | 421 | 1,578 | 1,999 | 2 |
| Merge H-groups | 6 | 194 | 200 | 32 |

### F-group Deprecation Impact

**Critical Finding**: 354 out of 562 flagged representatives (63%) are the **sole representative in their F-group**.
- **354 F-groups** would require deprecation or merging
- Context: 78% of all F-groups have only 1 representative
- 12,836 non-rep domains would need reassignment

### Composite F-group Analysis

**46 composite F-groups** affected (8.2% of flagged reps, 59% of non-rep impact):
- **99% of Pfam components are reused** elsewhere in ECOD
- These represent mis-assigned multi-domain architectures, not novel combinations
- Top 3 composite F-groups: ATP synthase (1,671 nr), AMP-binding (1,249 nr), TPR/Wheel (824 nr)

---

## Representative Type Stratification

### Distribution by Rep Type Combination

| Rep Type | Pairs | Unique Reps | Non-reps | Avg/Pair | Investigate % | Structure Type |
|----------|-------|-------------|----------|----------|---------------|----------------|
| **Manual-Manual** | 23 | 43 | 7,729 | 336 | 70% | **100% PDB-PDB** |
| **Manual-Provisional** | 168 | 294 | 32,839 | 195 | 8% | 51% PDB-PDB, 49% PDB-AFDB |
| **Provisional-Provisional** | 586 | 625 | 6,815 | 12 | 11% | 90% AFDB-AFDB |

### Key Insights

1. **Manual-Manual = Highest Priority**
   - Only 23 pairs but 336 non-reps/pair average impact
   - 70% flagged for structural investigation (vs 8-11% for other types)
   - 100% involve experimental (PDB) structures
   - Represent actual human curation disagreements on high-quality data

2. **Manual-Provisional = Highest Volume**
   - 168 pairs affecting 32,839 non-reps (69% of total impact)
   - Mix of human curation and automated assignments
   - Split evenly between PDB-PDB and PDB-AFDB pairs

3. **Provisional-Provisional = Lowest Priority**
   - 586 pairs but only 12 non-reps/pair
   - 90% are AFDB-AFDB (automated assignments)
   - Suitable for batch processing

### Structure Type Analysis

**Overall ECOD Distribution**:
- PDB-PDB: 1,051 pairs (41.3%)
- AFDB-AFDB: 1,057 pairs (41.6%)
- PDB-AFDB: 436 pairs (17.1%)

**Flagging Rate by Type**:
- PDB-AFDB: **19.04%** flagged (highest enrichment)
- AFDB-AFDB: **50.14%** flagged (but low impact)
- PDB-PDB: 2-8% flagged depending on rep type

**Critical Finding**: All manual-manual conflicts involve PDB structures, confirming these are the most carefully curated domains where disagreements represent fundamental classification challenges.

---

## Prioritized Review Strategy

### PHASE 1A: Manual-Manual Critical Review
**Priority: IMMEDIATE | Expert Structural Review Required**

**10 representatives, 6,525 non-reps**

| Rank | Domain | F-group | Non-reps | Action | Severity | Type |
|------|--------|---------|----------|--------|----------|------|
| 1 | e1ekxA1 | OTCace_N | 1,552 | Investigate | Critical | PDB |
| 2 | e3exaA2 | IPPT | 768 | Investigate | High | PDB |
| 3 | e4z87A2 | CBS | 734 | Investigate | Low | PDB |
| 4 | e4kmuC3 | *(unassigned)* | 643 | Investigate | Low | PDB |
| 5 | e4s20C5 | RNA_pol_Rpb2_6 | 551 | Investigate | Low | PDB |
| 6 | e4af0A1 | IMPDH | 334 | Investigate | Low | PDB |
| 7 | e2ot3A2 | VPS9 | 163 | Investigate | Critical | PDB |
| 8 | e2qgnA1 | IPPT | 123 | Investigate | High | PDB |
| 9 | e2ot3A1 | DUF5601 | 119 | Investigate | Critical | PDB |
| 10 | e2ygqA4 | EGF | 102 | Investigate | Low | PDB |

**Rationale**: These are manually curated PDB structures where two human experts made different classification decisions. They have the highest per-case impact and require structural investigation to resolve.

---

### PHASE 1B: Manual-Provisional Very High Impact
**Priority: HIGH | 11 representatives, 14,180 non-reps**

**Top Cases (>500 non-reps each):**

| Domain | F-group | Non-reps | Type | Action |
|--------|---------|----------|------|--------|
| e2jdiD2 | ATP-synt_VA_C | 2,876 | Single | Reclassify D2 |
| e1g1tA2 | EGF | 2,239 | Single | Reclassify D1 |
| e6rd4X1 | ATP-synt_ab,ATP-synt_VA_C | 1,671 | **Composite** | Reclassify D2 |
| e5u89A1 | AMP-binding,AMP-binding_C | 1,249 | **Composite** | Reclassify D2 |
| e3gn4E1 | MYO6_lever | 890 | Single | Reclassify Both |
| e6hftA1 | TPR_1,Wheel | 824 | **Composite** | Reclassify D2 |
| e1swyA1 | Phage_lysozyme | 814 | Single | Reclassify D1 |

**Rationale**: Mix of manual and provisional representatives with massive downstream impact. Includes major protein families (ATP synthase, AMP-binding, kinases).

---

### PHASE 2: High Non-rep Impact
**Priority: MEDIUM | 72 representatives, 13,910 non-reps**

- **Manual-Manual Medium** (17 reps, 956 nr): Investigate cases with 1-100 non-reps
- **Manual-Provisional High** (55 reps, 12,954 nr): Reclassifications with 100-500 non-reps

**Approach**: Systematic review, can be handled by trained curators with expert consultation.

---

### PHASE 3: Low-Impact Validation
**Priority: LOW | 270 representatives, 6,868 non-reps**

- Cases with <100 non-reps
- Can be handled in batches
- Lower priority due to limited downstream impact

---

### PHASE 4: Zero Non-rep Impact
**Priority: DEFER | 510 representatives, 0 non-reps**

- No downstream propagation
- Can be addressed opportunistically
- Includes many AFDB-AFDB provisional pairs

---

## Immediate Action Items

### 1. Generate Exclusion Lists for Search Libraries
**Deliverable**: Two lists for pipeline modification
- `flagged_representatives.txt` - 846 representative UIDs to exclude
- `flagged_nonreps.txt` - 23,224 non-rep UIDs to exclude

**Location**: `/home/rschaeff/dev/pyecod_vis/`

**Impact**: Prevents propagation of classification errors in automated workflows

### 2. Initiate Phase 1A Expert Review (10 cases)
**Target**: Complete within 2 weeks
**Resources Required**: Senior structural biologist + domain expert
**Expected Outcome**: Resolution strategy for highest-impact manual-manual conflicts

### 3. Develop Phase 1B Reclassification Strategy (11 cases)
**Target**: Complete within 4 weeks
**Focus Areas**:
- ATP synthase family boundaries
- AMP-binding domain architecture
- Kinase/TPR repeat classifications

**Key Question**: Are these composite F-groups or incorrectly split domains?

### 4. Create Review Interface Enhancement
**Feature**: Add "Manual-Manual Priority" filter to validation page
**Benefit**: Focus curator attention on highest-priority conflicts

---

## Strategic Recommendations

### Short-term (1-2 months)
1. **Priority-based review workflow**: Address Phase 1A (10 cases) and 1B (11 cases) immediately
2. **Generate search library exclusions**: Prevent error propagation
3. **Document resolution patterns**: Build knowledge base for similar cases

### Medium-term (3-6 months)
1. **Phase 2 systematic review**: Address remaining high-impact cases (72 reps)
2. **F-group consolidation strategy**: Develop plan for 354 sole-rep F-groups
3. **Composite F-group analysis**: Determine correct domain boundaries for multi-domain architectures

### Long-term (6-12 months)
1. **AFDB-AFDB batch processing**: Automated handling of 530 low-impact provisional pairs
2. **Classification consistency guidelines**: Prevent future manual-manual conflicts
3. **Cross-boundary detection enhancement**: Improve automated flagging criteria

---

## Metrics & Success Criteria

### Review Completion Targets
- **Phase 1A**: 100% within 2 weeks (10 cases)
- **Phase 1B**: 100% within 4 weeks (11 cases)
- **Phase 2**: 80% within 3 months (57/72 cases)
- **Phase 3**: 50% within 6 months (135/270 cases)

### Quality Metrics
- Resolution consensus rate: >90% for Phase 1 cases
- Non-rep reassignment success: >95% accurate reclassification
- Search library improvement: <1% false positive rate after exclusions

### Documentation
- Review decision rationale for all Phase 1 cases
- F-group deprecation/merge proposals for affected families
- Updated classification guidelines to prevent recurrence

---

## Appendix: Technical Details

### Database Queries
Flagged representatives and non-reps can be queried from:
- Table: `ecod_curation.validation_curation`
- Filter: `curation_status = 'flagged'`
- Join: `ecod_curation.cross_boundary_pair` for details

### File Locations
- Validation interface: `/validation` (pyecod_vis)
- One-click reclassify button: Added Nov 21, 2025
- Curation data: `ecod_protein` database on dione:45000
- Exclusion lists: `/home/rschaeff/dev/pyecod_vis/flagged_*.txt`

### Contact
For questions regarding:
- **Curation priorities**: See Phase 1A/1B tables above
- **Technical implementation**: Review this document and validation interface
- **Strategic decisions**: Consult with ECOD steering committee

---

**Document Version**: 1.1
**Last Updated**: November 21, 2025
**Changes in v1.1**: Corrected non-rep count to 23,224 unique domains (v1.0 had 47,383 which double-counted domains appearing in multiple pairs)
**Next Review**: After Phase 1A completion (2 weeks)
