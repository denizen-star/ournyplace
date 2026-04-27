# Feature Implementation Plan: Listing Stars + Pipeline KPIs

**Overall Progress:** 100% — All planned steps (4–10) are implemented. Cache + asset version: **v94** (`sw.js` `CACHE_VERSION`, HTML `?v=` query). Status: **done** for code delivery; manual E2E verification still recommended.

## TLDR

Re-add **database-backed listing stars** (cycle: off → Peter → Kerv → both → off) with **click-to-cycle only on shortlist Cards**, **read-only star icons beside listing titles** everywhere else, a **Star sort** on Cards, and replace the shortlist summary strip with **five pipeline KPI tiles** matching the filter drawer groups (Discovery & shortlist through Closed).

**Landed (this session):** `listingStar.js` wired on **index, details, admin, admin/new**; **app.js** star sort, card wiring, finalist / next actions / print TOC, KPI `renderSummary`; **app.css** star + KPI + title rows; **details.js** `displayHtml` + `listingStar` in payload; **sw.js** + `?v=94`. Follow-up: **Finalist** row split into `buildFinalistRowBeforeUrlHtml` / `buildFinalistRowAfterUrlHtml` + `listing_url` column before **Avg** (plain link); `≤720px` **Listing** in expand.

## Critical Decisions

- **Persistence:** `listing_star` on `nyp_apartments` (`NULL` or `1`–`3`), not `localStorage`, so all clients see the same state.
- **Interaction:** Star **button** only on **Cards**; finalist, next actions, details, admin show **display-only** stars. Finalist table row = two `display:contents` `/details` links (before/after external URL); star lives in the first segment — avoids nested links with **URL** column.
- **Semantics:** One household field: `1` = Peter, `2` = Kerv, `3` = both; `NULL`/unset = not starred.
- **Colors:** Peter/Kerv use existing `--peter` / `--kerv`; “both” uses `color-mix(in srgb, var(--peter) 50%, var(--kerv) 50%)`. **Inline `style` on the SVG path** is required so fills beat browser default black when CSS cascade is weak.
- **Star sort:** Higher tier first (3 → 2 → 1 → 0), then existing **workflow** order as tiebreaker.
- **KPI row:** Count listings whose normalized status falls into each of `NyhomeStatusFilterGroups.GROUPS` (same five sections as the filters drawer).

## Tasks

- [x] **Step 1: Database migration**
  - [x] `safeAlter`: `ALTER TABLE nyp_apartments ADD COLUMN listing_star TINYINT NULL DEFAULT NULL` (idempotent duplicate guard). (`scripts/migrate.js`)
  - [x] Document `npm run migrate` for deploys. (`README.md`, `CLAUDE.md`)

- [x] **Step 2: Server / API**
  - [x] `lib/apartmentRepository.js`: include `listing_star` in INSERT and UPDATE parameter lists; `normalizeListingStarForDb(raw)` (only 1–3 or `null`).
  - [x] `netlify/functions/apartments.js`: parse `body.listingStar` and pass `listingStar` into `saveApartment`.
  - [x] Confirm `getApartmentPayload` / list loaders keep `listing_star` from `SELECT *` (no strip).

- [x] **Step 3: Shared client payload**
  - [x] `assets/js/apartmentSavePayload.js`: `listingStar` with `hasOwnProperty` override vs copy from `apartment.listing_star`.

- [x] **Step 4: `listingStar.js` module + shell loading**
  - [x] `assets/js/listingStar.js`: `NyhomeListingStar` — `normalizeTier`, `cycleDbValue`, `tierLabel`, `displayHtml`, `buttonHtml`, inline `starSvg` path **style** for tiers 0–3.
  - [x] `<script src="/assets/js/listingStar.js?v=94">` before dependent bundles on **index**, **details**, **admin**, **admin/new**.

- [x] **Step 5: Shortlist (`app.js` + `index.html`)**
  - [x] `VALID_SORTS` + `sortForDisplay`: `star` mode + `compareListingStarSort` (tier desc, then `compareWorkflowDesc`).
  - [x] `index.html`: “Star” sort control; script tag for `listingStar.js`.
  - [x] `renderApartmentCard`: title row = `buttonHtml` + title text; `wireCardListingStars` after card render — `saveApartment(apartmentToSavePayload(apt, { listingStar }))` then `getApartments` + `render`.
  - [x] Finalist `buildFinalistRowBeforeUrlHtml` (place row): prepend `displayHtmlIfStarred(apartment)` in place row.
  - [x] Next actions list row + calendar `renderNextActionsEventBlock`: star before title; print TOC listing cell: star + title (`shortlist-na-toc-listingname`).
  - [x] `renderSummary`: five `summary-kpi summary-kpi--{groupId}` tiles from `NyhomeStatusFilterGroups.GROUPS` counts (replaced old four-card summary).

- [x] **Step 6: Styles (`app.css`)**
  - [x] Listing star: wrap, button reset, tier classes (inline SVG still primary for paint).
  - [x] Title row flex: `.apartment-title-inner`, `.apartment-title-text`, details `.summary-apartment-title-inner` / `.apartment-title-text-block`, mobile `.mobile-summary-title-row`.
  - [x] Shortlist KPI: `.summary-kpi--discovery|tours|finalist|application|closed` border/glow + label typography (replaced nth-child summary hacks).
  - [x] `body.shortlist .shortlist-next-actions-main`: `align-items: center` (star aligns with title).
  - [x] Print TOC: `.shortlist-na-toc-titlecell` flex for star + listing name.

- [x] **Step 7: Details page**
  - [x] `details/index.html`: include `listingStar.js` before `details.js`.
  - [x] `details.js`: summary header title row with `displayHtml`; `buildApartmentPayload` includes `listingStar` from `state.apartment.listing_star`.

- [x] **Step 8: Admin**
  - [x] `admin.js`: `readApartmentForm` + `renderAdminApartment` with `NyhomeListingStar` when present (from prior work).
  - [x] `admin/index.html` and `admin/new/index.html`: `listingStar.js` before `apartmentSavePayload` / `admin.js`.

- [x] **Step 9: PWA cache**
- [x] `sw.js`: `CACHE_VERSION` 94; `listingStar.js` in `APP_SHELL`.
- [x] `?v=94` on shell HTML for cached assets (aligned with `CACHE_VERSION`).

- [x] **Step 10: Verify** *(manual)*
  - [ ] Run `npm run migrate` in each environment; cycle star on a card; confirm GET returns `listing_star`; spot-check KPI vs filters (automation not added).
  - [x] `CLAUDE.md` / implementation plan updated for stars + KPI row.

## Status key (tracking)

- Done: [x]
- N/A for code / manual QA left: as marked above
