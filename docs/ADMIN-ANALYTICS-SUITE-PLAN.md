# Feature Implementation Plan: Admin Analytics tab

**Overall Progress:** `15%`  
*(Digest email already computes overlapping rollups + Pulse KPIs in `lib/pipelineDigest.js`; admin UI + JSON API not built.)*

## TLDR

Add an **Analytics** top-level tab on `/admin` that surfaces the same **classes of stats** the pipeline digest uses: Eastern-day **listing event** rollups (status/score counts, Kerv vs Peter vote rows + distinct listings), **saved-listing** touch metrics (`created_at` / `updated_at`), **status transition** histograms, and **Pulse-style** pipeline KPIs (active hunt, flagged, starred, averages, funnel buckets, tours/deadlines windows). **Same tab** also includes a full **activity log** viewer: all **`nyp_listing_events`** (status + vote) grouped by **Eastern calendar day**, **newest day first**, each day in a **collapsed card** by default with a **chevron** to expand and reveal the chronological list (listing title, time, type, summary, link to `/details`). Goal: in-app visibility without email. Start **minimal**—tables + KPI strips + collapsible day cards matching existing admin chrome; no chart library in v1 unless you add it later.

## Critical Decisions

- **Reuse digest logic, don’t fork** — Extract or export pure functions from `lib/pipelineDigest.js` (e.g. rollup, pulse metrics, apartment sheet metrics) and/or add a thin `lib/adminAnalytics.js` that takes `apartments` + optional `listingEventsRange` and returns a **JSON shape** the admin can render. One source of truth with the email.
- **Data loading** — `getApartmentPayload()` already loads full list + embedded events; **full-day events** use `fetchListingEventsBetweenCreatedAt` + `boundsForInstantInTz` (`lib/etDayBounds.js`). Analytics endpoint should use the **same** patterns; **activity log** needs a **multi-day** window (e.g. last **14** Eastern days, tunable): one SQL range query + join titles (`apartmentRepository`), then **group by `ymdET`** server-side **or** return flat rows + group in JS — prefer **server-grouped** payload `{ days: [{ ymd, events }] }` to keep response shape stable. Cap total rows (e.g. **2k**) with “older history in DB only” note if exceeded.
- **Activity UI** — **One column** of **day cards**; collapsed = summary line only (`Mon Apr 27, 2026 · 42 events`); expanded = inner list (reuse row model similar to removed digest table: time, status/score, listing, delta). Chevron rotates or swaps `›`/`∨` with `aria-expanded` + button or `<details>`/`<summary>` if acceptable for styling (chevron in summary).
- **Scope v1** — Pulse/rollup section: **today (NY)**; activity log: **last N Eastern days** (fixed N in code or query param later). No custom date pickers in v1 unless trivial.
- **No new auth** — Same as rest of nyhome; document risk if admin URL is ever public.
- **Transport** — `GET` Netlify function(s): either **one** `/api/admin-analytics` returning `{ pulse, todayRollup, transitions, activityByDay }` or split **stats** + **activity** — prefer **one round** trip for Analytics tab load. No SMTP coupling.

## Tasks

- [ ] 🟥 **Step 1: Shared stats module**
  - [ ] 🟥 Extract JSON builders from `pipelineDigest.js` (or export existing internals) so email + analytics share rollups, transition map, pulse metrics, meta fields — no duplicate SQL/math.
  - [ ] 🟥 `lib/adminAnalytics.js` (or equivalent): `buildAnalyticsPayload({ apartments, listingEventsRows, digestBounds })` → stable JSON schema; add `groupListingEventsByEasternDay(rows, timeZone)` (or SQL `DATE(CONVERT_TZ(...))` if you standardize on DB TZ — otherwise reuse `calendarDateInTz` from ms in Node).

- [ ] 🟥 **Step 2: API**
  - [ ] 🟥 `apartmentRepository`: `fetchListingEventsBetweenCreatedAt` already exists — add **`fetchListingEventsBetweenCreatedAt`** overload or **`fetchListingEventsRangeForAnalytics(start, end)`** with same join + **high limit** / streaming not required for v1.
  - [ ] 🟥 `netlify/functions/admin-analytics.js` — `GET`, load apartments payload + range of events, build grouped **activityByDay** + stats blob; return JSON + errors.
  - [ ] 🟥 `NyhomeAPI.getAdminAnalytics()` in `assets/js/api.js`.

- [ ] 🟥 **Step 3: Admin shell — Analytics tab**
  - [ ] 🟥 `admin/index.html`: fifth top tab **Analytics**; panel `#admin-analytics-panel` with two regions: `#admin-analytics-kpis` (stats) + `#admin-analytics-activity` (log).
  - [ ] 🟥 `assets/js/admin.js`: tab switch, fetch once, render KPI grid + today/transition tables; render **daily cards** (newest first) — collapsed default, **chevron** on header to toggle body; reuse existing admin CSS tokens; optional **Refresh** control.

- [ ] 🟥 **Step 4: Polish + docs**
  - [ ] 🟥 Loading / empty / error states; empty day omitted or “No logged events”.
  - [ ] 🟥 `CLAUDE.md`: Analytics tab + endpoint + activity grouping behavior + row cap.
  - [ ] 🟥 `CHANGELOG.md` under Unreleased when shipped.

### Optional (explicitly out of v1 unless you ask)

- [ ] 🟥 Date range picker + multi-day **rollup** charts
- [ ] 🟥 CSV export
- [ ] 🟥 Pagination / “load older days” beyond cap
