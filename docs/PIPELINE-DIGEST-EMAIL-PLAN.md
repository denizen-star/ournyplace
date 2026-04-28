# Feature Implementation Plan: Pipeline digest email

**Overall Progress:** `100%`

## TLDR

One-click **pipeline digest** via `POST /api/pipeline-digest-email` (SMTP + `nodemailer`). HTML: hero, **Today** (rollup counts + status-move histogram from full-day `nyp_listing_events` query — no per-apartment 50 cap; **no** row-by-row activity table in mail), Pulse KPI table, needs attention, Top 10 (`<ol>` — browser numbers only), week bullets, signed listings. **Pastel pill** section labels (email-safe; no SVG). **Meta** JSON: `activeCount`, `attentionCount`, `topCount`, `loggedActionsToday`, `statusEventsToday`, `voteEventsToday`, `kervVotesToday`, `peterVotesToday`, `kervListingsToday`, `peterListingsToday`. Public `/details` links: Admin Settings `nyhomePublicBaseUrl` + POST `publicBaseUrl` + env `NYHOME_PUBLIC_URL`. Triggers: shortlist + Admin → Settings. **Client:** digest send OK → `NyhomeUiFeedback.showToast`; errors → in-app alert.

## Critical Decisions

- **Transport:** `nodemailer` + Netlify function — `587` TLS / `465` SSL from env.
- **Recipients:** `NYHOME_EMAIL_TO` comma-separated; **From** `NYHOME_EMAIL_FROM`.
- **Top 10 pool & sort:** Exclude `rejected`, `blacklisted`, `archived`, `signed`. Order: **`listing_star` desc** → **status workflow index desc** → **`scores.combined` desc (nulls last)** → `updated_at`.
- **Active count** (Pulse): excludes same terminals **and** `signed`.
- **Needs attention:** `DEFAULT_ATTENTION` in `lib/pipelineDigest.js` (deadlines, tours, stale statuses, etc.).
- **Today window:** `lib/etDayBounds.js` `boundsForInstantInTz(now, 'America/New_York')`; `lib/apartmentRepository.js` `fetchListingEventsBetweenCreatedAt`.
- **Auth:** None — see `CLAUDE.md` if endpoint is exposed.

## Tasks

- [x] **Step 1: Server digest + SMTP** — `nodemailer`, `lib/pipelineDigest.js`, `netlify/functions/pipeline-digest-email.js`
- [x] **Step 2: Client API** — `NyhomeAPI.sendPipelineDigestEmail` (`assets/js/api.js`)
- [x] **Step 3: Admin Settings** — public URL + Send digest (`admin/index.html`, `admin.js`)
- [x] **Step 4: Shortlist triggers** — hero + filters drawer (`app.js`, `index.html`)
- [x] **Step 5: Docs & env** — `.env.example`, `CLAUDE.md`, cache bump when shell assets change

## Optional follow-ups

- Harden `POST` (secret / auth) if not strictly private.
- Env-tunable attention thresholds.
- Scheduled send (Netlify cron).
