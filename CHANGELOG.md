# Changelog

## Unreleased

### Added
- **Shortlist Next actions** (`nyhomeShortlistView` = `next-actions`): third **View** tab after **Finalist**. Rows = listings with **scheduled tour** and/or **application deadline** (one row per apt). One-line row: title · location · dates · status pill; **?** = same `criterion-def-btn` + `vote-criterion-def-panel` toggle as **Peter/Kerv** scoring (prep copy). **Next:** / **Reject** call `saveApartment`; main strip links `/details`. **Sort by** hidden (same as Finalist).
- **`nyp_listing_events`:** migration creates table; `saveApartment` logs status changes, `saveRating` logs vote when score changes; `GET /api/apartments` attaches `listing_events` (max 50/apt, newest first). **`/details` Activity Log** merges those events with Created / Tour / Application (dropped coarse “details updated” row).
- **`assets/js/apartmentSavePayload.js`:** `NyhomeApartmentPayload.apartmentToSavePayload(apartment, overrides?)` for admin row status + shortlist Next actions saves.
- **Shortlist Finalist view:** **View** = Cards | **Finalist** (`nyhomeShortlistView`). **Finalist** table: sort **Avg (desc)** then **workflow**; **Sort by** hidden. Columns incl. move-in, scores, status pill. Narrow = horizontal scroll.
- **Listing thumbs on shortlist / hover preview:** up to **3** images; **Cards** under score row; **Finalist** in listing column; hover → `#nyhome-finalist-flyout` 300px preview. `wireListingThumbHovers()` shared.
- **N/A ratings** in `/details`; `NULL` in DB; migrate nullable `score` + legacy `0` → `NULL`.
- **Listing photos (vibe):** Admin + `/details` Images; `vibeImages.js`; thumbnails on score tabs.
- Favicon + `manifest` + `sw.js` precache.
- **Admin saved-list search** (header); suggestions; clear on **Criteria** tab.
- **Public shortlist sort** (`nyhomeShortlistSort`).
- **Admin row → details** click (excluding controls).

### Changed
- **`/admin`:** removed **Next Actions** tab (moved to `/` **Next actions**). Search clears when leaving **Apartment Setup** for **Criteria** only.
- **`NyhomeAPI.saveApartment`:** `PUT` if `Number(id) > 0`, else `POST`.
- **Shortlist cards:** thumbs + hover preview (README).
- **`POST /api/ratings`:** `score` required (`null` or `0–5`); weighted avg uses numeric rows only.
- **Scoring UI:** hex buttons; cache `?v=` + `sw.js` **51** lockstep.
- **`index.html`:** localhost unregisters service workers.

### Fixed
- **Saves if `nyp_listing_events` missing:** try/catch on event write/read/delete; **admin** save fail → **alert** + `console.error`.
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
