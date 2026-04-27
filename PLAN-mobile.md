# Mobile layout plan — implementation status

**Overall progress:** ~**90%** shipped. Primary breakpoint in code/CSS is **`max-width: 720px`** (`MOBILE_WIDTH_MAX` / `MOBILE_DETAIL_MAX`), not 640px — treat “mobile” as **≤720px** below.

**Implementation order:** Steps 1→2→3 unlock bottom nav + cards. 4→5 duplicate + finalist. 6→7 next actions. 8 details. 9 cache (re-bump whenever shell assets change).

---

## Critical decisions (as built)

- **Breakpoint:** `720px` — `app.js` `isShortlistMobile()`, `details.js` `isDetailsMobile()`, main `@media` block in `app.css` (comment: “MOBILE LAYOUT (≤ 720 px)”).
- **Bottom nav:** Injected on `document.body` (not strictly `.page-shell` parent); `syncShortlistViewUi()` updates header tabs (if visible) **and** `.m-nav-btn`.
- **Sort (Cards):** Collapsible **Sort by** row + chip row (`#shortlist-sort-mobile-toggle`, `#shortlist-sort-panel`), not only a hidden label.
- **Prospect (NA):** At mobile, **`[data-na-cal-density="prospect"]`** toolbar control **hidden** via CSS. **`initNextActionsPrefs()`** no longer forces `prospect` → `details` (stored density can stay `prospect`; UI may still hide the button — verify product intent).
- **Tour worksheet:** Overlay saves **tour visit notes** via `NyhomeAPI.saveVisit`; body reuses `nextActionsListingSpecStrip(apt)` (not a full bespoke “all financials as `<input>`” form). Label on calendar: **“Tour worksheet”** (not “Open tour screen →”).
- **Details accordion:** **Multi-open** — each section toggles independently (`bindMobileAccordion`).

---

## Tasks

### Step 1: CSS foundation — mobile shell & bottom nav

- [x] **`@media (max-width: 720px)`** in `app.css`: `.m-bottom-nav` fixed bottom, `safe-area-inset-bottom`, 3-column grid, `.m-nav-btn--active`
- [x] Hide **`.shortlist-view`** and **`.app-header-actions--in-hero`** on mobile
- [x] Sort: horizontal chip row + mobile-only collapsible wrapper (see `shortlist-sort-mobile-toggle` / `shortlist-sort-panel`)
- [x] **`body.shortlist .page-shell`** `padding-bottom` so list clears nav (~68px + safe area)
- [x] Related: filters FAB position above nav, dup sheet + tour overlay styles

### Step 2: Bottom nav bar — JS injection & wiring

- [x] `initMobileBottomNav()` on `DOMContentLoaded` (`boot()`): `<nav class="m-bottom-nav" id="nyhome-mobile-bottom-nav">` with Cards | Finalist | Next actions
- [x] Clicks call **`setShortlistView`** (same as header segment)
- [x] **`syncShortlistViewUi()`** updates `.shortlist-view-btn` **and** `.m-nav-btn` active / `aria-current`

### Step 3: Cards view mobile styles

- [x] **`.card-list`** single column at **720px** (`@media (max-width: 720px)` block)
- [x] **Duplicate** in **`renderActions()`** → `.apt-dup-btn`; **desktop:** `display: none` until mobile breakpoint CSS shows it
- [x] **`wireCardDupButtons()`** after cards render; opens bottom sheet

### Step 4: Duplicate feature — modal + API

- [x] **`showDuplicateSheet`**, sheet HTML, **`confirmDuplicateFromSheet`**: new unit via **`NyhomeApartmentPayload.apartmentToSavePayload(apt, { aptNumber })`**, **`delete payload.id`**, POST through **`NyhomeSaveWorkflow.saveApartmentRespectingBlacklist`**, redirect **`/details/?id=…&tab=unit`**
- [ ] **Optional floor field** — not implemented (plan-only)
- [x] **Details** mobile summary: **Duplicate** + **`showDetailsDuplicateSheet`** / **`confirmDetailsDuplicateFromSheet`**
- [x] **`getTabFromUrl()`** + **`load()`** / **`renderMobileDetailPage`** respect **`?tab=unit`** (and other tabs)

### Step 5: Finalist mobile — condensed table + inline expand

- [x] **≤720px:** `.shortlist-finalist-cols` → **3 columns** (ord · place · avg), **`min-width: 0`** (drops desktop `56rem` table width)
- [x] Hide **rent, net, move, bed, kerv, peter, status** columns via **`[data-finalist-col]`**
- [x] **`renderFinalistList`:** clusters + **`data-finalist-id`**, **`data-finalist-col`** on headers/cells
- [x] **`wireFinalistMobileExpand()`:** toggles expand, injects **`.finalist-mobile-expanded`** with thumbs, stats, Details link

### Step 6: Next Actions toolbar — collapsible + hide Prospect

- [x] **`renderNextActionsToolbarHtml`:** **`.na-mobile-toolbar-toggle`** + collapsible **`.shortlist-next-actions-toolbar-row`**
- [x] **`wireNAToolbarToggle()`** (mobile: row starts collapsed)
- [x] **≤720px:** hide **Prospect** density control — **`body.shortlist [data-na-cal-density="prospect"] { display: none }`** (see `app.css`)
- [ ] **`initNextActionsPrefs()`** `prospect` → `details` when ≤720 — **removed** in current code; reinstate if product wants density fallback

### Step 7: Tour screen overlay

- [x] **`renderNextActionsEventBlock`:** **`.m-tour-screen-btn`** for **calendar + Details + tour** rows (not “Notes section” wording; button after block content)
- [x] **`showTourScreen`**, **`renderTourScreenHtml`**, **`closeTourScreen`**, **`saveTourScreenNotes`** (`saveVisit` + refresh + close)
- [x] Back / Close and overlay backdrop wiring
- [ ] **Escape** closes tour overlay — not wired globally (only Back / Close buttons)
- [ ] Full spec: **editable financials as native inputs** + checklist toggles in overlay — **partial** (strip + notes; not full inline-edit apartment PUT from worksheet)

### Step 8: Details page — accordion on mobile

- [x] **`isDetailsMobile()`** / **`MOBILE_DETAIL_MAX = 720`**
- [x] **`render()`** → **`renderMobileDetailPage`** when narrow
- [x] **Accordion** sections: Scorecard, Images, Unit Setup, Peter, Kerv, Tour, Application, Activity; **`renderMobileAccordionSection`**
- [x] **Multi-open** accordion toggles
- [x] **Compact summary** + **Show more** / **Show less** expander; status progression + **Reject** + **Duplicate**
- [x] **≤720px CSS:** hide tab header chrome where applicable; **`.mobile-accordion-*`** styles; **`#detail-root`** fixes for **`.summary-tab-content`** on accordion bodies

### Step 9: Cache version bump

- [x] Process in place: **`CACHE_VERSION`** in **`sw.js`** + matching **`?v=`** on shell **`index.html`**, **`details/index.html`**, **`admin/index.html`**, **`admin/new/index.html`**
- [x] **Current** (as of last bump in repo): **91** — increment again whenever you change cached JS/CSS

---

## Follow-ups (not in original 9 steps)

- Next actions **Summary** calendar: time strip **stacked above** listing card (all widths for Summary density).
- **`listingStar.js`**: not part of this plan; see `docs/LISTING-STAR-AND-KPI-REIMPLEMENTATION-PLAN.md`.

---

## Quick verify checklist

1. **≤720px:** bottom nav switches Cards / Finalist / Next actions; header VIEW hidden.
2. **Cards:** Duplicate opens sheet; POST new id → details `?tab=unit`.
3. **Finalist:** tap row expands inline card.
4. **Next actions:** toolbar toggle; Prospect control hidden on mobile; tour **Tour worksheet** opens overlay; notes save.
5. **Details:** accordion + `?tab=`; Duplicate from summary.
6. After any shell change: **bump `CACHE_VERSION` + all `?v=`**.
