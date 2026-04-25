# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start local dev server at http://localhost:8889 (requires Netlify CLI)
npm run migrate    # Schema + seeds: criteria, neighborhoods; alters (e.g. nullable `nyp_ratings.score`, legacy 0→NULL)
npm run split-badges  # Split status badge sprite sheet into individual PNGs
```

Environment: copy `.env.example` to `.env.local` and set `DATABASE_URL` (PlanetScale HTTP connection string) and `APP_NAME=nyhome`.

## Architecture

**nyhome** is a private PWA for two partners (Kerv and Peter) to score and track NYC apartment listings. No build step — vanilla JS served directly by Netlify CLI in dev, with Netlify Functions as the API layer and PlanetScale MySQL for persistence.

### Routing (netlify.toml)

- `/` → `index.html` — Public shortlist (card grid; status filter; optional **Sort by**: Workflow, Avg, Kerv, Peter, Last updated — persisted in `localStorage`)
- `/admin` → `admin/index.html` — Management dashboard (add/edit apartments, criteria config, next actions)
- `/details/?id=…` → `details/index.html` — Full apartment view (scorecard, tour, application tracking)
- `/api/*` → `/.netlify/functions/:splat`

### Frontend (`assets/js/`)

- **`api.js`** — Fetch wrapper; all API client methods live here
- **`app.js`** — Shortlist render + filter; **sort** segment (`nyhomeShortlistSort` in `localStorage`)
- **`admin.js`** — Admin forms, criteria list (click-edit, drag reorder), **header search** (filters **Saved apartments**; suggestions under title; cleared when leaving **Apartment Setup** for another top tab), manager rows (row click → `/details` except interactive controls)
- **`details.js`** — Details page tabs, status transitions, per-partner scoring UI
- **`vibeImages.js`** — Client-side image resize + JPEG compress for listing photos (used by `admin.js` and `details.js` Images tab)
- **`apartmentStatus.js`** — Shared status enum and CSS class mapping (used by both client and `lib/`)

Data is fetched on load, cached to `localStorage`, and re-fetched after mutations. UI re-renders optimistically on success; failures show toast feedback.

### Backend (`netlify/functions/`, `lib/`)

- **`lib/db.js`** — PlanetScale connection pool with `execute()` and `insert()` helpers
- **`lib/apartmentRepository.js`** — High-level CRUD for apartments (title generation, complex saves with related tables)
- **`lib/http.js`** — Response helpers (`json()`, body parsing, money conversion cents↔dollars)
- **`netlify/functions/apartments.js`** — GET list, POST create, PUT update, DELETE
- **`netlify/functions/criteria.js`** — POST new, PUT update fields or reorder via `orderedIds`
- **`netlify/functions/ratings.js`** — `POST` partner vote: `score` key required; integer `0–5` or `null` (N/A)
- **`netlify/functions/visits.js`** / **`applications.js`** — Tour and broker tracking

### Database

All tables prefixed `nyp_`. Money stored as integer cents. Key tables: `nyp_apartments`, `nyp_criteria`, `nyp_ratings` (one row per apartment × partner × criterion, unique; `score` nullable — `NULL` = N/A), `nyp_visits`, `nyp_applications`, `nyp_neighborhoods` (autocomplete seed data).

### Status Progression

```
new → evaluating → shortlisted → tour_scheduled → toured → finalist →
applying → applied → approved → lease_review → signed
(terminal: rejected, archived)
```

Each status has a corresponding PNG badge in `assets/img/` and a neon-border CSS class (`listing-status-*`). Favicon: `/assets/img/favicon1.png` in each page’s `<head>` and in `manifest.json` for PWA install icons. Service worker (`sw.js`) caches shell assets (HTML, CSS, JS, `manifest.json`, status badge images, favicon); cache-bust by bumping `?v=` query params in HTML and the version string in `sw.js` in lockstep. Local dev: `index.html` unregisters all service workers when `location.hostname` is `localhost`, `127.0.0.1`, or `::1`, so `npm run dev` is not held back by a stale worker.

### Listing photos (vibe)

Up to **3** images per apartment in `nyp_apartment_images` (`image_url` is text: `https://` or, after paste/drop, `data:image/jpeg;base64,...` from `vibeImages.js`). **Admin** (Apartment Setup) and **`/details` Images tab** use three click/paste/drop slots; **Save photos** on details sends a full apartment `PUT` with `imageUrls[]`. Thumbnail previews on Scorecard, Images, and partner tabs (not on the top summary card).

### Scoring

Each partner can vote **0–5** or **N/A** on each active criterion. **N/A** is stored as `NULL` and is **omitted** from that partner’s weighted average (only criteria with a numeric score contribute weight). Criteria have weights. Per-partner % = `(Σ score×weight / Σ included weights) × 20` (0–100 scale). **Avg** = mean of Kerv and Peter when both are non-null. The paste helper in the admin form parses raw StreetEasy listing text to auto-fill apartment fields. Run `npm run migrate` to apply `score` nullable + convert legacy `0` → `NULL` (one-time per DB).

### No Auth

The app is intentionally local-only. There is no authentication layer. Do not deploy publicly without adding one first.
