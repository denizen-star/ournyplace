# Feature Implementation Plan: Admin Analytics tab

**Overall Progress:** `100%`  
*(Shipped: shared analytics module, GET API endpoint, Analytics tab with Pulse KPIs + collapsible activity log, docs.)*

## TLDR

Add an **Analytics** top-level tab on `/admin` that surfaces the same **classes of stats** the pipeline digest uses: Eastern-day **listing event** rollups (status/score counts, Kerv vs Peter vote rows + distinct listings), **saved-listing** touch metrics (`created_at` / `updated_at`), **status transition** histograms, and **Pulse-style** pipeline KPIs (active hunt, flagged, starred, averages, funnel buckets, tours/deadlines windows). **Same tab** also includes a full **activity log** viewer: all **`nyp_listing_events`** (status + vote) grouped by **Eastern calendar day**, **newest day first**, each day in a **collapsed card** by default with a **chevron** to expand and reveal the chronological list (listing title, time, type, summary, link to `/details`). Goal: in-app visibility without email. Start **minimal**—tables + KPI strips + collapsible day cards matching existing admin chrome; no chart library in v1 unless you add it later.

## Critical Decisions

- **Reuse digest logic, don't fork** — Extract or export pure functions from `lib/pipelineDigest.js` (e.g. rollup, pulse metrics, apartment sheet metrics) and/or add a thin `lib/adminAnalytics.js` that takes `apartments` + optional `listingEventsRange` and returns a **JSON shape** the admin can render. One source of truth with the email.
- **Data loading** — `getApartmentPayload()` already loads full list + embedded events; **full-day events** use `fetchListingEventsBetweenCreatedAt` + `boundsForInstantInTz` (`lib/etDayBounds.js`). Analytics endpoint should use the **same** patterns; **activity log** needs a **multi-day** window (e.g. last **14** Eastern days, tunable): one SQL range query + join titles (`apartmentRepository`), then **group by `ymdET`** server-side **or** return flat rows + group in JS — prefer **server-grouped** payload `{ days: [{ ymd, events }] }` to keep response shape stable. Cap total rows (e.g. **2k**) with "older history in DB only" note if exceeded.
- **Activity UI** — **One column** of **day cards**; collapsed = summary line only (`Mon Apr 27, 2026 · 42 events`); expanded = inner list (reuse row model similar to removed digest table: time, status/score, listing, delta). Chevron rotates or swaps `›`/`∨` with `aria-expanded` + button or `<details>`/`<summary>` if acceptable for styling (chevron in summary).
- **Scope v1** — Pulse/rollup section: **today (NY)**; activity log: **last N Eastern days** (fixed N in code or query param later). No custom date pickers in v1 unless trivial.
- **No new auth** — Same as rest of nyhome; document risk if admin URL is ever public.
- **Transport** — `GET` Netlify function(s): either **one** `/api/admin-analytics` returning `{ pulse, todayRollup, transitions, activityByDay }` or split **stats** + **activity** — prefer **one round** trip for Analytics tab load. No SMTP coupling.

## Tasks

- [x] ✅ **Step 1: Shared stats module**
  - [x] ✅ Export pure functions from `pipelineDigest.js` (`rollupFlatListingEvents`, `buildPulseMetrics`, `collectAttention`, `dedupeAttention`, `dbListingEventRowToFlat`, `calendarDateInTz`, etc.) so email + analytics share rollups — no duplicate SQL/math.
  - [x] ✅ `lib/adminAnalytics.js`: `buildAnalyticsPayload({ apartments, listingEventsRows, digestBounds })` → `{ pulse, todayRollup, transitions, activityByDay, capped }`; `groupListingEventsByEasternDay(rows, tz)` groups flat rows into `[{ ymd, label, count, events }]` newest-day-first; `ACTIVITY_LOG_DAYS = 14`, `ACTIVITY_ROW_CAP = 2000`.

- [x] ✅ **Step 2: API**
  - [x] ✅ `apartmentRepository`: existing `fetchListingEventsBetweenCreatedAt(start, end)` reused as-is — correct join + no per-apt cap.
  - [x] ✅ `netlify/functions/admin-analytics.js` — `GET /api/admin-analytics`: loads apartments + last 14 ET days of events; calls `buildAnalyticsPayload`; returns JSON; activity query failure non-fatal.
  - [x] ✅ `NyhomeAPI.getAdminAnalytics()` in `assets/js/api.js`.

- [x] ✅ **Step 3: Admin shell — Analytics tab**
  - [x] ✅ `admin/index.html`: fifth top tab **Analytics**; panel `#tab-analytics` with `#admin-analytics-kpis` (pulse + today rollup + transitions + attention) + `#admin-analytics-activity` (collapsible day cards); scoped `<style>` block for analytics CSS tokens.
  - [x] ✅ `assets/js/admin.js`: lazy fetch on first tab click (`state.adminAnalyticsFetched`); `renderAnalyticsKpis` + `renderAnalyticsActivity`; collapsed day cards using `<details>`/`<summary>` with rotating chevron; **Refresh** button; loading / error / empty states.

- [x] ✅ **Step 4: Polish + docs**
  - [x] ✅ Loading / empty / error states implemented; days with no events omitted from activity (server-side filtering); row cap banner when exceeded.
  - [x] ✅ `CLAUDE.md`: Analytics tab + endpoint + activity grouping behavior + row cap documented.
  - [x] ✅ `CHANGELOG.md` Unreleased entry added.

### Optional (explicitly out of v1 unless you ask)

- [ ] 🟥 Date range picker + multi-day **rollup** charts
- [ ] 🟥 CSV export
- [ ] 🟥 Pagination / "load older days" beyond cap
