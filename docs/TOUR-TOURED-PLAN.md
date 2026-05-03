# Feature Implementation Plan: Tour scheduling, Toured checklist, calendar link

**Overall Progress:** `~55%` (core tour + toured + docs shipped; polish items remain)

## Implementation status (verified in repo)

**Done:** `nyp_visits` upsert + `scheduling_notes` / `toured_notes`; **`DELETE /api/visits`**: `?apartmentId=`; **`/details/toured`** + **`toured_data`** + **`PUT` errors** (`MISSING_TOURED_DATA_COLUMN`, `INVALID_TOURED_DATA`); **Tour** calendar body (**`buildCalendarEventDetails`**); **`/details` Toured tab** read-only two-column summary + link to form; **`/instructions`** HTML; **`toured.js`** tags = text input + **Add** (not full typeahead combobox yet).

**Open / differ from plan:** Rich typeahead tag UX; optional visit **clear** button in UI (API supports **DELETE**); digest “tour notes empty” may still reference legacy fields—audit **`lib/pipelineDigest.js`** when convenient.

## TLDR

Fix visit persistence so tour scheduling edits save reliably; separate **scheduling** notes from **during-tour** notes; after a **saved** valid visit time, show **Add to Google Calendar** (30-minute event, two hard-coded guests, event details linking to a standalone **toured** page). Add a **`/details/toured?id=`** page with listing summary plus a **toured** UI that feels like **fast voting**: **one scannable row per prompt**, big tap targets, **vertical Scroll-style** flow (see below)—within **nyhome’s existing look** (typography, neon accents, glass surfaces—not a theme swap). **Chips**, **“+ note”** per row where needed, and **typeahead tags**. Mirror that toured UI on **`/details`** under **Toured**. **Partner selector** at the top of the toured Scroll:**Peter** vs **Kerv**—**Peter selected by default**—so each person captures their own POV; **persist both** (`peter` and `kerv` keys, same convention as `ratings`). When square footage exists, show **gross** and **net-effective** **$/sq ft** on the summary card and in toured surfaces—no shortlist/Next actions surfacing of toured observations.

## Critical Decisions

- **Toured POV / partner selector:** UI exposes **Peter | Kerv** toggle (segmented control or pill pair); **default: Peter**. Checklist row state, per-row **“+” notes**, and **tags** are stored **per partner** so **two independent points of view** survive switching—same listing, parallel blobs keyed **`peter`** / **`kerv`** in persisted JSON (aligned with `nyp_ratings` partner keys in `lib/apartmentRepository.js`).
- **Visit row model:** Replace insert-only visits with **CRUD against one canonical visit per listing** (upsert/update/delete semantics) so users can change time and notes without duplicate or stale rows—aligned with `next_visit` usage everywhere (`lib/apartmentRepository.js`, `assets/js/details.js`, `assets/js/app.js`).
- **Scheduling vs toured notes:** Persist **two note fields** (scheduling vs during-tour) at the visit (or equivalent) layer—not a single combined textarea—minimal schema/API change beyond fixing insert-only behavior.
- **Add to Calendar:** Show **only after** a successful save that includes a **valid `visit_at`**; duration **30 minutes**; guests **`leacock.kervin@gmail.com`**, **`peterpapapetrou1@gmail.com`** (hard-coded); event **details** include absolute URL to **`/details/toured?id=<listingId>`** using **`NYHOME_PUBLIC_URL`** (or current origin fallback in dev).
- **Standalone toured URL:** **`/details/toured?id=`** as its own route/shell—not only `?tab=toured`—bundling **listing summary** + **toured** form for calendar deep links.
- **Toured content:** Persist checklist state **per listing per partner**; sections/items follow **Checklist content (factored)** below—implemented as **voting-like rows** (checkbox/tristate/chips per row), not walls of prose.
- **$/sq ft:** When **`square_feet`** is set, show **two** metrics: **gross monthly rent / sq ft** and **net effective / sq ft** (when net effective exists)—on **details summary** and **toured** UI; omit lines when inputs missing.

### UX: voting feel + “Scroll” (interaction borrow)

- **Voting-like:** Same **cognitive rhythm** as Peter/Kerv criterion rows on `/details`: **dense list**, **one decision per row**, minimal friction—here mostly **done / not done / N/A or chips** (not 0–5 unless we explicitly add a score dimension later). Optional **per-row note** behind **“+”** so the walk stays glanceable—notes **scoped to the selected partner** so **Peter’s** and **Kerv’s** answers do not overwrite each other.
- **Partner strip:** Keep the Peter/Kerv selector **sticky or always visible** at the top on scroll so switching POV stays one tap (matches mental model of partner tabs on `/details`).
- **Scroll (myDay Check-in style):** Favor a **single vertical scroll** of **section blocks** and **row stacks**—continuous column, **no wizard steps**, **no extra taps to advance screens**. Inspiration: Apple **Mindfulness / myDay**-style **Check‑in** flows that use **calm vertical paging through discrete prompts**—adapt that **interaction** (scroll, spacing, row height, feedback) while **colors, borders, and components stay nyhome-native** (`details.css` patterns, buttons, muted labels).
- **Prose policy:** Long explanations from the source memo live in **collapsible “?” / help** or **placeholder**, not inline on every row—rows stay **short labels** suitable for phone thumb reach.

---

## Checklist content (factored)

Use **stable IDs/slugs** per row in implementation; labels below are user-facing copy (trim further if needed).

### Location and exterior

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `night_weekend_noise` | Late-night / weekend noise reality (bars, sirens route?) |
| `transit_walk` | Walk to subway: entrance OK, lighting OK? |
| `scaffolding` | Scaffolding / façade work—this building or next door? |

### Kitchen and appliances

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `dishwasher_size` | Dishwasher: plates fit? (slimline vs full) |
| `dishwasher_smell` | Open dishwasher: standing water / musty smell? |
| `cooktop_type` | Gas vs induction/electric—matches preference? |

### Lighting and view

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `pov_bed_desk` | From bed/desk POV: privacy / brick wall / stare-in |
| `light_direction` | Window direction / natural light quality |
| `overhead_vs_switched` | Overhead lights vs switched outlets for lamps |

### Noise and comfort

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `window_seal` | Window closed: street noise acceptable? secondary glass? |
| `floor_squeak` | Floor squeak; hear upstairs? |
| `ac_type` | AC: central vs PTAC vs sleeve—noise/cost OK? |

### Cleanliness and building maintenance

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `hallway_sniff` | Hallways: carpets, smell, trash chute |
| `elevator_wait` | Elevator wait off-peak acceptable? |
| `refresh_vs_reno` | Baseboards/outlets: real renovation vs “refresh”? |

### Storage and space

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `closet_depth` | Closets deep enough for hangers? |
| `amenity_rooms` | Bike/storage rooms seen—usable? |
| `layout_utility` | Layout fits furniture vs raw sq ft |

### Building entrance

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `packages` | Package room vs lobby piles |
| `lobby_signal` | Lobby cleanliness / dead bulbs—management signal |

### Physical must-checks

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `water_pressure` | Shower + kitchen together—pressure & hot water delay |
| `pests` | Under-sink / baseboards—pests signs |
| `windows_all` | Every window opens, closes, seals |
| `cell_signal` | Cell signal in main rooms |

### Quick alignment (optional compact block—not scored)

| Row slug (example) | Short prompt |
|-------------------|--------------|
| `value_sqft` | Rent ÷ usable sq ft vs alternatives (see automated $/sq ft lines) |
| `days_on_market` | Why still available—broker answer satisfactory? |

**Chips / tags:** Layer **quick chips** (e.g. noise: high/medium/low) on relevant rows where it speeds capture; **typeahead** adds **free-form tags** stored **per listing per partner** (same selector scope as checklist rows).

---

## Tasks:

- [ ] 🟥 **Step 1: Schema and visit API (CRUD + split notes)**
  - [ ] 🟥 Add migration for new visit columns (scheduling notes vs during-tour notes—exact column names TBD to match repository naming), preserving existing `notes` migration path if needed.
  - [ ] 🟥 Implement **update** and **delete** (or upsert) in `lib/apartmentRepository.js` + `netlify/functions/visits.js`; stop relying on repeated `INSERT` as the only write path.
  - [ ] 🟥 Ensure `GET` apartment payload still exposes a single **`next_visit`** object with the new fields for clients (`assets/js/api.js` consumers unchanged aside from field names).

- [ ] 🟥 **Step 2: Details Tour tab — scheduling UI and calendar affordance**
  - [ ] 🟥 Split **`assets/js/details.js`** Tour form into scheduling datetime + scheduling notes + during-tour notes (labels/placement per agreed UX; minimal clicks).
  - [ ] 🟥 On successful save with valid **`visit_at`**, render **Add to Google Calendar** link (client-built `calendar.google.com` template URL: **30 min**, guests, title/body including link to **`/details/toured?id=`**).

- [ ] 🟥 **Step 3: Standalone `/details/toured` page**
  - [ ] 🟥 Add HTML entry + **`netlify.toml`** (or existing pattern) routes for **`/details/toured`** with **`?id=`** query.
  - [ ] 🟥 Reuse summary strip / listing context from details patterns; embed **toured** checklist using **Scroll-style vertical layout** + **Peter/Kerv selector (default Peter)** + voting-like rows (**Critical Decisions** / **Checklist content**).

- [ ] 🟥 **Step 4: Toured checklist, chips, tag storage**
  - [ ] 🟥 Persist checklist progress (and chips/tags) **per listing per partner** (`peter` | `kerv`)—single JSON column shape like `{ "peter": { rows…, tags: [] }, "kerv": { … } }` or equivalent; align with **`PUT /api/apartments`** / `apartmentSavePayload.js`.
  - [ ] 🟥 Add **Peter vs Kerv** selector (**default Peter**); render checklist/tags for **active partner** only; switching partners loads that POV from persisted state.
  - [ ] 🟥 Implement rows from **Checklist content (factored)**; wire saves without wizard steps; optional collapsible section chrome consistent with nyhome.
  - [ ] 🟥 Implement **typeahead combobox** for **free-form tags** (append, dedupe, persist **per partner**).

- [ ] 🟥 **Step 5: Details shell — Toured tab**
  - [ ] 🟥 Add **`/details`** tab (or accordion section on mobile) for **Toured** pointing at the **same** toured UI as standalone (**parity**; observations **only** on `/details`, not shortlist).

- [ ] 🟥 **Step 6: $/sq ft (gross + net effective)**
  - [ ] 🟥 Compute and display both **$/sq ft** lines when **`square_feet`** (and respective rent fields) allow—summary card on details + toured surfaces.

- [ ] 🟥 **Step 7: Shortlist / mobile parity**
  - [ ] 🟥 Update **`assets/js/app.js`** visit save / tour worksheet flows to use the same visit API and fields so mobile **Tour worksheet** stays consistent with split notes and CRUD.

- [ ] 🟥 **Step 8: Docs and cache/version bumps**
  - [ ] 🟥 Update **`CLAUDE.md`** (routes, tour vs toured, env URL for calendar links; brief note on toured UX pattern).
  - [ ] 🟥 Bump **`sw.js`** / HTML **`?v=`** where required by project convention after static asset changes.

---

**Note:** Pipeline digest / email copy (`lib/pipelineDigest.js`) only if an existing “tour notes empty” check needs to target the correct note field—adjust minimally when split notes land.
