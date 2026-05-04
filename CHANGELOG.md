# Changelog

## Unreleased

## 1.4.1 - 2026-05-03

### Added
- **`GET /api/apartments?id=`** — one listing with full `image_url` values (incl. `data:image/...`), plus `criteria` and `neighborhoods`. **`NyhomeAPI.getApartment(id)`** in **`api.js`**; **`/details`** `load()` calls it after **`getApartments()`** so Images / vibe slots stay correct while the bulk list stays small.

### Changed
- **`lib/db.js`** — PlanetScale **`Client`** (each **`execute`** uses a fresh connection); **`netlify.toml`** **`NODE_VERSION = "20"`** for function runtime.
- **`.env.example`** — SMTP/from/to placeholders use **`example.invalid`** so example text does not match Netlify **secrets scanning** values.
- **`sw.js`** — Document navigations (**`mode === 'navigate'`**): **network first**, then cache / offline fallbacks for `/`, `/admin`, `/admin/new`, `/details/toured`, `/instructions`. **`CACHE_VERSION`** + HTML **`?v=`** → **142**.
- **`netlify.toml` headers** — **`Cache-Control: no-cache`** for **`/admin`**, **`/admin/`**, **`/admin/new`**, **`/admin/new/`** (not only **`/admin/*`**).
- **`admin/index.html`** + **`admin/new/index.html`** — register **`/sw.js`** on prod (same pattern as shortlist **`index.html`**) so admin-only visits pick up worker updates.

### Fixed
- **Netlify function response size (~6 MB)** — bulk **`GET /api/apartments`** JSON could exceed the cap when many listings stored **base64** photos in **`nyp_apartment_images.image_url`** (502 / **`Function.ResponseSizeTooLarge`**). **`getApartmentPayload`** now nulls **`data:`** URLs on image rows for the list only; full blobs come from **`GET ?id=`** on details.

## 1.4.0 - 2026-04-29

### Added
- **`/instructions`** — operator HTML (`instructions/index.html`); **`netlify.toml`** redirects **`/instructions`** / **`/instructions/`**; **`sw.js`** precache entry.
- **Toured checklist:** **`/details/toured?id=`** (`details/toured/index.html`, **`assets/js/toured.js`**): Peter/Kerv selector, tristate + chips + per-row notes + tags; **`Save`** → **`PUT /api/apartments`** with **`touredData`** → **`nyp_apartments.toured_data`** (MEDIUMTEXT; **`migrate.js`** ALTER).
- **`/details` → Toured tab:** read-only **Prompt | Peter | Kerv** table (**`NyhomeToured.renderTouredReadOnlyHtml`**); rows only if ≥1 partner answered; **Open toured checklist** → **`/details/toured`**; loads **`toured.js`** in **`details/index.html`**.
- **Tour tab:** **Scheduling notes** + **During-tour notes**; **`POST /api/visits`** **upserts** one **`nyp_visits`** row per apartment (was insert-only); **`DELETE /api/visits?apartmentId=`** clears visit (**`api.js`** **`deleteVisit`**).
- **Add to Google Calendar** (after visit saved): ~30 min event; guests leacock.kervin + peterpapapetrou1; description = toured URL, summary, scorecard (Avg·Kerv·Peter + per-criterion), listing URL, details URL (**`details.js`** **`buildCalendarEventDetails`**).
- **`npm start`** — same as **`npm run dev`** (**`package.json`**).

### Changed
- **Shortlist `/` load:** **`app.js` `boot`** — no sync **`render(cached)`** from `localStorage`; empty summary KPI row + **`Loading…`** until **`NyhomeAPI.getApartments()`** resolves, then **`render`** (stops stale listing count / card grid flash after DB changes). Offline: unchanged — **`api.js`** `getApartments()` still resolves with last cached payload on fetch failure.
- **`nyp_criteria` soft-delete:** **`deleteCriterion`** sets **`sort_order = 99`** with **`active = FALSE`**; **`migrate.js`** bulk deactivate (labels not in seed set) sets **`sort_order = 99`** too.
- Shell **`CACHE_VERSION`** / key HTML **`?v=`** (shortlist + details + toured + instructions) → **140**.

### Fixed
- **DELETE** **`/api/apartments`**, **`/api/criteria`**, **`/api/building-blacklist`:** **`api.js`** sends **`?id=`**; **`lib/http`** **`deleteRequestId(event, body)`** — server reads **`id`** from JSON body or query (some gateways strip DELETE bodies → deletes looked like no-ops).
- **Admin Criteria** inline edit — weight: **`criterionWeightUnchanged`** epsilon compare so **`PUT`** is not skipped when DB/JSON weight differs slightly from the input number.
- **Toured checklist save:** **`apartments`** handler + repo stringify guard — **`MISSING_TOURED_DATA_COLUMN`** / **`INVALID_TOURED_DATA`** when DB or payload bad (migrate adds **`toured_data`**).

## 1.3.0 - 2026-04-28

### Added
- **`npm run release:github`** — `scripts/create-github-release.mjs` creates a GitHub Release from the matching `CHANGELOG` section (needs `GH_TOKEN` / `GITHUB_TOKEN`).

### Changed
- **Next actions (calendar):** listing **spec strip** = horizontal rent/fee **chip** row + scratch column + checklist — **no** apt **Unit** column; **no** visible **Financials** heading (chip group `aria-label` **Rent and fees**). CSS grid 2 cols.
- **`/details`:** summary **`detailLocationSubtitle`** → `street · #unit · neighborhood` (unit omitted if redundant); **Unit Setup** Location = Address → Apt → Neighborhood; rent/fees fields **without** a separate **Financials** `h3`; meta external link anchor **Listing**; **Scorecard → Unit Snapshot** no longer repeats bed/bath/sq ft line (still in Unit Setup + meta **home** row). Mobile summary subline matches location + status.
- **Next actions Prospect — Notes & details:** no duplicated address; listing link text **Listing**.
- **Shortlist pipeline KPI row:** `body.shortlist .summary-grid .summary-value` / `.summary-label` unify tile typography.
- Shell **`CACHE_VERSION`** / HTML **`?v=`** → **135**.

### Removed
- Next actions spec strip **Unit** cell.

## 1.2.0 - 2026-04-28

### Added
- **Admin Analytics dashboard** — `/admin` gains two new top-level tabs (**Analytics** + **Activity**), both with **period filter** pill (Today / Yesterday / 7D / 30D / All time) and **Refresh** button. **Analytics tab:** colorful KPI tiles (pipeline state + period activity); **4 Chart.js charts** — timeline area (events/day, status vs score), pipeline funnel (horizontal bar, Early/Tours/Finalist+/Signed), status transitions (horizontal bar, period-scoped from `activityByDay`), Kerv vs Peter by criterion (grouped horizontal bar, 0–5); **Scoring gaps** table (active listings sorted by fewest combined votes, Kerv + Peter progress bars); **Criteria ratings** table (highest→lowest avg, per-criterion score bars, vote counts, % of total) + **score distribution bell curve** (area line chart 0–5, smooth curve, Kerv teal / Peter pink, **Both/Kerv/Peter** filter pill). **Activity tab:** period summary bar (total events, status changes, score changes, Kerv/Peter votes) + collapsible day cards newest-first (chevron, link to `/details?tab=activity`), row cap 2 000. `GET /api/admin-analytics?period=` (`today`=1d, `yesterday`, `7d`, `30d`, `all`=90d); all computation in `lib/adminAnalytics.js` (re-uses `pipelineDigest.js` pure exports).
- **`lib/adminAnalytics.js`:** `buildAnalyticsPayload({ apartments, criteria, … })` → `{ pulse, todayRollup, transitions, activityByDay, capped, leastVotedListings, criterionStats }`; `buildLeastVotedListings` (active listings sorted by fewest non-null votes); `buildCriterionStats` (per-criterion avg + score distribution arrays `kervDist`/`peterDist`); `ACTIVITY_LOG_DAYS = 14`, `ACTIVITY_ROW_CAP = 2000`.
- **`NyhomeAPI.getAdminAnalytics(period)`:** `GET /api/admin-analytics?period=` wrapper; period defaults to `'today'`.
- **Listing-added email:** `POST /api/apartments` (create) sends HTML email to `NYHOME_EMAIL_TO` via `lib/listingAddedMailer.js` + `lib/listingAddedEmail.js` — Summary + Scorecard + Images + details link; failure logged only (API still `200`).
- **Scoring-complete email:** `POST /api/listing-scores-email { id }` — manual trigger from `/details` **Email scoring summary** button; also fires automatically on `POST /api/ratings` when both partners finish all criteria (no N/A); `lib/votingComplete.js` `isBothPartnersVotingComplete`; `400 INCOMPLETE_SCORES` if any N/A remain on manual trigger.
- **`nyhomeUiFeedback.js`:** `NyhomeUiFeedback` — injects `<dialog>` **alert** / **confirm** (same chrome as `nyhome-modal`; **destructive** red primary for **Reject** + **Delete apartment**); **toast** when pipeline digest send succeeds (shortlist + Admin Settings). Replaces `window.alert` / `confirm` in `app.js` / `admin.js` / `details.js`; `saveApartmentWorkflow.js` uses it for blacklist fallback + duplicate `409`. Load before `saveApartmentWorkflow.js`. `sw.js` precaches it; shell **`?v=`** / **`CACHE_VERSION`** **99**.
- **Pipeline digest email:** `POST /api/pipeline-digest-email` (`pipeline-digest-email.js`, `nodemailer`). HTML `lib/pipelineDigest.js` — Pulse, needs attention, top 10, Today rollups + status histogram, signed footer; pastel pills (no SVG). Today query: `etDayBounds.js` + `fetchListingEventsBetweenCreatedAt`; JSON meta incl. `kervVotesToday` / `peterVotesToday` / `kervListingsToday` / `peterListingsToday`. Client: `NyhomeAPI.sendPipelineDigestEmail`; shortlist + Admin → Settings. Env `.env.example`.
- **Shortlist — Ranked sort:** new **Sort by** option (Ranked) applies Star tier desc → Avg desc → Workflow desc. Works on both Cards and Table views; persisted in `nyhomeShortlistSort`.
- **Shortlist Table view sort parity:** Table (née Finalist) now respects **Sort by** bar — any sort other than Ranked applies the same ordering as the card grid. Sort bar is visible when Table is active.
- **`shortlistSort.js`** — `NyhomeShortlistSort` shared module: `sortForDisplay`, `sortForFinalist`, and comparators extracted from `app.js` and reused by `admin.js`.
- **Admin Saved apartments sort:** Default | Workflow | Avg | Updated | Ranked control in the Saved apartments section header; persisted in `localStorage` (`nyhomeAdminApartmentSort`).

### Changed
- **Next actions (shortlist):** **Tour / App deadline / Move-in** “only include” toggles live in **Filters** drawer → **Next actions** block (`renderFilterBar` + `wireNaOmitCheckboxes(filterEl)`); removed from the Next actions **toolbar** title bar. NA toolbar = **List** / **Calendar** + (calendar) **Summary** / **Details** / **Prospect**; no inline **Filter by status** on that bar (use **Filters** FAB). Calendar event **banner** = Avg/Kerv/Peter scores after status; **Details** density = no **Notes & details** block (**Prospect** only). Spec strip = unit + financial **chips** + narrow **scratch** column; financials not per-line write boxes.
- **User feedback:** errors + confirmations → in-app modals + digest-OK **toast**; native `alert`/`confirm` only as fallback (no `<dialog>`).
- **Shortlist "Finalist" tab → "Table":** button label renamed; `data-shortlist-view` value and localStorage key (`finalist`) unchanged for backward compatibility.
- **Mobile bottom nav:** reduced from Cards | Finalist | Next actions → **Cards | Next actions**; Table view is desktop-only.
- **Mobile shortlist (≤720px):** fixed **bottom nav** (`#nyhome-mobile-bottom-nav`) — Cards | Finalist | Next actions; header **VIEW** segment hidden. **Sort by** collapsible row (`#shortlist-sort-mobile-toggle` + `#shortlist-sort-panel`, Cards only). **Next actions:** tap sets **Calendar** + **Summary**; reload on NA view forces **calendar** layout (`applyMobileNextActionsDefaults`). **Summary** calendar rows: **stacked** — TOUR/time strip above listing card (`.shortlist-next-actions-wrap[data-na-density="summary"] .shortlist-na-line` single column). Static refs: `PLAN-mobile.md`, `mobile-mockups/*.html`.
- **Mobile `/details` (≤720px):** **accordion** sections + compact summary (`MOBILE_DETAIL_MAX` 720, `details.js`); optional `?tab=` in URL. Tab bodies that are also `.summary-tab-content` get `#detail-root` display overrides so accordion expand works.
- **`nyp_apartments.listing_star`:** nullable tinyint (1 Peter, 2 Kerv, 3 both); `migrate.js` ALTER (required before star saves); full apartment `GET/POST/PUT` via `apartmentRepository` + `apartmentSavePayload`; **`listingStar.js`** (`NyhomeListingStar`): **Cards** = `buttonHtml` cycle; **Star** sort; read-only **`displayHtmlIfStarred`** (tier 1–3 only) elsewhere; SVG path paint = **inline hex** in JS. Shortlist **five pipeline KPI** tiles (`NyhomeStatusFilterGroups`). Client: merge row + **`NyhomeAPI.setApartmentsCache`** after star save (fixes stale GET/cache missing `listing_star`). Star PUT uses **`ignoreBlacklist: true`**. **`?v=`**/`sw.js` **`CACHE_VERSION`** bumped together (currently **99**).
- **Shortlist Finalist (View = Finalist):** sort **Avg (desc)** then **workflow**; **URL** column (before **Avg**) = `listing_url` as plain accent text link; row = two `display:contents` `/details` links + external `<a>`. **≤720px:** column hidden; expand **Details** + **Listing**; external tap does not open expand.
- **Building blacklist:** `nyp_building_blacklist` (unique `normalized_key`); admin tab **Building blacklist** (criteria-style click-to-edit); paste address block like Notes. Save apartment → modal if building blacklisted (**Save anyway** = `ignoreBlacklist`); status **blacklisted** upserts blacklist row.
- **Listing status `blacklisted`:** terminal (no Prev/Next in nav); badge + shortlist `listing-status-blacklisted`.
- **Paste parser:** `lib/listingTextParse.js` + client mirror — Google Maps one-liner, StreetEasy unit-first / gross rent lines; Notes paste inserts clipboard then parses (no race).
- **Shortlist Next actions** (`nyhomeShortlistView` = `next-actions`): third **View** tab. Listings with **tour** / **deadline** / **move-in**. **Filters** drawer → **Next actions:** Tour / App deadline / Move-in (require that date when checked; same `localStorage` omit keys). Toolbar: **List** / **Calendar** + (calendar) **Summary** / **Details** / **Prospect**. Calendar row: scores on banner; spec = unit + financial **chip** row + narrow scratch column + checklist; **Notes & details** = **Prospect** only; **Sort by** hidden.
- **`nyp_listing_events`:** migration creates table; `saveApartment` logs status changes, `saveRating` logs vote when score changes; `GET /api/apartments` attaches `listing_events` (max 50/apt, newest first). **`/details` Activity Log** merges those events with Created / Tour / Application (dropped coarse “details updated” row).
- **`assets/js/apartmentSavePayload.js`:** `NyhomeApartmentPayload.apartmentToSavePayload(apartment, overrides?)` for admin row status + shortlist Next actions saves.
- **Listing thumbs on shortlist / hover preview:** up to **3** images; **Cards** under score row; **Finalist** in listing column; hover → `#nyhome-finalist-flyout` 300px preview. `wireListingThumbHovers()` shared.
- **N/A ratings** in `/details`; `NULL` in DB; migrate nullable `score` + legacy `0` → `NULL`.
- **Listing photos (vibe):** `/admin/new` + `/details` Images; `vibeImages.js`; thumbnails on score tabs.
- Favicon + `manifest` + `sw.js` precache.
- **Saved-list search** in admin **header** (`/admin` + `/admin/new`): filters `#admin-apartment-list`; suggestions under title; **×** + Escape. On **`/admin`**, clear query when leaving **Saved apartments** for another top tab.
- **Route `/admin/new`:** new listing form + same saved list + `?id=` edit; rewrites in `netlify.toml`.
- **Header global nav:** `New listing` | `Manage` (and variants) as plain text links in `.app-header-actions` (no CTA box, no underline; **|** in `.app-header-actions-sep`). Shortlist: links in `shortlist-hero-right` (`.app-header-actions--in-hero`).
- **Public shortlist — desktop vs mobile:** Desktop: **VIEW** + inline **Sort by**. Mobile (≤720px): **bottom nav** replaces VIEW; collapsible **Sort**; Next actions **Prospect** density shows **Notes & details** collapsible. Bump **`sw.js` `CACHE_VERSION`** + HTML **`?v=`** together after shell edits.
- **Public shortlist (`/`):** **View** (left) + **Sort by** (Cards) + `New listing` | `Manage` (right, `.shortlist-hero-right` / `.app-header-actions--in-hero`); no tagline. **Filters** FAB → **drawer**: status groups (`statusFilterGroups.js`) + **Next actions** Tour/deadline/move-in toggles. **Next actions** calendar: day agenda (travel / tour / debrief); banner scores; unit + financial **chips** + scratch column + checklist; **Summary** hides heavy blocks. **Prospect**: notes collapsible open in print; **details** density: worksheet button on tours where applicable. White card chrome + `shortlist-view-btn`. Keep **`?v=`** ↔ **`CACHE_VERSION`** lockstep on shell assets.
- **`POST/PUT /api/apartments`:** `409` + `code` **`BLACKLISTED`** / **`DUPLICATE_LISTING`** (second = another **non-`rejected`** listing shares normalized address+unit). `/details` Unit Setup address/apt saves same checks.
- **`/admin`:** tabs **Saved apartments** | **Building blacklist** | **Criteria**; setup form at **`/admin/new`**. **Next actions** only on public `/`. **Saved apartments** list: no row **Edit** / **Details** links; row click (outside controls) → `/details`; full form + **`?id=`** edit only on **`/admin/new`**.
- **`/details` → Unit Setup:** parity with **`/admin/new`** listing fields (financials, beds/baths/sq ft, chips, notes); admin-matching chip labels; compact chip layout; **Save Unit Setup** bottom-right.
- **`NyhomeAPI.saveApartment`:** `PUT` if `Number(id) > 0`, else `POST`.
- **Shortlist cards:** thumbs + hover preview (README).
- **`POST /api/ratings`:** `score` required (`null` or `0–5`); weighted avg uses numeric rows only.
- **Scoring UI:** hex buttons. Bump **`sw.js` `CACHE_VERSION`** and HTML `?v=` on shell assets together.
- **`index.html`:** localhost unregisters service workers.

### Removed
- Admin **manager-row** **Edit** and **Details** links (navigation: row → `/details`; form: `/admin/new?id=`).

### Fixed
- **Pipeline digest top 10:** `<ol>` only — removed extra `1.` / `2.` in list text (was showing `1.1.` in some mail clients).
- **`apartmentSavePayload` + star PUT:** `address` never omitted (`JSON.stringify` dropped `undefined` → API **400 address required**). Shortlist star save attached **`ignoreBlacklist`** so blacklist does not block tier-only updates to existing rows.
- **`POST/PUT /api/apartments`:** Unknown column **`listing_star`** → **500** JSON **`code: MISSING_LISTING_STAR_COLUMN`** + migrate hint (instead of opaque error).
- **`/details` voting (Peter / Kerv / Images hex scores):** optimistic button `active` on click; after successful `POST /api/ratings`, **no** full `load()` — merge vote into `state.apartment.ratings`, recompute Avg/Kerv/Peter with same weighted formula as `lib/apartmentRepository` `calculateScores`, patch summary **meta** score strip + **Images** per-criterion table (`tr[data-criterion-id]`), sync `nyhome-apartments-cache`. Avoids stale `localStorage` paint + whole-page `innerHTML` jank. **Activity Log** new vote rows still need a full refresh / `load()` to appear.
- **Notes paste:** first paste could skip parse (textarea value not updated yet).
- **Saves if `nyp_listing_events` missing:** try/catch on event write/read/delete; **admin** save fail → **`NyhomeUiFeedback.alert`** + `console.error`.
- N/A vs **0** active state (`rating != null` for numeric chips).
- **Admin Criteria** drag-reorder refresh (`ids.indexOf(Number(a.id))`).

## 1.1.0 - 2026-04-25

### Added
- `package.json` script `split-badges` (runs `scripts/split_status_sprites.py` on a badge sheet) for dev sprite workflows.
- **`PUT /api/criteria`:** update one row (`id`, `label`, `definition`, `weight`) or reorder (`orderedIds: number[]` → `sort_order`). `lib/apartmentRepository` `updateCriterion`, `reorderCriteria`; `NyhomeAPI.updateCriterion` / `reorderCriteria`.

### Changed
- **Typography / chrome:** app font stack = San Francisco (Apple system) with **Poppins** next, then `system-ui` / fallbacks. Primary actions use **outline** style (white + border + hover) instead of solid fill; many labels/controls use **400–500** weight for calmer UI.
- **Score stats (Avg / Kerv / Peter):** UI label **Combined → Avg** (fits score boxes); vote palette still **border + %**; hover = soft fill; shortlist, details, admin use same pattern.
- **Public `/` shortlist (`body.shortlist`):** KPI strip = glass + **neon border/glow** per tile (neutral fill); tile 4 **top avg score**; listing cards = glass + **`listing-status-*`** glow from `status`; header tagline; `status` = corner artwork + filter strip (no text pill on cards; details/admin keep pills).
- **`/admin` Criteria tab:** add form = one row (label, definition, weight) + **Add criterion**; list = **click-to-edit** (blur saves), drag handle **reorder** (persists order for voting tabs); admin-only input borders/placeholders; criteria list stacked flush. **Apartment Setup** form = scoped spacing/section chrome (Saved Apartments table untouched).
- **`/details`:** **Shortlist** and header **Listing** link removed; external listing stays under meta **“View listing”**; **Reject** is a **quiet** control in the **status** row (with `←` / `select` / `→`); tab row is **Scorecard**, **Unit Setup**, **Peter**, **Kerv** (separate scoring tabs), **Tour**, **Application**, **Activity Log**.
- **`/details` Peter & Kerv scoring (UI):** table-style criterion list (no inter-row gap, shared border, 1px partner top on list, zebra rows); 2-col line grid = label+`?` + fixed-width `0..5` strip (columns align); unselected = pale path + slate numeral, selected = `--kerv-hex-selected` / `--peter-hex-selected` fill + **white** bold numeral; neon-pastel Kerv/Peter tokens; `partner-vote-card` top accent **1px** in admin. Content block `max-width: 44rem` centered.
- **`/admin`:** top **Apartment Setup / Criteria / Next** tabs no longer pick up global **`.tab` + button** rules (avoids fat “button” tabs); calmer **`.admin-shell`** form actions, **Saved apartments** list rows (softer shadow, spacing), **Reject** weight aligned with details.
- **`sw.js`:** `CACHE_VERSION` bumped to match `?v=` on cached CSS/JS in HTML (prevents stale shell skew).

## 1.0.0 - 2026-04-25

### Added
- `lib/apartmentStatus.js` + `assets/js/apartmentStatus.js`: shared allow-list for apartment `status` (used by API, repository, and UI class names).
- `assets/css/app.css` `status-*` palette: consistent pill colors for each allowed `status` on cards, admin, and details.
- `/details`: Hunter-style top summary card + tabbed body (Scorecard, Unit Setup, Voting, Tour, Application, Activity Log). Summary header: status progression (`←` / `→` on first 11 `STATUS_NAV` values), `status` `<select>`, **Reject** + Shortlist/Listing; status saves via `PUT /api/apartments` and re-renders current tab.
- Public `/` cards: `status` pill uses `NyhomeStatus.statusClass` + the shared palette; no photo strip on cards (photo URLs still on record via admin form).
- Admin **Saved Apartments**: one row per listing (`manager-row`); grid metrics (rent, unit, move-in); per-row `status` `<select>` (PUT); Edit / Details / Delete; no inline voting, tour, or application forms (those on `/details`).
- Local `nyhome` PWA/admin app for NYC apartment selection.
- `nyp_` PlanetScale schema for apartments, photos, criteria, ratings, visits, applications, and neighborhoods.
- Apartment form sections for Location, Financials, The Unit, Amenities, and Listing Notes.
- Optional financial fields: net effective, broker fee, deposit, amenities fees, total move-in amount.
- Unit feature and amenity selector chips.
- Notes paste helper for StreetEasy-style listing text.
- Weighted Kerv/Peter scoring: SVG `0..5` score buttons in `/details` Voting tab (Kerv + Peter cards per criterion).
- Service worker cache entries for public and admin shell assets.

### Changed
- `/admin` UI: summary-style top tab bar (`Apartment Setup` / `Criteria` / `Next Actions`), `content-section` form headers; Saved Apartments is compact rows only, not full progress cards.
- `PUT /api/apartments` and `lib/apartmentRepository` `saveApartment` normalize `status` to the allow-list (unknown → `new`). `archived` is a valid stored state.
- `GET /api/apartments` list order follows `apartmentStatus` `STATUS_ORDER` via SQL `FIELD(status, …)`.
- `/admin` Apartment Setup: status is a `<select>` + **Reject** inline (arrows for stepping status are on `/details` only).
- Service worker / HTML asset versions bumped for new `apartmentStatus.js` shell script.
- Apartment titles are generated from address and apt number.
- Neighborhood input supports type-ahead and adding new neighborhoods on save.
- Public score display now shows valid zero scores.

### Fixed
- Async saves/deletes: tagged `console.error` on failure; list status change waits for refresh and avoids touching removed DOM nodes; failed status save reverts the row control.
- Paste helper preserves unmapped listing text under `Other:` instead of dropping it.
- Rating API rejects unknown voters and scores outside `0..5`.

### Security
- `status` values restricted server-side; UI maps unknown DB values to safe CSS classes / `new` for styling.
- App remains local-only with no auth by design. Add an auth gate before public deployment.
