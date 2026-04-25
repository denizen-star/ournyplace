# Code Review Task
Perform comprehensive code review. Be thorough but concise.

**Loved-one UI context:** MyDay has **classic** (non-scrollable, original rules) and **scroll** (vertical card list, scroll-only tokens). See `CLAUDE.md` Key Constraints and `docs/SCROLL-MODE-IMPLEMENTATION-PLAN.md`. Judge the PR against the **mode it touches**; loved-one changes should consider **both** modes for consistency unless explicitly single-mode.

## Check For:

**UX Contract** — Mom-facing screens: comply with `Myday Design.md` **and** the correct mode in `CLAUDE.md`:

**Both modes:** No swipe/long-press/double-tap for core flows; no spinners; errors never shown to Mom; linear forward flow (no Back).

**Classic loved-one mode:** 60px+ touch targets; **no scrolling** on task views; no pop-ups; full-screen transitions; 24pt+ body, 32pt+ headers.

**Scroll loved-one mode:** Vertical scrolling allowed; scroll-only layout/typography (not classic’s no-scroll/24pt-everywhere); inline/card feedback (no error pop-ups); still no spinners for Mom.

**Logging** - Server-side uses `console.log('[COMPONENT] message')` pattern; no raw untagged logs
**Error Handling** - Try-catch for all async functions; Netlify functions return proper HTTP status codes
**Production Readiness** - No debug statements, no TODOs, no hardcoded secrets or credentials
**Architecture** - Follows existing patterns:
- **Vanilla JS (frontend):** No framework, no build step. DOM manipulation only. Modules in `assets/js/`.
- **Netlify Functions:** Each function is self-contained. Shared DB/email logic imported from `lib/`.
- **Database (PlanetScale):** Use `lib/db.js` for all queries. No raw SQL outside that file. All tables prefixed `md_`.
- **PWA:** Service Worker in `sw.js` pre-caches all assets. No network-dependent rendering for Mom-facing screens.
- **Email:** All email sending through `lib/emailService.js`. Templates in `lib/emailTemplates.js`.
**Security:** No SQL injection -- use parameterized queries. Env vars for all secrets. Admin routes check `ADMIN_PASSWORD`. No user-supplied data rendered unescaped into HTML.
**Accessibility:** High-contrast color palette (Forest Green #228B22, Safety Orange #FF8C00, Navy headers). Temporal color coding must match time block.

## Output Format

### Looks Good
- [Item 1]
- [Item 2]

### Issues Found
- **[Severity]** [[File:line](File:line)] - [Issue description]
  - Fix: [Suggested fix]

### UX Compliance
- [Pass/Fail] Touch targets appropriate for mode (classic: >= 60px where applicable)
- [Pass/Fail] Classic: no scrolling on task views | Scroll: scrolling only where scroll mode is implemented (not a bug)
- [Pass/Fail] No spinners or loading states (Mom-facing)
- [Pass/Fail] No error messages shown to user
- [Pass/Fail] Linear flow (no back navigation)
- [Pass/Fail] If loved-one UI changed: both classic and scroll considered, or scope stated

### Summary
- Files reviewed: X
- Critical issues: X
- Warnings: X

## Severity Levels
- **CRITICAL** - Security, data loss, crashes, UX contract violation (Mom sees an error/spinner/gets stuck)
- **HIGH** - Bugs, performance issues, bad UX
- **MEDIUM** - Code quality, maintainability
- **LOW** - Style, minor improvements
