# pyecod_vis

**Domain Curation Tool for ECOD**

A focused, efficient web application for human-in-the-loop curation of automated ECOD domain assignments.

## Purpose

pyecod_vis enables curators to:
- Review automated domain predictions from pyecod pipeline
- Accept correct assignments
- Modify boundaries or classifications
- Mark non-domain regions (linkers, disordered, etc.)
- Flag uncertain cases for expert review

**What this is NOT**: General-purpose protein viewer, batch processor, monitoring dashboard, or administrative tool.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Initialize database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

Visit http://localhost:3000/curate to start curating.

## Architecture

- **Framework**: Next.js 15 (App Router, Server Components)
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Structure Viewer**: 3Dmol.js

See `CLAUDE.md` for detailed architecture and development guide.

## Data Contract

pyecod_vis reads domain assignments written by pyecod_prod. See `SCHEMA_CONTRACT.md` for the database interface specification.

**Key principle**: pyecod_prod writes results → pyecod_vis reads and curates

## Project Status

**Status**: Initial development
**Created**: 2025-01-20

## Documentation

- `CLAUDE.md` - Architecture and development guide
- `SCHEMA_CONTRACT.md` - Database interface with pyecod_prod
- `../domain-analysis-dashboard/LESSONS_LEARNED.md` - Mistakes to avoid

## Success Metrics

- Curators can review 30+ proteins per hour
- Keyboard-driven workflow
- Zero data loss
- Single clear purpose (no scope creep)

## License

[Add license here]
