# Session Summary

## What We Built

`nyhome` is a separate local PWA/admin app for choosing NYC apartments together. It lives outside MyDay at:

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
- Responsive **card grid** (`body.shortlist`): KPI strip (glass + neon border per tile, neutral fill), fourth tile **top avg score**
- **Sort by** (under `h1`): Workflow, Avg, Peter, Kerv, Last updated — `localStorage` `nyhomeShortlistSort` (`assets/js/app.js`)
- Summary + per-card row = **Avg** / Kerv / Peter %; label **Avg** (not “Combined”) in UI
- Listing cards: glass panel + **`listing-status-<status>`** border/glow from normalized `status`
- Cards omit photo gallery; up to 3 **listing photos** in Admin + `/details` **Images** (paste/drop, `vibeImages.js` → `nyp_apartment_images`)
- `Details` / `Listing` on each card (Listing disabled when no URL)
- `status` art: `/assets/img/<status>.png` on card + filter strip (no text pill on shortlist)
- Optional tagline under page `h1`

Details:

- Route: `/details/?id=<apartmentId>`
- Top **app-summary-card**: status progression `←` / `→` (first 11 `STATUS_NAV` values; excludes `rejected`, `blacklisted`, `archived`), `status` `<select>`, **Reject** (quiet, same row); meta row includes **View listing** when URL set; no inline photo strip. Auto-save on status change. Tabs: **Scorecard** (incl. photo strip when present), **Images** (3 paste/drop slots + **Save photos**, per-criterion score table, preview column; `vibeImages.js`), **Unit Setup** (address/apt changes use blacklist + duplicate validation + `saveApartmentWorkflow` modal), **Peter**, **Kerv** (scoring, one tab per partner; same gallery column as Images), Tour, Application, Activity Log (`assets/js/details.js`). Scoring: `detail-vote-list` table (zebra, bordered, 1px partner top), `detail-vote-line` two-column grid (aligned **N/A** + `0..5`); unselected/selected score hex in `app.css` (`--kerv-hex-faint` / `--kerv-hex-selected`, peter analogs)

Admin:

- Route: `/admin`
- No password yet
- Top nav: `summary-tabs-header` / `Apartment Setup` / `Criteria` / **Building blacklist** (Next actions digest lives on public `/` shortlist)
- **Saved apartments** (below form): `manager-row` layout—per-row `status` `<select>` (PUT, preserves `imageUrls` on save), rent/unit/move-in metrics, **Edit** / **Details** / **Delete**; no inline voting or tour/app blocks (per-listing “progress” lives on `/details`). **Header search** (next to page title) filters the list; **suggestions** under **Apartment manager** (name + `neighborhood · address`); clear on other top tab; **×** in field; **Escape** / blur. Click row (not `select` / links / buttons) → `/details/?id=…`
- **Criteria** tab: add form (label, definition, weight + submit on same row); list rows = click text to edit, blur → `PUT` update; drag handle → `PUT { orderedIds }` (matches order in `/details` scoring tabs); on success, `state.criteria` re-sorted and `renderApartments()`; `POST` create / `DELETE` soft-delete unchanged
- **Building blacklist** tab: add street (manual + paste helper) + notes; list = click street/notes to edit, blur → `PUT /api/building-blacklist`; delete per row. Apartment save warns if normalized building key matches; user can **Save anyway** (`ignoreBlacklist`). Duplicate address+unit blocked unless existing listing is **`rejected`** only.
- Load order: `apartmentStatus.js` → `listingTextParse.js` → `apartmentSavePayload.js` → `saveApartmentWorkflow.js` → `api.js` → `admin.js` for `NyhomeStatus` / `NyhomeListingText` helpers
- Apartment form is organized into:
  - Location
  - Financials
  - The Unit
  - Amenities
  - Listing Notes
  - **Listing photos** (3 `vibe-slot` paste/drop, `vibeImages.js`); submit with main **Save apartment**

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

**Scoring UI:** only on `/details` → **Peter** or **Kerv** tab: table-style list, optional **?** for definition, SVG **N/A** + `0..5` aligned columns; not on admin **Saved apartments** list. **Avg** / Kerv / Peter % on Scorecard, public cards, admin row metrics (`scores.combined` = mean of Kerv & Peter % when both exist; each partner % = `Σ(score×w)/Σw × 20` over **scored** criteria only in `lib/apartmentRepository` `calculateScores`).

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

Runtime code does not contain old MyDay concepts. `PLAN.md` was also cleaned so it no longer mentions MyDay or old seed-app wording.
