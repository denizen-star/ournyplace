# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start local dev server at http://localhost:8889 (requires Netlify CLI)
npm run migrate    # Schema + seeds: criteria, neighborhoods; alters; `nyp_listing_events`; `nyp_building_blacklist`; `nyp_apartments.listing_star`
npm run split-badges  # Split status badge sprite sheet into individual PNGs
```

Environment: copy `.env.example` to `.env.local` and set `DATABASE_URL` (PlanetScale HTTP connection string) and `APP_NAME=nyhome`.

## Architecture

**nyhome** is a private PWA for two partners (Kerv and Peter) to score and track NYC apartment listings. No build step — vanilla JS served directly by Netlify CLI in dev, with Netlify Functions as the API layer and PlanetScale MySQL for persistence.

### Routing (netlify.toml)

- `/` → `index.html` — Public shortlist: **View** Cards | **Table** | **Next actions** (`nyhomeShortlistView`; stored as `finalist` in localStorage for back-compat); **Sort by** (Cards + Table): Workflow, Avg, Peter, Kerv, Last updated, Star, **Ranked** (`nyhomeShortlistSort`). **Ranked** = Star tier desc → Avg desc → Workflow desc. **Table** view shares same filter pipeline + `apartmentPassesExtraFilters` as Cards; sort follows **Sort by** (any value = parity with card grid; **Ranked** = `sortForFinalist`). **Status filter** in glass **drawer** (`#filters-drawer` + bottom FAB, `statusFilterGroups.js`); not inline in header. Row under the title: grid **View** (left) + **Sort** + **New listing** | **Manage** (right, `.shortlist-tagline-row` / `.shortlist-hero-right` / `.app-header-actions--in-hero`, plain links, `|`). No tagline sentence. **Summary** row: five **pipeline KPI** tiles aligned with filter groups (Discovery & shortlist through Closed). Card grid with optional listing **thumbs** (row under Avg/Kerv/Peter) + **Star** (click-to-cycle on cards; read-only elsewhere) + **Table** (née Finalist; thumbs after address; **URL** = external `listing_url` before **Avg**; columns incl. move-in; **≤720px** **Listing** in row expand) + **Next actions** (listings with **tour** and/or **app deadline** and/or **move-in date**; toolbar **List** / **Calendar** + **Only include with** tour/deadline/move-in (require that date when checked) + **Filter by status**; `localStorage` `nyhomeNextActionsLayout`, `nyhomeNextActionsOmitTour`, `nyhomeNextActionsOmitDeadline`, `nyhomeNextActionsOmitMoveIn`, `nyhomeNextActionsCalendarDensity`; calendar cards = Summary / Details / Prospect density; **Summary** = TOUR/time **above** listing card (stacked, single column); collapsible notes, spec strip w/ pen boxes under each financial line on Details/Prospect; one-line **List** row, status pill, **Next** / **Reject**, link `/details`). Hover thumb → fixed **300px** flyout (`#nyhome-finalist-flyout`, no layout reflow). **Mobile (≤720px):** header **VIEW** hidden; **`#nyhome-mobile-bottom-nav`** (Cards | Next actions — Table removed from mobile nav); **Sort by** collapsible (Cards + Table); **Next actions** from nav → Calendar + Summary; `applyMobileNextActionsDefaults` on load; see `PLAN-mobile.md` / `mobile-mockups/`.
- `/admin` → `admin/index.html` — **Saved apartments** (list + **header** search) | **Building blacklist** | **Criteria** | **Settings** (public URL + **Send digest**); normalized building keys; click-to-edit rows like criteria
- `/admin/new` → `admin/new/index.html` — New listing form (apartment setup + same **Saved apartments** list + **header** search as `/admin`); `?id=` pre-fills for edit
- `/details/?id=…` → `details/index.html` — Full apartment view (scorecard, tour, application tracking). Header: **New listing** | **Back to shortlist** (`.app-header-actions`, same link style as shortlist). **≤720px:** accordion layout + mobile summary (`isDetailsMobile`, `renderMobileDetailPage`); desktop = tab row unchanged. Optional URL `?tab=` (scorecard, images, unit, peter, kerv, tour, application, activity).
- `/api/*` → `/.netlify/functions/:splat`

### Frontend (`assets/js/`)

- **`api.js`** — Fetch wrapper; apartment/criteria/ratings + **`GET/POST/PUT/DELETE /api/building-blacklist`**; **`sendPipelineDigestEmail`** → **`POST /api/pipeline-digest-email`** (optional `publicBaseUrl`); **`setApartmentsCache`** updates `localStorage` list in place (used after listing-star merges); `saveApartment` errors may include HTTP status + `code` (`BLACKLISTED`, `DUPLICATE_LISTING`); **500** + `code` **`MISSING_LISTING_STAR_COLUMN`** when the DB lacks `nyp_apartments.listing_star`
- **`shortlistSort.js`** — `NyhomeShortlistSort`: shared comparators (`compareWorkflowDesc`, `compareLastUpdated`, `compareScoreDesc`, `compareListingStarSort`) + `sortForDisplay(list, sortMode)` + `sortForFinalist(list)` (Ranked: Star tier → Avg → Workflow). Used by both `app.js` and `admin.js`; must load after `apartmentStatus.js` + `listingStar.js`.
- **`app.js`** — Shortlist: `MOBILE_WIDTH_MAX` **720** (`isShortlistMobile`), bottom nav (Cards | Next actions), collapsible sort, mobile NA defaults; filter, **view** (Cards / Finalist / Next actions), **sort** (Cards + Table — `VALID_SORTS` incl. `ranked`); `sortForDisplay` / `sortForFinalist` delegate to `NyhomeShortlistSort`; `renderApartmentCard`, `renderFinalistList` (accepts pre-sorted list; sort applied in `applyFilters` based on `sortMode`; **URL** = external `listing_url` before **Avg**; `buildFinalistRowBeforeUrlHtml` / `buildFinalistRowAfterUrlHtml` + `finalistExternalListingCell`), `renderNextActionsList` (**List** / **Calendar**, `nyhomeNextActionsLayout`; calendar **Card view** Summary / Details / Prospect, `nyhomeNextActionsCalendarDensity`; **Only include with** tour/deadline/move-in checkboxes; status drawer shortcut; `collectNextActionEvents` + travel/tour/debrief rows; `nextActionsListingSpecStrip` = unit + financials w/ per-line `shortlist-na-fin-write-slot` + full checklist; `buildCalendarPrintTocHtml`; `qualifiesNextActions` / `passesNextActionsOmitFilters`), `listingThumbsMarkup` + `wireListingThumbHovers` (`.nyhome-listing-thumb-wrap`); fixed-position image preview
- **`listingStar.js`** — `NyhomeListingStar`: `buttonHtml` (Cards only, always visible), `displayHtmlIfStarred` (read-only, only when tier 1–3: Finalist, Next actions, details, admin), `displayHtml` (any tier, rarely needed); path colors via inline hex in JS; include before dependent bundles
- **`apartmentSavePayload.js`** — `NyhomeApartmentPayload.apartmentToSavePayload(apartment, overrides?)` for consistent `PUT`/`POST` apartment bodies (admin manager status, shortlist Next actions)
- **`nyhomeUiFeedback.js`** — `NyhomeUiFeedback`: injected `<dialog>` **alert** / **confirm** (styled like `nyhome-modal`; **destructive** = red primary) + **toast** for digest success; load **before** `saveApartmentWorkflow.js`
- **`listingTextParse.js`** — `NyhomeListingText.parseListingText` (StreetEasy, Google Maps comma lines, unit-first `#39M` lines); loaded before **`admin.js`** / used by Notes + blacklist paste
- **`saveApartmentWorkflow.js`** — Shared modal + retry for blacklist / duplicate conflicts (`ignoreBlacklist` on second attempt); blacklist fallbacks and duplicate errors use `NyhomeUiFeedback` when present
- **`admin.js`** — `/admin` + `/admin/new`: list + criteria + blacklist; **apartment form** and vibe slots only on `/admin/new`. **Header search** (both pages, same DOM ids) filters `#admin-apartment-list`; on **`/admin` only**, cleared when leaving the **Saved apartments** top tab. **Saved apartments** rows: **Delete** + status `<select>` only (no **Edit** / **Details** links); row click → `/details` except controls; full form + **`?id=`** on **`/admin/new`**. Notes paste (`/admin/new`) uses clipboard insert then parse. **Saved apartments sort** (`#admin-sort`): Default | Workflow | Avg | Updated | Ranked; `initAdminSort` / `applyAdminSort` via `NyhomeShortlistSort`; persisted `nyhomeAdminApartmentSort`
- **`details.js`** — Details page: `MOBILE_DETAIL_MAX` **720**; accordion + `?tab=` on narrow viewports; desktop tabs, status transitions; **Unit Setup** = same listing fields as admin form (location, financials, unit size, feature/amenity chips, notes) + blacklist/duplicate checks on save; **Peter** / **Kerv** / **Images** scoring: optimistic hex `active` state, then on successful `saveRating` merge ratings + `calculateDetailScores` (mirrors server weights), `patchHeaderScoreGridFromState` + `patchVotingScoreTableCell`, `persistApartmentVoteToLocalCache` — **not** full `load()` (status/unit/tour/app saves still use `load()` where noted); **Activity Log** merges `listing_events` with tour/application milestones (new vote events need refresh to show)
- **`vibeImages.js`** — Client-side image resize + JPEG compress for listing photos (used by `admin.js` and `details.js` Images tab)
- **`apartmentStatus.js`** — Shared status enum and CSS class mapping (used by both client and `lib/`)
- **`statusFilterGroups.js`** — `NyhomeStatusFilterGroups.GROUPS`: shortlist filter drawer **sections** (Discovery & shortlist, Tours, Finalist, Application & lease, Closed). Must list every `STATUS_ORDER` value exactly once; `assertComplete(STATUS_ORDER)` checks at boot

Data is fetched on load, cached to `localStorage`, and re-fetched after most mutations (details **rating** saves patch state + cache only). UI re-renders after successful saves where `load()` / `render()` run; failures log to the console; **admin** apartment form save failures show an **in-app modal** via `NyhomeUiFeedback.alert`.

### Backend (`netlify/functions/`, `lib/`)

- **`lib/db.js`** — PlanetScale connection pool with `execute()` and `insert()` helpers
- **`lib/addressNormalize.js`** — Normalize street + borough tokens → `normalized_key` for blacklist + duplicate detection
- **`lib/buildingBlacklistRepository.js`** — CRUD for `nyp_building_blacklist`
- **`lib/listingTextParse.js`** — Server-side mirror of paste rules (tests / parity with client)
- **`lib/etDayBounds.js`** — `boundsForInstantInTz(ms, 'America/New_York')` → `{ ymdET, startMs, endExclusiveMs }` for SQL `[start,end)` Eastern calendar days (digest)
- **`lib/apartmentRepository.js`** — High-level CRUD (title generation, saves); before create/update: **blacklisted building** (unless `ignoreBlacklist`) and **duplicate** same normalized address+unit (allowed only if existing row is **`rejected`**); **`status === blacklisted`** upserts blacklist; **`listing_star`** nullable tinyint on row map; **`fetchListingEventsBetweenCreatedAt(start,end)`** — all `nyp_listing_events` in `[start,end)` with titles (digest range query)
- **`lib/http.js`** — Response helpers (`json()`, body parsing, money conversion cents↔dollars)
- **`netlify/functions/apartments.js`** — GET list, POST create, PUT update, DELETE; **`409`** + JSON `code` for blacklist / duplicate; **500** + **`MISSING_LISTING_STAR_COLUMN`** if `listing_star` column missing (migrate)
- **`netlify/functions/building-blacklist.js`** — Blacklist CRUD
- **`netlify/functions/criteria.js`** — POST new, PUT update fields or reorder via `orderedIds`
- **`netlify/functions/ratings.js`** — `POST` partner vote: `score` key required; integer `0–5` or `null` (N/A)
- **`netlify/functions/visits.js`** / **`applications.js`** — Tour and broker tracking
- **`lib/pipelineDigest.js`** — HTML **pipeline digest** (Pulse KPIs, needs attention, top 10 sort: star → stage → combined avg, signed footer, neon‑pastel styling, **section pill labels** Td/Pu/Nt/10/Wk/Kt—no SVG). **`netlify/functions/pipeline-digest-email.js`** — `POST /api/pipeline-digest-email`, SMTP via **`nodemailer`**. Env: `NYHOME_SMTP_SERVER`, `NYHOME_SMTP_PORT`, `NYHOME_SMTP_USER`, `NYHOME_SMTP_PASS`, `NYHOME_EMAIL_FROM`, `NYHOME_EMAIL_TO`, optional `NYHOME_PUBLIC_URL`. **Today:** **`lib/etDayBounds.js`** America/New_York calendar day + **`fetchListingEventsBetweenCreatedAt`** (full `nyp_listing_events` for that window, no 50/apt cap) + apartment **created_at/updated_at** rollups; status/score/vote counts; **Kerv/Peter vote rows** and **distinct listings scored** per partner; transition histogram. **No** row-by-row activity table in email (details Activity tab still has history). Response **meta:** `loggedActionsToday`, `statusEventsToday`, `voteEventsToday`, `kervVotesToday`, `peterVotesToday`, `kervListingsToday`, `peterListingsToday`, `activeCount`, `attentionCount`, `topCount`.

### Database

All tables prefixed `nyp_`. Money stored as integer cents. Key tables: `nyp_apartments` (incl. optional **`listing_star`** 1 Peter / 2 Kerv / 3 both), `nyp_criteria`, `nyp_ratings` (one row per apartment × partner × criterion, unique; `score` nullable — `NULL` = N/A), `nyp_visits`, `nyp_applications`, `nyp_neighborhoods` (autocomplete seed data), `nyp_listing_events` (append-only status and vote events; last 50 per apartment on `GET /api/apartments`), **`nyp_building_blacklist`** (unique `normalized_key`; warn-on-save at building level).

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

Each partner can vote **0–5** or **N/A** on each active criterion. **N/A** is stored as `NULL` and is **omitted** from that partner’s weighted average (only criteria with a numeric score contribute weight). Criteria have weights. Per-partner % = `(Σ score×weight / Σ included weights) × 20` (0–100 scale). **Avg** = mean of Kerv and Peter when both are non-null. On **`/details`**, after a vote the client recomputes those %s from `state.criteria` + `ratings` so the summary strip matches the server without refetching the full list. **Paste helper** (`listingTextParse.js`): StreetEasy-style blocks, Google Maps comma address lines, unit-first `#` lines, gross rent + “For Rent” patterns; admin **Notes** and **Building blacklist** paste. Run `npm run migrate` to apply `score` nullable + convert legacy `0` → `NULL` (one-time per DB).

### No Auth

The app is intentionally local-only. There is no authentication layer. Do not deploy publicly without adding one first.
