# nyhome

Private local PWA for choosing a NYC apartment together.

## Local setup

```bash
npm install
npm run migrate
npm run dev
```

`npm run migrate` applies schema + seeds and creates **`nyp_listing_events`** (Activity Log) and **`nyp_building_blacklist`**. Skipping migrate: log omits events until `nyp_listing_events` exists; blacklist checks fail until `nyp_building_blacklist` exists.

The app is static HTML/CSS/JS with Netlify Functions and PlanetScale. It uses its own `nyp_` database tables and `nyhome-*` browser keys. PWA: `manifest.json` + service worker; favicon is `assets/img/favicon1.png`. On `localhost` the shortlist page unregisters service workers so local dev is not stuck behind cached shell assets.

Required local environment:

```bash
DATABASE_URL=https://username:password@host/dbname
APP_NAME=nyhome
```

There is intentionally no auth while this is local-only. Add a password gate before public deployment.

## What It Does

- Public shortlist at `/`: **View** **Cards** | **Finalist** | **Next actions** (`nyhomeShortlistView`). Row under the title: **View** (left) + **Sort by** (Cards only) + **New listing** → `/admin/new` and **Manage** → `/admin` (plain links, `|`, right). **Status filter:** **Filters** FAB → glass **drawer** (grouped statuses, `statusFilterGroups.js`). **Cards:** grid, **KPI** strip, **Sort** (`nyhomeShortlistSort`), **Avg** / Kerv / Peter, up to **3** thumbs under scores; hover → fixed preview. **Finalist** / **Next actions** as in app. Card glow: `listing-status-*`. Shell cache: bump `sw.js` + HTML `?v=` together. Photos: `/admin/new` or **`/details` → Images** (up to 3).
- Details at `/details/?id=…`: Hunter-style summary + tabs: **Scorecard**, **Images**, **Unit Setup**, **Peter** / **Kerv**, Tour, Application, **Activity Log** (includes `nyp_listing_events` after migrate). **Header:** **New listing** + **Back to shortlist**. Scoring: **N/A** + `0..5`, criterion **?** toggles definition.
- **Manager** `/admin`: tabs **Saved apartments** | **Building blacklist** | **Criteria**. **Header** search filters the list on **Saved apartments**; cleared when switching to **Building blacklist** or **Criteria**. **New listing** in header → `/admin/new`. **Edit** on a row (when not using in-page form) → `/admin/new?id=…`. **Criteria** / **blacklist** same as before (click-edit, etc.). **Saved apartments:** `manager-row`; row click (not controls) → `/details`.
- **New listing** `/admin/new`: full apartment form (Location … **Listing photos**) + same **Saved apartments** list; same header search; **View cards** / **Manager**.
- Manual entry lives at `/admin/new` (sections above); **`?id=`** opens that listing for edit.
- Apartment title is automatic: `Address #Apt`, e.g. `260 Gold Street #1117`.

## Listing status

Allow-list (also `ORDER BY` in DB): `new` through `signed`, then `rejected`, `blacklisted`, `archived`. API and `saveApartment` coerce unknown `status` to `new`. Keep `assets/js/apartmentStatus.js` in sync with `lib/apartmentStatus.js`.

```text
new -> evaluating -> shortlisted -> tour_scheduled -> toured -> finalist -> applying -> applied -> approved -> lease_review -> signed; terminal: rejected, blacklisted, archived
```

- **Blacklist / duplicates:** saving an apartment (`/admin/new` form or `/details` Unit Setup) warns if the **building** is on the blacklist (modal: cancel or **Save anyway**). Duplicate **address + unit** (normalized) returns an error unless the only existing row is **`rejected`**. Setting status **`blacklisted`** upserts the building into the blacklist table.
- **`/admin/new` form:** full status `<select>` + **Reject** (no Prev/Next on the form; use `/details` for arrows).
- **Admin saved list:** one row per listing; **status** dropdown saves the apartment on change.
- **`/details`:** status `<select>` + arrow buttons move within the first 11 steps (stops before `rejected`, `blacklisted`, `archived`); **Reject** next to the progression; listing link in the **meta** row (not in the title row). Status edits auto-save and refresh the **current** details tab (Unit Setup submit still returns to the Unit tab).

Palette: CSS classes `status-*` in [assets/css/app.css](assets/css/app.css) (background/text colors per state).

## Apartment Form

Location:

- Neighborhood type-ahead. Typing a new neighborhood saves it after apartment save.
- Address is required.
- Apt number is optional.
- Listing URL is optional.

Financials:

- Rent
- Net effective
- Broker fee
- Deposit
- Amenities fees
- Total move-in amount

The Unit:

- Bedrooms defaults to `1`.
- Bathrooms defaults to `1`.
- Sq ft optional.
- Feature chips: Dishwasher, W/D, Storage, Views.

Amenities:

- Doorman, Highrise, New construction, Walkup, Pool, Sauna, Laundry room, Suites.

## Paste Helper

Paste listing text into Notes. The helper fills known fields and rewrites notes into organized lines.

Supported examples include StreetEasy-style text and Google Maps one-line addresses (`123 Street, Neighborhood, NY 10001, …`). Also: top line `#39M` then address block; line `250 Example St #4B`; gross rent line near `For Rent`.

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

Maps to:

- Neighborhood
- Address and apt number
- Rent
- Net effective
- Amenities fees, for small standalone fee lines like `$150`
- Bedrooms and bathrooms
- Sq ft, when present
- New construction amenity, when `New Development` appears

Unmapped lines are preserved under `Other:` in Notes.

## Scoring

- Criteria live in `nyp_criteria`.
- Ratings live in `nyp_ratings` (`score` nullable: **N/A** = `NULL`).
- Voters: `kerv`, `peter`.
- **0..5** or **N/A** per line. Averages use only rows with a numeric score (skips N/A and unset).
- **Where to vote:** `/details` → **Peter** or **Kerv** (one partner per tab). Criterion **table** (flushed rows, **N/A** + aligned `0..5`); **?** opens the definition. Unselected: pale hex + dim label; selected: **dark** fill + **white** text. Shortlist and **Saved apartments** table are summary-only; full voting is on **Details**.
- Scorecard tab shows **Avg** / Kerv / Peter % (`Avg` = mean of the two partners when both exist; each partner % from `calculateScores` over scored criteria only); public `/` cards show the same three in one row.

## Local-Only Security

Mutating routes are intentionally open for local use. Before deploying publicly, add auth for:

- `/admin` and `/admin/new`
- `POST/PUT/DELETE /api/apartments`
- `POST/PUT/DELETE /api/building-blacklist`
- `POST/PUT/DELETE /api/criteria` (`PUT`: update fields or `{ orderedIds }` reorder)
- `POST /api/ratings`
- `POST /api/visits`
- `POST /api/applications`
