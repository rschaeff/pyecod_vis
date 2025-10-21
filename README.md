# pyecod_vis

Interactive curation UI for manual domain boundary review and classification assignment in the ECOD workflow.

## Status: LIVE ON LEDA ✅

Full-stack application with working frontend and backend, now running on leda and accessible on the network.

## 🌐 Access the Application

**The application is now live on leda!**

- **Internal**: http://10.18.0.1:3000
- **External**: http://129.112.32.18:3000
- **From leda**: http://localhost:3000

## Server Management

### Start Server (Background)

```bash
cd /home/rschaeff/dev/pyecod_vis
./start_background.sh
```

### Stop Server

```bash
./stop_server.sh
```

### View Logs

```bash
tail -f pyecod_vis.log
```

## Local Development

If you want to run locally on your machine:

```bash
cd /home/rschaeff/dev/pyecod_vis
npm install
npm run dev
```

Visit http://localhost:3000

### Test APIs

```bash
bash test_apis.sh
```

## API Endpoints

All endpoints are implemented and working:

- `POST /api/auth/login` - Authenticate (demo mode: any user + password "ecod")
- `GET /api/auth/me` - Check session
- `POST /api/auth/logout` - Logout
- `GET /api/queue` - Get curation queue
- `GET /api/protein/:id` - Get protein details with domains and evidence
- `POST /api/curate` - Submit curation decision
- `GET /api/structure/:id` - Get structure file (CIF)

## Documentation

- [Frontend Strategy](docs/FRONTEND_STRATEGY.md) - Complete design document
- [API Implementation](docs/API_IMPLEMENTATION.md) - API details and test results
- [Schema Contract](docs/SCHEMA_CONTRACT_v2.md) - Database schema
- [Operations Boundary](docs/OPERATIONS_BOUNDARY.md) - System boundaries

## Features

### ✅ Implemented
- **Queue View** (`/queue`)
  - Sortable table (Protein, Length, Domains, Coverage)
  - Pagination (25/50/100 items per page)
  - Filter by quality (All, Low Coverage, Good, Failed)
  - Real-time statistics

- **Protein Curation View** (`/protein/[id]`)
  - 3-column desktop-optimized layout
  - 3D structure viewer with domain coloring (3Dmol.js)
  - Dense domain information table
  - Prominent decision panel with clear action descriptions
  - Boundary editing with manual override
  - Evidence display with top hits
  - Classification information (T/H/X/F groups)

- **API Layer**
  - Complete RESTful API
  - Database connection pooling
  - Error handling and logging
  - Structure file serving (CIF format)

### 🚧 Known Issues
- **Structure domain coloring**: Uses SEQRES positions on PDB-numbered structures
  - Needs pipeline-level fix to store PDB residue ranges
  - See `KNOWN_ISSUES.md` for details

### 📋 Planned Features
- Keyboard shortcuts for curation decisions
- Multi-context structure views (Full PDB, Chain, Domain superposition)
- Cluster propagation UI
- Production authentication
- Statistics dashboard
- Scientific context (publication info, release dates)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with pg
- **Auth**: Session-based (in-memory)
- **Styling**: Tailwind CSS
- **Structure Viewer**: 3Dmol.js
- **3D Graphics**: WebGL

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (COMPLETE ✅)
│   │   ├── queue/all/    # GET curation queue
│   │   ├── protein/[id]/ # GET protein details
│   │   ├── curate/       # POST curation decision
│   │   ├── structure/[id]/ # GET structure file (CIF)
│   │   └── auth/         # Login/logout/session
│   ├── queue/
│   │   └── page.tsx      # Queue view (COMPLETE ✅)
│   ├── protein/[id]/
│   │   └── page.tsx      # Protein curation view (COMPLETE ✅)
│   ├── layout.tsx        # Root layout with navigation
│   ├── page.tsx          # Home page
│   └── globals.css
├── components/
│   ├── Navigation.tsx    # Main nav bar
│   └── StructureViewer.tsx # 3Dmol.js viewer
└── lib/
    ├── db.ts             # Database pool
    ├── auth.ts           # Session management
    └── types.ts          # TypeScript types

docs/                     # Comprehensive documentation
scripts/                  # Utility scripts
KNOWN_ISSUES.md          # Known deficiencies and fixes
```

## Development Notes

- Uses Next.js 15 App Router (not Pages Router)
- All API routes in `src/app/api/`
- TypeScript strict mode enabled
- Database connection pooling (max 20 connections)
- Slow queries (>100ms) logged to console

## Testing

```bash
# Test all API endpoints
bash test_apis.sh

# Manual tests
curl http://localhost:3000/api/queue
curl http://localhost:3000/api/protein/8s72_A
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"ecod"}'
```

## Contributing

This is an internal ECOD project. See design docs before making changes.

## License

Internal use only.
