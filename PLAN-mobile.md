# Feature Implementation Plan — Mobile Layout

**Overall Progress:** `0%`

---

## TLDR
Add a mobile-first responsive layer to nyhome via media queries and targeted JS additions. No new pages or routes — all changes land in `app.css`, `app.js`, `details.js`. The result: a bottom-nav shortlist, condensed Finalist table with inline expand, collapsible Next Actions toolbar with a focused Tour Screen, accordion-style Details tabs, and a Duplicate button on every card.

---

## Critical Decisions

- **Media query breakpoint:** `≤ 640px` — matches the app's existing lowest breakpoint
- **Bottom nav replaces view switcher on mobile:** The existing `.shortlist-view` segment is hidden; a new sticky `<nav>` is injected by `app.js` and mirrors the same view-switching logic
- **`setView(mode)` extracted:** The existing inline view-switch logic is extracted to a named function, enabling the bottom nav and the existing segment control to share the same code path
- **Finalist expand is pure JS:** Tap adds `.finalist-row--expanded` and injects a sibling `.finalist-mobile-expanded` block; one row open at a time
- **Details accordion replaces tabs on mobile:** `render()` in `details.js` branches on `isMobile()`; all section content renders eagerly; all `bind*` functions are called at once via `bindAllMobilePanels()`
- **Tour Screen is a `position:fixed` overlay:** Injected into `document.body`, removed on back/save
- **Duplicate reuses existing POST `/api/apartments`:** Build payload with `apartmentToSavePayload`, delete `payload.id`, POST; redirect to `/details/?id=NEW&tab=unit`
- **Prospect density hidden on mobile via CSS:** `[data-na-cal-density="prospect"]` gets `display:none` at ≤ 640px; JS falls back from stored `prospect` to `details` on mobile

---

## Tasks

- [ ] 🟥 **Step 1: CSS foundation — mobile shell & bottom nav styles**
  - [ ] 🟥 Append mobile CSS block to `app.css`: `.m-bottom-nav` fixed position + safe-area-inset
  - [ ] 🟥 Hide `.shortlist-view` + `.app-header-actions--in-hero` on mobile
  - [ ] 🟥 Sort segment → scrollable chips on mobile
  - [ ] 🟥 Finalist column override: 3-col grid, `min-width:0`, hide specific columns
  - [ ] 🟥 Duplicate button base style (hidden on desktop)
  - [ ] 🟥 Next Actions toolbar collapsible + Tour Screen overlay styles
  - [ ] 🟥 Mobile accordion + summary card styles for details page

- [ ] 🟥 **Step 2: Bottom nav bar — JS injection & wiring**
  - [ ] 🟥 Extract `setView(mode)` from `initShortlistView` in `app.js`
  - [ ] 🟥 Add `syncMobileNav()` + call from `syncShortlistViewUi()`
  - [ ] 🟥 Add `initMobileBottomNav()` + call from `boot()`

- [ ] 🟥 **Step 3: Cards — duplicate button markup**
  - [ ] 🟥 Add `apt-dup-btn` button to `renderActions()` in `app.js`
  - [ ] 🟥 Add `wireCardActions()` + call after cards render in `applyFilters()`

- [ ] 🟥 **Step 4: Duplicate feature — modal + API**
  - [ ] 🟥 Add `showDuplicateSheet()`, `renderDuplicateSheetHtml()`, `closeDuplicateSheet()`, `confirmDuplicate()` to `app.js`
  - [ ] 🟥 Add duplicate sheet CSS (bottom sheet overlay)
  - [ ] 🟥 Add duplicate button + sheet logic to `details.js` summary card

- [ ] 🟥 **Step 5: Finalist mobile — condensed table + inline expand**
  - [ ] 🟥 Add `data-finalist-col` attributes to `buildFinalistRowInnerHtml()` and header in `renderFinalistList()`
  - [ ] 🟥 Add `data-finalist-id` to row `<a>` elements
  - [ ] 🟥 Add `wireFinalistMobileExpand()` + `buildFinalistExpandHtml()` to `app.js`
  - [ ] 🟥 Call `wireFinalistMobileExpand()` from `renderFinalistList()`

- [ ] 🟥 **Step 6: Next Actions toolbar — collapsible + hide Prospect**
  - [ ] 🟥 Add `.na-mobile-toolbar-toggle` button to `renderNextActionsToolbarHtml()`
  - [ ] 🟥 Add `wireToolbarToggle()` + call from `wireNextActionsChrome()`
  - [ ] 🟥 Fall back from `prospect` to `details` on mobile in `initNextActionsPrefs()`

- [ ] 🟥 **Step 7: Tour Screen overlay**
  - [ ] 🟥 Add `m-tour-screen-btn` to `renderNextActionsEventBlock()` (Details density only)
  - [ ] 🟥 Add `showTourScreen()`, `closeTourScreen()`, `renderTourScreenHtml()`, `saveTourScreenData()` to `app.js`
  - [ ] 🟥 Wire tour screen buttons in `wireNextActionsChrome()`

- [ ] 🟥 **Step 8: Details page — accordion on mobile**
  - [ ] 🟥 Add `isMobile()` and `getInitialTab()` helpers to `details.js`
  - [ ] 🟥 Branch `render()` on `isMobile()` → `renderMobileAccordion()`
  - [ ] 🟥 Add `renderMobileAccordion()` + `renderMobileSummaryCard()` to `details.js`
  - [ ] 🟥 Add `bindMobileAccordion()`, `bindMobileSummaryExpand()`, `bindAllMobilePanels()` to `details.js`
  - [ ] 🟥 Handle `?tab=` URL param via `getInitialTab()`

- [ ] 🟥 **Step 9: Cache version bump**
  - [ ] 🟥 Increment `CACHE_VERSION` in `sw.js` (88 → 89)
  - [ ] 🟥 Update `?v=88` → `?v=89` in all four HTML files
