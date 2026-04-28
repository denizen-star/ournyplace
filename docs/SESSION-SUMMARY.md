# Session Summary

## What We Built

`nyhome` is a local PWA/admin app for scoring and tracking NYC apartment listings together (`README`, `CLAUDE.md`).

```text
/Users/kervinleacock/Documents/Development/nyhome
```

It uses:

- Vanilla HTML/CSS/JS
- Netlify Functions locally through `netlify dev`
- PlanetScale through `DATABASE_URL`
- `nyp_` database tables
- No auth for now, local-only

## Core App

Public app:

- Route: `/`
- Responsive **card grid** (`body.shortlist`): **five pipeline KPI** tiles aligned with **`NyhomeStatusFilterGroups`** (counts per stage: Discovery & shortlist … Closed); glass + neon border per tile, neutral fill
- **Sort by** (hero row, Cards only; right of **View**): Workflow, Avg, Peter, Kerv, Last updated, **Star** — `localStorage` `nyhomeShortlistSort` (`assets/js/app.js`); **`listing_star`** on Cards via `listingStar.js` (click-to-cycle tiers; **`displayHtmlIfStarred`** read-only elsewhere when starred); **New listing | Manage** same row (right)
- Summary + per-card row = **Avg** / Kerv / Peter %; label **Avg** (not “Combined”) in UI
- Listing cards: glass panel + **`listing-status-<status>`** border/glow from normalized `status`
- Cards omit full gallery; up to 3 **listing photos** via `/admin/new` or `/details` **Images** (`vibeImages.js` → `nyp_apartment_images`)
- `Details` / `Listing` on each card (Listing disabled when no URL)
- `status` art: `/assets/img/<status>.png` on cards. Status **filter** = bottom **Filters** drawer + FAB (not a header strip; no text pill on cards)
- **View** (Cards / **Finalist** / Next actions) in hero row under `h1` (no marketing tagline). **Finalist** = table (Avg→workflow); **URL** = external `listing_url` before **Avg**; `≤720px` **Listing** in row expand. **Next actions:** tour and/or deadline and/or move-in; **List** / **Calendar**; **Only include with** tour/deadline/move-in; calendar **Summary** / **Details** / **Prospect**; print TOC + density rules; financial line + empty pen box per field on Details/Prospect (`nyhomeNextActions*` + `nyhomeNextActionsCalendarDensity` in `app.js`)

Details:

- Route: `/details/?id=<apartmentId>`
- **Header:** **New listing** (→ `/admin/new`) and **Back to shortlist** (`.app-header-actions`, plain text + `|`)
- Top **app-summary-card**: status progression `←` / `→` (first 11 `STATUS_NAV` values; excludes `rejected`, `blacklisted`, `archived`), `status` `<select>`, **Reject** (quiet, same row); meta row includes **View listing** when URL set; no inline photo strip. Auto-save on status change. Tabs: **Scorecard** (incl. photo strip when present), **Images** (3 paste/drop slots + **Save photos**, per-criterion score table w/ `data-criterion-id` rows, preview column; `vibeImages.js`), **Unit Setup** (listing fields aligned with `/admin/new`: financials, unit size, chips, notes; save uses blacklist + duplicate checks + `saveApartmentWorkflow` modal; **Save Unit Setup** CTA), **Peter**, **Kerv** (scoring, one tab per partner; same gallery column as Images), Tour, Application, Activity Log (`assets/js/details.js`). Scoring: `detail-vote-list` table (zebra, bordered, 1px partner top), `detail-vote-line` two-column grid (aligned **N/A** + `0..5`); unselected/selected score hex in `app.css` (`--kerv-hex-faint` / `--kerv-hex-selected`, peter analogs). **Vote save:** optimistic hex, then `saveRating` + `finalizeRatingSave` (merge ratings, `calculateDetailScores`, patch meta score strip + table cell, `localStorage`); no full `load()` for votes (Activity vote lines = refresh to see).

Admin:

- Routes: **`/admin`** (manager) and **`/admin/new`** (new listing + form). No password yet.
- **`/admin`:** Top tabs **Saved apartments** | **Building blacklist** | **Criteria** (Next actions = public `/` only). **Saved apartments:** `manager-row` (status, metrics, **Delete** only; no row **Edit** / **Details** links). **Header search** (same on **`/admin/new`**) filters `#admin-apartment-list`, suggestions, **×**; on **`/admin`**, clear when leaving **Saved apartments** for another top tab. Row click (not controls) → `/details/?id=…`. Full form: **`/admin/new`** + **`?id=`**
- **`/admin/new`:** Full apartment form + saved list; **Save apartment**; Notes + 3 `vibe-slot` photos (`vibeImages.js`); `?id=` pre-fill. Header: **View cards** / **Manager**
- **Criteria** / **blacklist** tabs: add/edit/reorder/ paste flows unchanged vs repo `README`
- **Shell load** on admin pages: `apartmentStatus.js` → `listingTextParse.js` → **`listingStar.js`** → `apartmentSavePayload.js` → `saveApartmentWorkflow.js` → `api.js` → `vibeImages.js` → `admin.js`

## Apartment Form Behavior

Apartment title is automatic:

```text
Address #Apt number
```

Example:

```text
260 Gold Street #1117
```

Location fields:

- Neighborhood type-ahead
- Address required
- Apt number optional
- Move-in date
- **Status** on form: full `<select>` of allowed values + **Reject** (no Prev/Next on the form; those are on `/details` only for stepping the first 11 states)
- Allowed `status` values: same order as `lib/apartmentStatus.js` / `assets/js/apartmentStatus.js` (includes `rejected`, `blacklisted`, `archived`); `STATUS_NAV` excludes terminal states for Prev/Next; server normalizes invalid values to `new`. **`blacklisted`** upserts `nyp_building_blacklist`.
- Listing URL

Financial fields, all optional:

- Rent
- Net effective
- Broker fee
- Deposit
- Amenities fees
- Total move-in amount

Unit fields:

- Bedrooms defaults to `1`
- Bathrooms defaults to `1`
- Sq ft optional
- Unit feature chips:
  - Dishwasher
  - W/D
  - Storage
  - Views

Amenities:

- Doorman
- Highrise
- New construction
- Walkup
- Pool
- Sauna
- Laundry room
- Suites

## Paste Helper

The Notes field parses pasted listing text (clipboard inserted into the field first, then parse — avoids paste race). **Building blacklist** paste uses the same parser for address/neighborhood.

It supports StreetEasy-style blocks like:

```text
New Development
Rental unit in Downtown Brooklyn
260 Gold Street #1117
$4,025
base rent
$150
$3,438 net effective base rent
1.75 months free·12-month lease
1 bed
1 bath
- ft²
Listing by Dalan Rentals
```

It extracts:

- Neighborhood
- Address (incl. Google Maps comma lines, `street #unit` one-liners, unit-first `#` line + following address)
- Apt number
- Rent (incl. gross / For Rent style when matched)
- Net effective
- Amenities fees
- Bedrooms
- Bathrooms
- Sq ft when present
- New construction amenity
- Plain `https://...` listing URLs

Unmapped text is preserved under `Other:` in Notes.

## Scoring

Scoring is partner-based:

- `kerv`
- `peter`

Each criterion: integer `0..5` or **N/A** (stored as `NULL`; **not** in weighted sum—only lines with a numeric score use weight). Missing row and `NULL` behave the same for averages (skipped).

**Scoring UI:** only on `/details` → **Peter** or **Kerv** tab: table-style list, optional **?** for definition, SVG **N/A** + `0..5` aligned columns; not on admin **Saved apartments** list. **Avg** / Kerv / Peter % on Scorecard, public cards, admin row metrics (`scores.combined` = mean of Kerv & Peter % when both exist; each partner % = `Σ(score×w)/Σw × 20` over **scored** criteria only in `lib/apartmentRepository` `calculateScores`). After a vote, `details.js` recomputes the same rollup client-side and patches the summary + Images table without refetching the full apartment list.

The rating API (`POST /api/ratings`):

- `apartmentId`, `criterionId`, `partnerKey` (`kerv` / `peter`) required; **`score` key required**
- `score`: `null` = N/A, else integer `0..5`

## Database

Tables use the `nyp_` prefix:

- `nyp_apartments`
- `nyp_apartment_images`
- `nyp_criteria`
- `nyp_neighborhoods`
- `nyp_ratings` (`score` nullable: N/A = `NULL`)
- `nyp_visits`
- `nyp_applications`
- `nyp_building_blacklist` (unique `normalized_key`; building-level warn on apartment save)

Migration:

```bash
npm run migrate
```

The migration also seeds:

- 17 apartment criteria with definitions
- Initial NYC neighborhoods

## API

Netlify Functions:

- `GET/POST/PUT/DELETE /api/apartments` — `status` in body normalized via `lib/apartmentStatus.js` on POST/PUT; `409` + `code` `BLACKLISTED` / `DUPLICATE_LISTING`; optional `ignoreBlacklist` on retry
- `GET/POST/PUT/DELETE /api/building-blacklist` — CRUD for blacklisted buildings (`display_address`, `notes`, normalized key server-side)
- `POST/PUT/DELETE /api/criteria` — `PUT`: `{ id, label, definition, weight }` or `{ orderedIds: number[] }` for reorder
- `POST /api/ratings`
- `POST /api/visits`
- `POST /api/applications`

All DB queries use parameterized PlanetScale calls through `lib/db.js`.

## Local Setup

```bash
npm install
npm run migrate
npm run dev
```

Local server:

```text
http://localhost:8889
```

Required `.env.local`:

```text
DATABASE_URL=...
APP_NAME=nyhome
```

`.env.local` is ignored by git.

## Docs Updated

- `README.md` (shortlist + details + admin + scoring location)
- `CHANGELOG.md` (summary/details/admin UI, `apartmentStatus`, save/error behavior, N/A ratings, building blacklist + paste parser)
- `CLAUDE.md` (scoring, ratings API, `nyp_ratings` nullable, blacklist API + `listingTextParse`, `saveApartmentWorkflow`)
- `docs/SESSION-SUMMARY.md` (this file)
- `docs/IMPORT-SCRAPING.md` (paste patterns)
- `PLAN.md`

## Verification Done

- Installed dependencies
- Ran migrations
- Verified local Netlify Dev server
- Verified `/api/apartments`
- Smoke-tested apartment save/delete
- Smoke-tested rating validation (incl. `null` for N/A)
- Ran JS syntax checks
- Read lints on changed files

## Known Caveat

There is intentionally no auth because this is local-only for now. Before public deploy, add an auth gate for:

- `/admin`
- all mutating API routes

## Cleanup Completed

Runtime code targets this repository only. Older cross-app references have been removed from project docs where applicable.
