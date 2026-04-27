# Feature Implementation Plan

**Overall Progress:** `100%` (3 of 3 steps complete)

## TLDR

Reduce redundant shortlist navigation by treating **compare** (grid and table) as one mode that shares the same filters and a unified sort model: default **parity with the existing Cards “Sort by”** (same `sortForDisplay` / `nyhomeShortlistSort` behavior in both layouts), plus an explicit **Ranked** option matching today’s Finalist order (`sortForFinalist`: Avg desc, then workflow). Keep **Next actions** separate (different dataset and purpose). On **admin → Saved apartments**, add compatible sort options so the manager list can align with shortlist ordering when triaging the same records.

## Critical Decisions

- **One compare surface, two layouts** — Cards and the current “Finalist” table are the same filtered slice; do not keep them as two top-level “views” that imply different data.
- **Ranked is a sort mode, not a separate “experience”** — No standalone ranked screen; use a control (e.g. extra sort value or a toggle that applies `sortForFinalist`) next to the existing shortlist sort.
- **Parity = match Cards sort** — When the user has not chosen Ranked, table rows follow the same ordering as the card grid for the current `nyhomeShortlistSort` value.
- **Next actions unchanged in scope** — Still filtered by `passesNextActionsOmitFilters`; out of scope for this plan except ensuring it remains its own entry point.
- **Admin sort is optional alignment** — Reuse the same comparators (or a small shared module) for `/admin` Saved apartments so list order is predictable relative to the shortlist; no requirement to filter admin list like the public shortlist.

## Tasks

- [x] 🟩 **Step 1: Shortlist — unified compare + sort**
  - [x] 🟩 Refactor so **Grid | Table** (or equivalent) is one `view` mode: same `applyFilters` pipeline as today for Cards + Finalist (status filter, `apartmentPassesExtraFilters`, hide rejected/archived for this mode).
  - [x] 🟩 Table branch: sort with `sortForDisplay(visible)` when in **Parity** (current card sort); when **Ranked** is active, use `sortForFinalist(visible)` (existing functions in `app.js`).
  - [x] 🟩 Persist Ranked vs Parity: folded “ranked” into sort as an explicit `data-shortlist-sort=”ranked”` value (`nyhomeShortlistSort` localStorage key).
  - [x] 🟩 Update shell: relabelled **Finalist** tab → **Table**; mobile bottom nav now **Cards | Next actions** only; `VALID_VIEWS` and `VIEW_STORAGE_KEY` unchanged (backward-compatible).
  - [x] 🟩 Bumped `sw.js` `CACHE_VERSION` to 97 and all HTML `?v=` references.

- [x] 🟩 **Step 2: Markup, a11y, and copy**
  - [x] 🟩 `index.html`: added **Ranked** sort button; relabelled Finalist tab → **Table**; mobile nav reduced to **Cards | Next actions**; aria-label on finalist wrap now reflects active sort mode.
  - [x] 🟩 `app.css` (minimal): added `.admin-sort` layout styles; no changes to `card-list--finalist` class names.

- [x] 🟩 **Step 3: Admin — Saved apartments sort**
  - [x] 🟩 In `admin.js` `renderApartments`, after search filter, sort items via `applyAdminSort()` using shared `NyhomeShortlistSort` (extracted to `assets/js/shortlistSort.js`).
  - [x] 🟩 `admin/index.html`: compact sort control (Default | Workflow | Avg | Updated | Ranked).
  - [x] 🟩 Persist admin sort in `localStorage` (`nyhomeAdminApartmentSort`) — survives reload.

## Out of scope (not part of this plan)

- Next actions feature changes (layout, copy, or filters beyond remaining on its own tab).
- Details page, criteria tab, blacklist, stars, or image paste behavior.
- MyDay / PWA classic vs scroll mode (unrelated to this work).

## Progress legend

- 🟩 Done
- 🟨 In Progress
- 🟥 To Do

**Update the percentage at the top** when steps complete (e.g. 3 steps → ~33% per step when each main step is done).
