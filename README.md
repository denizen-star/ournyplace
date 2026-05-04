# nyhome

Private local PWA for choosing a NYC apartment together.

## Local setup

```bash
npm install
npm run migrate
npm run dev
```

`npm run migrate` applies schema + seeds and creates **`nyp_listing_events`** (Activity Log), **`nyp_building_blacklist`**, and adds **`nyp_apartments.listing_star`** when missing. Skipping migrate: log omits events until `nyp_listing_events` exists; blacklist checks fail until `nyp_building_blacklist` exists.

The app is static HTML/CSS/JS with Netlify Functions and PlanetScale. It uses its own `nyp_` database tables and `nyhome-*` browser keys. PWA: `manifest.json` + service worker; favicon is `assets/img/favicon1.png`. On `localhost` the shortlist page unregisters service workers so local dev is not stuck behind cached shell assets.

Required local environment:

```bash
DATABASE_URL=https://username:password@host/dbname
APP_NAME=nyhome
```

Copy **`.env.example`** → **`.env.local`** for local dev. Placeholders use **`example.invalid`** addresses so committed text does not match **Netlify secrets** you set in the dashboard (build fails if a “secret” env value appears in repo files). On Netlify, set **`DATABASE_URL`** (and SMTP / **`NYHOME_*`**) for **Functions** scope, not build-only.

There is intentionally no auth while this is local-only. Add a password gate before public deployment.

## What It Does

- Public shortlist at `/`: **View** **Cards** | **Finalist** | **Next actions** (`nyhomeShortlistView`). Row under the title: **View** (left) + **Sort by** (Cards only; on **≤720px** width **Sort** is a collapsible row and **VIEW** is hidden — use fixed **bottom nav** **Cards** | **Next actions**; **Table** from desktop **VIEW** only) + **New listing** → `/admin/new` and **Manage** → `/admin` (plain links, `|`, right). **Filters** FAB → glass **drawer**: pipeline **status** groups (`statusFilterGroups.js`) + **Next actions** block (Tour / App deadline / Move-in — require that date when checked; same keys as `nyhomeNextActionsOmit*`). **Cards:** grid, **five pipeline KPI** tiles (same buckets as drawer), **Sort** incl. **Star** (`nyhomeShortlistSort`), listing **Stars** (click tiers on-card; persisted `listing_star`), **Avg** / Kerv / Peter, up to **3** thumbs under scores (bulk list API omits inline **`data:`** image bodies so Netlify responses stay small — **`https://`** thumbs only until **`/details`** refetches one row); hover → fixed preview. **Finalist:** table; **URL** = external site (before **Avg**); `≤720px` link in row expand. **Next actions:** **List** / **Calendar** + calendar **Summary** / **Details** / **Prospect**; mobile: opening Next actions defaults **Calendar** + **Summary**; prefs in `localStorage`. **Next actions** calendar listing row: horizontal rent/fee chips + scratch column (no apt # column). Card glow: `listing-status-*`. Shell cache: bump `sw.js` + HTML `?v=` together. Photos: `/admin/new` or **`/details` → Images** (up to 3).
- Instructions (Tour & Toured usage): **`/instructions`** — static HTML (`instructions/index.html`).
- Details at `/details/?id=…`: Hunter-style summary + tabs: **Scorecard**, **Images**, **Unit Setup**, **Peter** / **Kerv**, **Tour**, **Toured**, Application, **Activity Log** (includes `nyp_listing_events` after migrate). **≤720px:** accordion + compact summary; optional `?tab=` in URL. **Unit Setup** mirrors **`/admin/new`** listing fields (incl. financials, beds/baths/sq ft, chips). **Header:** **New listing** + **Back to shortlist**. Summary subtitle + meta location: **street · unit · neighborhood** (`detailLocationSubtitle`); external **`Listing`** link in meta when URL set. Scoring: **N/A** + `0..5`, criterion **?** toggles definition; votes update the hex + meta **Avg/Kerv/Peter** in place (no full-page reload); **Images** per-criterion table rows use `data-criterion-id` for the same live cell update. **Tour:** schedule visit + notes; after save, **Add to Google Calendar** (30 min, shared description with links + scorecard text). **Toured:** read-only **Peter | Kerv** summary of saved checklist rows; **Open toured checklist** goes to **`/details/toured?id=…`** for the editable form (run **`npm run migrate`** so `toured_data` exists). Step-by-step: see **`CLAUDE.md`** section *Tour & Toured checklist — how to use*.
- **Manager** `/admin`: tabs **Saved apartments** | **Building blacklist** | **Criteria**. **Header** search filters the list on **Saved apartments**; cleared when switching to **Building blacklist** or **Criteria**. **New listing** in header → `/admin/new`. **Saved apartments:** `manager-row` with **Delete** + per-row **status** only (no **Edit** / **Details** links); row click (not controls) → `/details`. Full apartment form + **`?id=`** edit on **`/admin/new`**. **Criteria** / **blacklist**: click-edit, etc.
- **New listing** `/admin/new`: full apartment form (Location … **Listing photos**) + same **Saved apartments** list; same header search; **View cards** / **Manager**.
- Manual entry lives at `/admin/new` (sections above); **`?id=`** opens that listing for edit.
- Apartment title is automatic: `Address #Apt`, e.g. `260 Gold Street #1117`.

## Listing status

Allow-list (also `ORDER BY` in DB): `new` through `signed`, then `rejected`, `blacklisted`, `archived`. API and `saveApartment` coerce unknown `status` to `new`. Keep `assets/js/apartmentStatus.js` in sync with `lib/apartmentStatus.js`.

```text
new -> evaluating -> shortlisted -> tour_scheduled -> toured -> finalist -> applying -> applied -> approved -> lease_review -> signed; terminal: rejected, blacklisted, archived
```

- **Blacklist / duplicates:** saving an apartment (`/admin/new` form or `/details` Unit Setup) warns if the **building** is on the blacklist (modal: cancel or **Save anyway**). Duplicate **address + unit** (normalized) returns an error unless the only existing row is **`rejected`**. Setting status **`blacklisted`** upserts the building into the blacklist table.
- **Modals / toast:** `assets/js/nyhomeUiFeedback.js` — most errors and confirms use in-app `<dialog>` (not `window.alert`); **Reject** / **Delete** use a red primary. Pipeline digest **sent** → short **toast** (shortlist + Admin Settings **Send digest**).
- **`/admin/new` form:** full status `<select>` + **Reject** (no Prev/Next on the form; use `/details` for arrows).
- **Admin saved list:** one row per listing; **status** dropdown saves the apartment on change.
- **`/details`:** status `<select>` + arrow buttons move within the first 11 steps (stops before `rejected`, `blacklisted`, `archived`); **Reject** next to the progression; **Listing** (external URL) in the **meta** row (not in the title row). Status edits auto-save and refresh the **current** details tab (Unit Setup submit still returns to the Unit tab).

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

- Criteria live in `nyp_criteria`. Admin **Delete** = soft-delete (`active = FALSE`, `sort_order = 99`); only active rows load in the UI / scoring.
- Ratings live in `nyp_ratings` (`score` nullable: **N/A** = `NULL`).
- Voters: `kerv`, `peter`.
- **0..5** or **N/A** per line. Averages use only rows with a numeric score (skips N/A and unset).
- **Where to vote:** `/details` → **Peter** or **Kerv** (one partner per tab). Criterion **table** (flushed rows, **N/A** + aligned `0..5`); **?** opens the definition. Unselected: pale hex + dim label; selected: **dark** fill + **white** text. Saving a score: optimistic UI, then `POST /api/ratings` + client-side rollup patch (matches server `calculateScores`); **Activity Log** vote lines appear after a full details refresh if you need them. Shortlist and **Saved apartments** table are summary-only; full voting is on **Details**.
- Scorecard tab shows **Avg** / Kerv / Peter % (`Avg` = mean of the two partners when both exist; each partner % from `calculateScores` over scored criteria only); public `/` cards show the same three in one row.

## Local-Only Security

Mutating routes are intentionally open for local use. Before deploying publicly, add auth for:

- `/admin` and `/admin/new`
- `POST/PUT/DELETE /api/apartments` — **`DELETE`** uses **`?id=`** query param (reliable when proxies strip DELETE bodies)
- `POST/PUT/DELETE /api/building-blacklist` — same **`DELETE ?id=`**
- `POST/PUT/DELETE /api/criteria` (`PUT`: update fields or `{ orderedIds }` reorder; **`DELETE ?id=`**)
- `POST /api/ratings`
- `POST /api/visits`
- `POST /api/applications`
