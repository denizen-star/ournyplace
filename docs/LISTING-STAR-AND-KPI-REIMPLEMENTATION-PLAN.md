# Feature Implementation Plan: Listing Stars + Pipeline KPIs

**Overall Progress:** ~45% — Steps **1–4** (migration → module) **done**; **5–9** (UI, KPI row, CSS, details/admin scripts, SW) **open**; **10** partial (docs yes, E2E star cycle pending).

## TLDR

Re-add **database-backed listing stars** (cycle: off → Peter → Kerv → both → off) with **click-to-cycle only on shortlist Cards**, **read-only star icons beside listing titles** everywhere else, a **Star sort** on Cards, and replace the shortlist summary strip with **five pipeline KPI tiles** matching the filter drawer groups (Discovery & shortlist through Closed).

**Landed:** `listing_star` column + `safeAlter` migrate; API + repository + `apartmentSavePayload`; `NyhomeListingStar` in `listingStar.js` (`normalizeTier`, `tierLabel`, `cycleDbValue`, `displayHtml`, `buttonHtml`, internal `starSvg`); `admin.js` `readApartmentForm` + conditional `displayHtml` in list titles. **Next:** load `listingStar.js` from HTML shells; `app.js` sort/cycle + finalist/NA; KPI row; `app.css` star/KPI; `details.js` + `buildApartmentPayload`; `sw.js` + `?v=`.

## Critical Decisions

- **Persistence:** `listing_star` on `nyp_apartments` (`NULL` or `1`–`3`), not `localStorage`, so all clients see the same state.
- **Interaction:** Star **button** only on **Cards**; finalist, next actions, details, admin show **display-only** stars (no nested `<button>` inside finalist row link issues avoided by keeping star non-interactive there).
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

- [x] **Step 4: `listingStar.js` module** *(partial: file only)*
  - [x] `assets/js/listingStar.js`: `NyhomeListingStar` — `normalizeTier`, `cycleDbValue`, `tierLabel`, `displayHtml`, `buttonHtml`, inline `starSvg` path **style** for tiers 0–3.
  - [ ] Load `<script src="/assets/js/listingStar.js?v=…">` before dependent bundles on **index**, **details**, **admin**, **admin/new** (not wired yet).

- [ ] **Step 5: Shortlist (`app.js` + `index.html`)**
  - [ ] `VALID_SORTS` + `sortForDisplay`: `star` mode + `compareListingStarSort` (tier desc, then `compareWorkflowDesc`).
  - [ ] `index.html`: “Star” sort control; script tag for `listingStar.js`.
  - [ ] `renderApartmentCard`: title row = `buttonHtml` + title text; `wireCardListingStars` after card render — `saveApartment(apartmentToSavePayload(apt, { listingStar }))` then `getApartments` + `render`.
  - [ ] Finalist `buildFinalistRowInnerHtml`: prepend `displayHtml(apartment)` in place row.
  - [ ] Next actions list row + calendar `renderNextActionsEventBlock`: star before title; print TOC listing cell: star + title.
  - [ ] `renderSummary`: five `summary-card summary-kpi summary-kpi--{groupId}` tiles from `NyhomeStatusFilterGroups.GROUPS` counts (remove old four-card summary).

- [ ] **Step 6: Styles (`app.css`)**
  - [ ] Listing star: wrap, button reset, tier classes (optional backup to inline paint).
  - [ ] Title row flex: `.apartment-title-inner`, `.manager-row-title-inner`, `.apartment-title-text`, `.manager-row-title-text`.
  - [ ] Shortlist KPI: replace nth-child summary hacks with `.summary-kpi--discovery|tours|finalist|application|closed` border/glow + label typography.
  - [ ] `body.shortlist .shortlist-next-actions-main`: `align-items: center` (align star with title).
  - [ ] Print TOC: `.shortlist-na-toc-titlecell` flex for star + title.

- [ ] **Step 7: Details page**
  - [ ] `details/index.html`: include `listingStar.js`.
  - [ ] `details.js`: summary header title row with `displayHtml`; `buildApartmentPayload` includes `listingStar` from `state.apartment.listing_star`.

- [ ] **Step 8: Admin** *(code partial)*
  - [x] `admin.js`: `readApartmentForm` resolves `listingStar` from loaded row; `renderAdminApartment` prepends `NyhomeListingStar.displayHtml(apartment)` when global exists.
  - [ ] `admin/index.html` and `admin/new/index.html`: script `listingStar.js` before payload/admin.

- [ ] **Step 9: PWA cache**
  - [ ] `sw.js`: `CACHE_VERSION` bump; add `listingStar.js` to `APP_SHELL` once shortlist/admin loads it.
  - [ ] Bump `?v=` on all shell HTML that adds `listingStar.js` so cache matches (same bump as `CACHE_VERSION`).

- [ ] **Step 10: Verify**
  - [ ] Run `npm run migrate` locally; cycle star on a card; confirm GET returns `listing_star`; confirm KPI counts match manual filter-group expectations (blocked until Step 5–7).
  - [x] `CLAUDE.md` / `CHANGELOG`: `listing_star` + migrate noted.
