# Feature Implementation Plan

**Overall Progress:** `100%`

## TLDR
Create `nyhome`, a separate local PWA/admin app for selecting NYC apartments with your partner. It uses an intentional scroll-first card/list experience across the app, runs locally against PlanetScale during development, uses `nyp_` database tables, starts with manual apartment entry, and keeps import/scraping as a later extension.

## Critical Decisions
- Separate app/repo: `nyhome` - keeps this apartment workflow isolated from other projects.
- Stack: vanilla JS + Netlify Functions - simple local PWA with no framework build step.
- Scroll app mode: intentional vertical scrolling, card/list layout, normal scroll-mode typography, and lower cognitive load without senior-sized UI - applies across the app.
- Local development first - run with `netlify dev`; no Netlify deploy required until May 1.
- Database config: use `DATABASE_URL` pattern from `papamkt` - simpler PlanetScale setup.
- Table prefix: `nyp_` - keeps apartment data separate from other apps.
- Auth: no passwords for now - private local development only.
- Scoring: weighted criteria from both partners - supports individual and combined apartment decisions.
- Data entry: manual first - import/scraping planned after the core workflow works.

## Tasks:

- [x] 🟩 **Step 1: Create `nyhome` Project Shell**
  - [x] 🟩 Clone or create the separate `nyhome` repo.
  - [x] 🟩 Create the minimal static app + Netlify Functions structure.
  - [x] 🟩 Use `nyhome` app identifiers throughout.
  - [x] 🟩 Update package metadata, manifest, page titles, cache names, and localStorage keys.

- [x] 🟩 **Step 2: Configure Local Development**
  - [x] 🟩 Add `npm run dev` using `npx netlify dev`.
  - [x] 🟩 Add `.env.example` with `DATABASE_URL` and `APP_NAME=nyhome`.
  - [x] 🟩 Keep `.env.local` uncommitted and copy PlanetScale config from `papamkt` locally.
  - [x] 🟩 Verify app and local functions run without Netlify deployment.

- [x] 🟩 **Step 3: Define `nyp_` Database Schema**
  - [x] 🟩 Create apartments table for address, neighborhood, rent, fees, size, status, listing URL, and notes.
  - [x] 🟩 Create apartment images table.
  - [x] 🟩 Create criteria table with weights.
  - [x] 🟩 Create ratings table for both partners.
  - [x] 🟩 Create visits/applications tracking tables.
  - [x] 🟩 Add a local migration script.

- [x] 🟩 **Step 4: Build Manual Apartment Admin**
  - [x] 🟩 Create a simple admin shell.
  - [x] 🟩 Add apartment-focused sections.
  - [x] 🟩 Add create/edit apartment form.
  - [x] 🟩 Add apartment list with status, rent, neighborhood, and shortlist state.

- [x] 🟩 **Step 5: Build Apartment Card Flow**
  - [x] 🟩 Create public/local apartment card view.
  - [x] 🟩 Show photos, key facts, notes, and listing URL.
  - [x] 🟩 Add shortlist/finalist states.
  - [x] 🟩 Add compare-friendly apartment summaries.

- [x] 🟩 **Step 6: Add Partner Scoring**
  - [x] 🟩 Add criteria weights.
  - [x] 🟩 Add separate scores for each partner.
  - [x] 🟩 Calculate individual totals and combined score.
  - [x] 🟩 Show score breakdown on apartment cards and admin views.

- [x] 🟩 **Step 7: Track Visits and Applications**
  - [x] 🟩 Add visit date/time and notes.
  - [x] 🟩 Add application status tracking.
  - [x] 🟩 Add broker/contact notes.
  - [x] 🟩 Surface next actions on the dashboard.

- [x] 🟩 **Step 8: Prepare Future Import/Scraping**
  - [x] 🟩 Add listing URL field and import status fields.
  - [x] 🟩 Keep manual entry as the source of truth for v1.
  - [x] 🟩 Document a later import/scrape module without blocking core app.
