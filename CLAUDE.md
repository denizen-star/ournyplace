# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start local dev server at http://localhost:8889 (requires Netlify CLI)
npm run migrate    # Initialize or reset PlanetScale schema (tables, default criteria, neighborhoods)
npm run split-badges  # Split status badge sprite sheet into individual PNGs
```

Environment: copy `.env.example` to `.env.local` and set `DATABASE_URL` (PlanetScale HTTP connection string) and `APP_NAME=nyhome`.

## Architecture

**nyhome** is a private PWA for two partners (Kerv and Peter) to score and track NYC apartment listings. No build step — vanilla JS served directly by Netlify CLI in dev, with Netlify Functions as the API layer and PlanetScale MySQL for persistence.

### Routing (netlify.toml)

- `/` → `index.html` — Public shortlist (card grid with scores, status, filter bar)
- `/admin` → `admin/index.html` — Management dashboard (add/edit apartments, criteria config, next actions)
- `/details/?id=…` → `details/index.html` — Full apartment view (scorecard, tour, application tracking)
- `/api/*` → `/.netlify/functions/:splat`

### Frontend (`assets/js/`)

- **`api.js`** — Fetch wrapper; all API client methods live here
- **`app.js`** — Shortlist rendering and filtering
- **`admin.js`** — Admin form logic (apartments, criteria, drag-reorder)
- **`details.js`** — Details page tabs, status transitions, per-partner scoring UI
- **`apartmentStatus.js`** — Shared status enum and CSS class mapping (used by both client and `lib/`)

Data is fetched on load, cached to `localStorage`, and re-fetched after mutations. UI re-renders optimistically on success; failures show toast feedback.

### Backend (`netlify/functions/`, `lib/`)

- **`lib/db.js`** — PlanetScale connection pool with `execute()` and `insert()` helpers
- **`lib/apartmentRepository.js`** — High-level CRUD for apartments (title generation, complex saves with related tables)
- **`lib/http.js`** — Response helpers (`json()`, body parsing, money conversion cents↔dollars)
- **`netlify/functions/apartments.js`** — GET list, POST create, PUT update, DELETE
- **`netlify/functions/criteria.js`** — POST new, PUT update fields or reorder via `orderedIds`
- **`netlify/functions/ratings.js`** — POST partner vote (0–5 per criterion)
- **`netlify/functions/visits.js`** / **`applications.js`** — Tour and broker tracking

### Database

All tables prefixed `nyp_`. Money stored as integer cents. Key tables: `nyp_apartments`, `nyp_criteria`, `nyp_ratings` (one row per apartment × partner × criterion, unique constraint), `nyp_visits`, `nyp_applications`, `nyp_neighborhoods` (autocomplete seed data).

### Status Progression

```
new → evaluating → shortlisted → tour_scheduled → toured → finalist →
applying → applied → approved → lease_review → signed
(terminal: rejected, archived)
```

Each status has a corresponding PNG badge in `assets/img/` and a neon-border CSS class (`listing-status-*`). Service worker (`sw.js`) caches shell assets; cache-bust by bumping `?v=` query params in HTML and the version string in `sw.js` in lockstep.

### Scoring

Each partner votes 0–5 on each active criterion. Criteria have weights. Final score is a weighted average across both partners. The paste helper in the admin form parses raw StreetEasy listing text to auto-fill apartment fields.

### No Auth

The app is intentionally local-only. There is no authentication layer. Do not deploy publicly without adding one first.
