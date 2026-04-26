# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start local dev server at http://localhost:8889 (requires Netlify CLI)
npm run migrate    # Schema + seeds: criteria, neighborhoods; alters; `nyp_listing_events` (status + vote audit)
npm run split-badges  # Split status badge sprite sheet into individual PNGs
```

Environment: copy `.env.example` to `.env.local` and set `DATABASE_URL` (PlanetScale HTTP connection string) and `APP_NAME=nyhome`.

## Architecture

**nyhome** is a private PWA for two partners (Kerv and Peter) to score and track NYC apartment listings. No build step — vanilla JS served directly by Netlify CLI in dev, with Netlify Functions as the API layer and PlanetScale MySQL for persistence.

### Routing (netlify.toml)

- `/` → `index.html` — Public shortlist: **View** Cards | **Finalist** | **Next actions** (`nyhomeShortlistView`); **Sort by** when Cards only (Workflow, Avg, Peter, Kerv, Last updated — `nyhomeShortlistSort`). Status filter; card grid with optional listing **thumbs** (row under Avg/Kerv/Peter) + **Finalist** table (thumbs after address, columns incl. move-in) + **Next actions** (tour and/or app deadline: one-line row, status pill, **?** = `criterion-def-btn` + definition-style panel for prep text, **Next** / **Reject**, link to `/details`). Hover thumb → fixed **300px** flyout (`#nyhome-finalist-flyout`, no layout reflow)
- `/admin` → `admin/index.html` — Management dashboard (add/edit apartments, criteria config)
- `/details/?id=…` → `details/index.html` — Full apartment view (scorecard, tour, application tracking)
- `/api/*` → `/.netlify/functions/:splat`

### Frontend (`assets/js/`)

- **`api.js`** — Fetch wrapper; all API client methods live here
- **`app.js`** — Shortlist: filter, **view** (Cards / Finalist / Next actions), **sort** (Cards only), `renderApartmentCard`, `renderFinalistList` (Avg→workflow sort), `renderNextActionsList`, `listingThumbsMarkup` + `wireListingThumbHovers` (`.nyhome-listing-thumb-wrap`); fixed-position image preview
- **`apartmentSavePayload.js`** — `NyhomeApartmentPayload.apartmentToSavePayload(apartment, overrides?)` for consistent `PUT`/`POST` apartment bodies (admin manager status, shortlist Next actions)
- **`admin.js`** — Admin forms, criteria list (click-edit, drag reorder), **header search** (filters **Saved apartments**; suggestions under title; cleared when leaving **Apartment Setup** for **Criteria**), manager rows (row click → `/details` except interactive controls)
- **`details.js`** — Details page tabs, status transitions, per-partner scoring UI; **Activity Log** merges `listing_events` (status changes + votes from `nyp_listing_events`) with tour/application milestones
- **`vibeImages.js`** — Client-side image resize + JPEG compress for listing photos (used by `admin.js` and `details.js` Images tab)
- **`apartmentStatus.js`** — Shared status enum and CSS class mapping (used by both client and `lib/`)

Data is fetched on load, cached to `localStorage`, and re-fetched after mutations. UI re-renders after successful saves; failures log to the console; **admin** apartment form save also shows a **browser alert** on error.

### Backend (`netlify/functions/`, `lib/`)

- **`lib/db.js`** — PlanetScale connection pool with `execute()` and `insert()` helpers
- **`lib/apartmentRepository.js`** — High-level CRUD for apartments (title generation, complex saves with related tables)
- **`lib/http.js`** — Response helpers (`json()`, body parsing, money conversion cents↔dollars)
- **`netlify/functions/apartments.js`** — GET list, POST create, PUT update, DELETE
- **`netlify/functions/criteria.js`** — POST new, PUT update fields or reorder via `orderedIds`
- **`netlify/functions/ratings.js`** — `POST` partner vote: `score` key required; integer `0–5` or `null` (N/A)
- **`netlify/functions/visits.js`** / **`applications.js`** — Tour and broker tracking

### Database

All tables prefixed `nyp_`. Money stored as integer cents. Key tables: `nyp_apartments`, `nyp_criteria`, `nyp_ratings` (one row per apartment × partner × criterion, unique; `score` nullable — `NULL` = N/A), `nyp_visits`, `nyp_applications`, `nyp_neighborhoods` (autocomplete seed data), `nyp_listing_events` (append-only status and vote events; last 50 per apartment on `GET /api/apartments`).

### Status Progression

```
new → evaluating → shortlisted → tour_scheduled → toured → finalist →
applying → applied → approved → lease_review → signed
(terminal: rejected, archived)
```

Each status has a corresponding PNG badge in `assets/img/` and a neon-border CSS class (`listing-status-*`). Favicon: `/assets/img/favicon1.png` in each page’s `<head>` and in `manifest.json` for PWA install icons. Service worker (`sw.js`) caches shell assets (HTML, CSS, JS, `manifest.json`, status badge images, favicon); cache-bust by bumping `?v=` query params in HTML and the version string in `sw.js` in lockstep. Local dev: `index.html` unregisters all service workers when `location.hostname` is `localhost`, `127.0.0.1`, or `::1`, so `npm run dev` is not held back by a stale worker.

### Listing photos (vibe)

Up to **3** images per apartment in `nyp_apartment_images` (`image_url` is text: `https://` or, after paste/drop, `data:image/jpeg;base64,...` from `vibeImages.js`). **Admin** (Apartment Setup) and **`/details` Images tab** use three click/paste/drop slots; **Save photos** on details sends a full apartment `PUT` with `imageUrls[]`. Thumbnail previews: **shortlist** Cards (under scores) and **Finalist** table + hover flyout; **Scorecard** / Images / partner tabs on `/details` (not on the details top summary card alone).

### Scoring

Each partner can vote **0–5** or **N/A** on each active criterion. **N/A** is stored as `NULL` and is **omitted** from that partner’s weighted average (only criteria with a numeric score contribute weight). Criteria have weights. Per-partner % = `(Σ score×weight / Σ included weights) × 20` (0–100 scale). **Avg** = mean of Kerv and Peter when both are non-null. The paste helper in the admin form parses raw StreetEasy listing text to auto-fill apartment fields. Run `npm run migrate` to apply `score` nullable + convert legacy `0` → `NULL` (one-time per DB).

### No Auth

The app is intentionally local-only. There is no authentication layer. Do not deploy publicly without adding one first.
