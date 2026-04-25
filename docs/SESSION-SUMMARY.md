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
- Summary + per-card row = **Avg** / Kerv / Peter %; label **Avg** (not “Combined”) in UI
- Listing cards: glass panel + **`listing-status-<status>`** border/glow from normalized `status`
- Cards omit photo gallery line; image URLs still in admin
- `Details` / `Listing` on each card (Listing disabled when no URL)
- `status` art: `/assets/img/<status>.png` on card + filter strip (no text pill on shortlist)
- Optional tagline under page `h1`

Details:

- Route: `/details/?id=<apartmentId>`
- Top **app-summary-card**: status progression `←` / `→` (first 11 `STATUS_NAV` values), `status` `<select>`, **Reject** (quiet, same row); meta row includes **View listing** when URL set; no Shortlist/Listing in the title row. Auto-save on status change. Tabs: Scorecard, Unit Setup, **Peter**, **Kerv** (scoring, one tab per partner), Tour, Application, Activity Log (`assets/js/details.js`). Scoring: `detail-vote-list` table (zebra, bordered, 1px partner top), `detail-vote-line` two-column grid (aligned `0..5`); unselected/selected score hex in `app.css` (`--kerv-hex-faint` / `--kerv-hex-selected`, peter analogs)

Admin:

- Route: `/admin`
- No password yet
- Top nav: `summary-tabs-header` / `Apartment Setup` / `Criteria` / `Next Actions`
- **Saved apartments** (below form): `manager-row` layout—per-row `status` `<select>` (PUT, preserves `imageUrls` on save), rent/unit/move-in metrics, **Edit** / **Details** / **Delete**; no inline voting or tour/app blocks (per-listing “progress” lives on `/details`)
- **Criteria** tab: add form (label, definition, weight + submit on same row); list rows = click text to edit, blur → `PUT` update; drag handle → `PUT { orderedIds }` (matches order in `/details` scoring tabs); `POST` create / `DELETE` soft-delete unchanged
- Load order: `apartmentStatus.js` → `api.js` → `admin.js` for `NyhomeStatus` helpers
- Apartment form is organized into:
  - Location
  - Financials
  - The Unit
  - Amenities
  - Listing Notes

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
- Allowed `status` values: same order as `lib/apartmentStatus.js` / `assets/js/apartmentStatus.js` (includes `rejected`, `archived`); server normalizes invalid values to `new`
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

The Notes field parses pasted listing text.

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
- Address
- Apt number
- Rent
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

Each criterion can be scored `0..5`.

**Scoring UI:** only on `/details` → **Peter** or **Kerv** tab: table-style list, optional **?** for definition, SVG `0..5` aligned columns; not on admin **Saved apartments** list. **Avg** / Kerv / Peter % on Scorecard, public cards, admin row metrics (`scores.combined` = mean of Kerv & Peter % when both exist; each partner % = weighted criteria ×20 from `lib/apartmentRepository` `calculateScores`).

The rating API validates:

- `partnerKey` must be `kerv` or `peter`
- `score` must be integer `0..5`

## Database

Tables use the `nyp_` prefix:

- `nyp_apartments`
- `nyp_apartment_images`
- `nyp_criteria`
- `nyp_neighborhoods`
- `nyp_ratings`
- `nyp_visits`
- `nyp_applications`

Migration:

```bash
npm run migrate
```

The migration also seeds:

- 17 apartment criteria with definitions
- Initial NYC neighborhoods

## API

Netlify Functions:

- `GET/POST/PUT/DELETE /api/apartments` — `status` in body normalized via `lib/apartmentStatus.js` on POST/PUT
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
- `CHANGELOG.md` (summary/details/admin UI, `apartmentStatus`, save/error behavior)
- `docs/SESSION-SUMMARY.md` (this file)
- `docs/IMPORT-SCRAPING.md`
- `PLAN.md`

## Verification Done

- Installed dependencies
- Ran migrations
- Verified local Netlify Dev server
- Verified `/api/apartments`
- Smoke-tested apartment save/delete
- Smoke-tested rating validation
- Ran JS syntax checks
- Read lints on changed files

## Known Caveat

There is intentionally no auth because this is local-only for now. Before public deploy, add an auth gate for:

- `/admin`
- all mutating API routes

## Cleanup Completed

Runtime code does not contain old MyDay concepts. `PLAN.md` was also cleaned so it no longer mentions MyDay or old seed-app wording.
