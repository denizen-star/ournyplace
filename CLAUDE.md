# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start local dev server at http://localhost:8889 (requires Netlify CLI)
npm run migrate    # Schema + seeds: criteria, neighborhoods; alters; `nyp_listing_events`; `nyp_building_blacklist`
npm run split-badges  # Split status badge sprite sheet into individual PNGs
```

Environment: copy `.env.example` to `.env.local` and set `DATABASE_URL` (PlanetScale HTTP connection string) and `APP_NAME=nyhome`.

## Architecture

**nyhome** is a private PWA for two partners (Kerv and Peter) to score and track NYC apartment listings. No build step — vanilla JS served directly by Netlify CLI in dev, with Netlify Functions as the API layer and PlanetScale MySQL for persistence.

### Routing (netlify.toml)

- `/` → `index.html` — Public shortlist: **View** Cards | **Finalist** | **Next actions** (`nyhomeShortlistView`); **Sort by** when Cards only (Workflow, Avg, Peter, Kerv, Last updated — `nyhomeShortlistSort`). **Status filter** in glass **drawer** (`#filters-drawer` + bottom FAB, `statusFilterGroups.js`); not inline in header. Row under the title: grid **View** (left) + **Sort** + **New listing** | **Manage** (right, `.shortlist-tagline-row` / `.shortlist-hero-right` / `.app-header-actions--in-hero`, plain links, `|`). No tagline sentence. Card grid with optional listing **thumbs** (row under Avg/Kerv/Peter) + **Finalist** table (thumbs after address, columns incl. move-in) + **Next actions** (tour and/or app deadline: one-line row, status pill, **?** = `criterion-def-btn` + definition-style panel for prep text, **Next** / **Reject**, link to `/details`). Hover thumb → fixed **300px** flyout (`#nyhome-finalist-flyout`, no layout reflow)
- `/admin` → `admin/index.html` — **Saved apartments** (list + **header** search) | **Building blacklist** | **Criteria** (normalized building keys; click-to-edit rows like criteria)
- `/admin/new` → `admin/new/index.html` — New listing form (apartment setup + same **Saved apartments** list + **header** search as `/admin`); `?id=` pre-fills for edit
- `/details/?id=…` → `details/index.html` — Full apartment view (scorecard, tour, application tracking)
- `/api/*` → `/.netlify/functions/:splat`

### Frontend (`assets/js/`)

- **`api.js`** — Fetch wrapper; apartment/criteria/ratings + **`GET/POST/PUT/DELETE /api/building-blacklist`**; `saveApartment` errors may include HTTP status + `code` (`BLACKLISTED`, `DUPLICATE_LISTING`)
- **`app.js`** — Shortlist: filter, **view** (Cards / Finalist / Next actions), **sort** (Cards only), `renderApartmentCard`, `renderFinalistList` (Avg→workflow sort), `renderNextActionsList`, `listingThumbsMarkup` + `wireListingThumbHovers` (`.nyhome-listing-thumb-wrap`); fixed-position image preview
- **`apartmentSavePayload.js`** — `NyhomeApartmentPayload.apartmentToSavePayload(apartment, overrides?)` for consistent `PUT`/`POST` apartment bodies (admin manager status, shortlist Next actions)
- **`listingTextParse.js`** — `NyhomeListingText.parseListingText` (StreetEasy, Google Maps comma lines, unit-first `#39M` lines); loaded before **`admin.js`** / used by Notes + blacklist paste
- **`saveApartmentWorkflow.js`** — Shared modal + retry for blacklist / duplicate conflicts (`ignoreBlacklist` on second attempt)
- **`admin.js`** — `/admin` + `/admin/new`: list + criteria + blacklist; **apartment form** and vibe slots only on `/admin/new`. **Header search** (both pages, same DOM ids) filters `#admin-apartment-list`; on **`/admin` only**, cleared when leaving the **Saved apartments** top tab. **Edit** on `/admin` (no form) → `/admin/new?id=…`. Manager rows: row click → `/details` except controls; Notes paste (`/admin/new`) uses clipboard insert then parse
- **`details.js`** — Details page tabs, status transitions, **Unit Setup** address/apt saves use same blacklist + duplicate checks as admin; per-partner scoring UI; **Activity Log** merges `listing_events` with tour/application milestones
- **`vibeImages.js`** — Client-side image resize + JPEG compress for listing photos (used by `admin.js` and `details.js` Images tab)
- **`apartmentStatus.js`** — Shared status enum and CSS class mapping (used by both client and `lib/`)
- **`statusFilterGroups.js`** — `NyhomeStatusFilterGroups.GROUPS`: shortlist filter drawer **sections** (Discovery & shortlist, Tours, Finalist, Application & lease, Closed). Must list every `STATUS_ORDER` value exactly once; `assertComplete(STATUS_ORDER)` checks at boot

Data is fetched on load, cached to `localStorage`, and re-fetched after mutations. UI re-renders after successful saves; failures log to the console; **admin** apartment form save also shows a **browser alert** on error.

### Backend (`netlify/functions/`, `lib/`)

- **`lib/db.js`** — PlanetScale connection pool with `execute()` and `insert()` helpers
- **`lib/addressNormalize.js`** — Normalize street + borough tokens → `normalized_key` for blacklist + duplicate detection
- **`lib/buildingBlacklistRepository.js`** — CRUD for `nyp_building_blacklist`
- **`lib/listingTextParse.js`** — Server-side mirror of paste rules (tests / parity with client)
- **`lib/apartmentRepository.js`** — High-level CRUD (title generation, saves); before create/update: **blacklisted building** (unless `ignoreBlacklist`) and **duplicate** same normalized address+unit (allowed only if existing row is **`rejected`**); **`status === blacklisted`** upserts blacklist
- **`lib/http.js`** — Response helpers (`json()`, body parsing, money conversion cents↔dollars)
- **`netlify/functions/apartments.js`** — GET list, POST create, PUT update, DELETE; **`409`** + JSON `code` for blacklist / duplicate
- **`netlify/functions/building-blacklist.js`** — Blacklist CRUD
- **`netlify/functions/criteria.js`** — POST new, PUT update fields or reorder via `orderedIds`
- **`netlify/functions/ratings.js`** — `POST` partner vote: `score` key required; integer `0–5` or `null` (N/A)
- **`netlify/functions/visits.js`** / **`applications.js`** — Tour and broker tracking

### Database

All tables prefixed `nyp_`. Money stored as integer cents. Key tables: `nyp_apartments`, `nyp_criteria`, `nyp_ratings` (one row per apartment × partner × criterion, unique; `score` nullable — `NULL` = N/A), `nyp_visits`, `nyp_applications`, `nyp_neighborhoods` (autocomplete seed data), `nyp_listing_events` (append-only status and vote events; last 50 per apartment on `GET /api/apartments`), **`nyp_building_blacklist`** (unique `normalized_key`; warn-on-save at building level).

### Status Progression

```
new → evaluating → shortlisted → tour_scheduled → toured → finalist →
applying → applied → approved → lease_review → signed
(Prev/Next nav stops before: rejected, blacklisted, archived)
```

Each status has a corresponding PNG badge in `assets/img/` (incl. **`blacklisted.png`**) and a neon-border CSS class (`listing-status-*`). Favicon: `/assets/img/favicon1.png` in each page’s `<head>` and in `manifest.json` for PWA install icons. Service worker (`sw.js`) caches shell assets (HTML, CSS, JS, `manifest.json`, status badge images, favicon); **`CACHE_VERSION`** in `sw.js` must match `?v=` on cached assets in HTML (shortlist, admin, details often bumped together). Local dev: `index.html` unregisters all service workers when `location.hostname` is `localhost`, `127.0.0.1`, or `::1`, so `npm run dev` is not held back by a stale worker.

### Listing photos (vibe)

Up to **3** images per apartment in `nyp_apartment_images` (`image_url` is text: `https://` or, after paste/drop, `data:image/jpeg;base64,...` from `vibeImages.js`). **`/admin/new`** and **`/details` Images tab** use three click/paste/drop slots; **Save photos** on details sends a full apartment `PUT` with `imageUrls[]`. Thumbnail previews: **shortlist** Cards (under scores) and **Finalist** table + hover flyout; **Scorecard** / Images / partner tabs on `/details` (not on the details top summary card alone).

### Scoring

Each partner can vote **0–5** or **N/A** on each active criterion. **N/A** is stored as `NULL` and is **omitted** from that partner’s weighted average (only criteria with a numeric score contribute weight). Criteria have weights. Per-partner % = `(Σ score×weight / Σ included weights) × 20` (0–100 scale). **Avg** = mean of Kerv and Peter when both are non-null. **Paste helper** (`listingTextParse.js`): StreetEasy-style blocks, Google Maps comma address lines, unit-first `#` lines, gross rent + “For Rent” patterns; admin **Notes** and **Building blacklist** paste. Run `npm run migrate` to apply `score` nullable + convert legacy `0` → `NULL` (one-time per DB).

### No Auth

The app is intentionally local-only. There is no authentication layer. Do not deploy publicly without adding one first.
