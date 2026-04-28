# Code Review Task
Perform comprehensive code review. Be thorough but concise.

**Application:** This repository is **nyhome** — a partner-facing apartment shortlist PWA (`/`) plus **`/admin`**, **`/admin/new`**, **`/details`**. UX and routing are described in **`CLAUDE.md`** and **`README.md`** (no alternate “modes”; treat ambiguity by reading affected files).

## Check For:

**Consistency with nyhome UX** — shortlist Views (Cards, Table, Next actions); Next actions Calendar List vs Summary/Details/Prospect density; filtering and sort behavior as documented.

**Logging** — Server-side prefers `console.log('[COMPONENT] message')` pattern where logging is needed.
**Error Handling** — Async paths handle failures; Netlify functions return sensible HTTP statuses.
**Production Readiness** — No stray debug prints, no secrets in source, no accidental TODOs left for production.
**Architecture** — Follow existing patterns:
- **Vanilla JS (frontend):** No framework, no build step. DOM in `assets/js/`.
- **Netlify Functions:** Under `netlify/functions/`; shared logic in `lib/`.
- **Database (PlanetScale):** Use `lib/db.js` for queries. Tables prefixed **`nyp_`**.
- **PWA:** `sw.js` caches shell assets; bump **`CACHE_VERSION`** with HTML `?v=` when cached assets change.
- **Email/digest:** Pipeline digest and related mailers live under `lib/` + `netlify/functions/` as in `CLAUDE.md`.

**Security:** Parameterized SQL; env vars for secrets; no auth layer yet — do not assume a public deploy without one. Escape user-controlled strings in HTML (existing helpers in `app.js` / `admin.js` / `details.js`).

**Accessibility:** Sensible focus and labels on interactive controls; readable contrast for status and calendar UI.

## Output Format

### Looks Good
- [Item 1]
- [Item 2]

### Issues Found
- **[Severity]** [[File:line](File:line)] - [Issue description]
  - Fix: [Suggested fix]

### Risk / regression
- [Note anything that could break shortlist, details, admin, or API consumers]
