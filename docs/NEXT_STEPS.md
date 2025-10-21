# Next Steps for pyecod_vis

## Phase 0: Schema Negotiation (BEFORE coding)

1. **Review `SCHEMA_CONTRACT.md` with pyecod_prod team**
   - Resolve open questions (see bottom of SCHEMA_CONTRACT.md)
   - Agree on table names, column types, constraints
   - Decide: Who creates the schema? (Recommendation: pyecod_prod creates it)
   - Test: Can both teams access shared database?

2. **Create actual schema in database**
   ```bash
   # In pyecod_prod repo:
   psql $DATABASE_URL < sql/02_create_ecod_curation_schema.sql
   ```

3. **Verify permissions**
   ```sql
   -- pyecod_prod user should be able to:
   INSERT INTO ecod_curation.protein ...
   INSERT INTO ecod_curation.domain_assignment ...

   -- pyecod_vis user should be able to:
   SELECT FROM ecod_curation.*
   INSERT/UPDATE on curation_queue, curation_decision, etc.
   ```

## Phase 1: Foundation (Week 1)

### Day 1: Project Setup
```bash
# Initialize Next.js project
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir

# Install dependencies
npm install @prisma/client
npm install -D prisma

# Initialize Prisma
npx prisma init
```

### Day 2: Database Setup
1. Create `prisma/schema.prisma` matching `ecod_curation.*` tables
2. Test connection: `npx prisma db pull` (should see existing tables)
3. Generate client: `npx prisma generate`
4. Verify: `npx prisma studio`

### Day 3-5: Core Components
1. Create basic layout (`app/layout.tsx`)
2. Create curation page (`app/curate/page.tsx`)
3. Implement queue sidebar (read from `curation_queue`)
4. Implement basic protein display (read from `protein` + `domain_assignment`)

**Milestone**: Can view proteins from queue in browser

## Phase 2: Structure Viewer (Week 2)

### Critical: Implement Isolation Pattern

1. Create `lib/structure-viewer/editable-viewer-manager.ts` (NO React imports)
2. Install 3Dmol: `npm install 3dmol`
3. Create thin React wrapper: `components/structure/ProteinStructureViewer.tsx`
4. Test lifecycle: navigate between proteins, viewer doesn't break

**Anti-pattern to avoid**: Don't let React manage viewer lifecycle!

**Milestone**: Can view protein structure with domain highlighting

## Phase 3: Curation Actions (Week 3)

1. Implement "Accept" action
   - Update `domain_assignment.curation_status = 'accepted'`
   - Log decision to `curation_decision`
   - Move to next protein in queue

2. Implement keyboard shortcuts
   - `a` = accept
   - `Enter` = save and next
   - `j`/`k` = next/previous

3. Implement session tracking
   - Start session on page load
   - Track decisions
   - End session on close

**Milestone**: Can accept/reject proteins efficiently

## Phase 4: Editing (Week 4)

1. Domain boundary editing (form-based)
2. Classification modification (dropdown/autocomplete)
3. Non-domain region marking
4. Flag for expert review

**Milestone**: Full curation workflow works end-to-end

## Phase 5: Polish (Week 5-6)

1. Evidence panel (show supporting BLAST/HHsearch)
2. Undo/redo support
3. Session statistics
4. Error handling and loading states
5. Performance optimization

## Testing Strategy (Throughout)

### Manual Testing Checklist
- [ ] Can load queue
- [ ] Can view protein structure
- [ ] Can navigate between proteins (viewer doesn't break)
- [ ] Can accept/reject/modify
- [ ] Keyboard shortcuts work
- [ ] Changes persist in database
- [ ] No data loss on error/refresh

### Test Data
Work with pyecod_prod team to get:
- 10 "good" proteins (high confidence, clear domains)
- 10 "medium" proteins (moderate confidence)
- 10 "hard" proteins (low confidence, conflicts, gaps)

## Critical Success Factors

### DO:
- ✅ Negotiate schema FIRST
- ✅ Implement structure viewer isolation correctly
- ✅ Test with real pyecod_prod data early
- ✅ Focus on keyboard efficiency
- ✅ Keep components small (< 150 lines)

### DON'T:
- ❌ Start coding before schema is agreed
- ❌ Let React manage structure viewer lifecycle
- ❌ Add "nice to have" features
- ❌ Build generic exploration tools
- ❌ Mix file system access

## Integration with pyecod_prod

### Week 2-3: pyecod_prod Integration
While pyecod_vis is being built, pyecod_prod team should:

1. Implement `results_loader.py` to populate `ecod_curation.*`
2. Run small test batch (10-20 proteins)
3. Verify data appears correctly in database
4. Iterate on schema if needed

### Week 4: End-to-End Test
1. pyecod_prod processes batch → writes to DB
2. pyecod_vis reads from DB → displays for curation
3. Curator makes decisions → writes back to DB
4. Verify full cycle works

## Decision Framework Reminder

Before implementing ANY feature, ask:
1. Is this core to curation workflow? → If NO, REJECT
2. Can this be done in pyecod_prod CLI? → If YES, REJECT
3. Will this complicate the mental model? → If YES, REJECT

**Default: REJECT**

## Communication with pyecod_prod Team

### Regular check-ins on:
- Schema changes (any modifications need agreement)
- Data quality issues (missing fields, unexpected values)
- Performance (query optimization, indexing)
- Queue population logic (what should be auto-queued?)

### Shared understanding:
- pyecod_prod owns `pdb_update.*` completely
- pyecod_prod writes to `ecod_curation.*` (results only)
- pyecod_vis reads/writes `ecod_curation.*` (curation data)
- No file system coupling

## Metrics to Track

From day one, track:
- Time per protein (goal: < 2 minutes average)
- Decisions per hour (goal: 30+)
- Error rate (data loss, crashes)
- User feedback (confusion points, friction)

## When You're Tempted to Add a Feature...

1. Re-read `../domain-analysis-dashboard/LESSONS_LEARNED.md`
2. Ask: "Will this make curation faster?"
3. If no, DON'T ADD IT
4. If yes, prototype FAST and test with curator
5. If it slows them down, REMOVE IT

---

**Remember**: The current dashboard failed because it tried to do everything.
pyecod_vis succeeds by doing ONE thing excellently: enabling efficient domain curation.
