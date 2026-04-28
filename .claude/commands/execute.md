Now implement precisely as planned, in full.

Implementation Requirements:

- Write elegant, minimal, modular code.
- Adhere strictly to existing code patterns, conventions, and best practices.
- Include thorough, clear comments/documentation within the code.
- As you implement each step:
  - Update the markdown tracking document with emoji status and overall progress percentage dynamically.
-Chunk your work to avoid hallucinations or memeory limits

## DRY — Don't Repeat Yourself
- Extract any logic used more than once into a shared function, class, or module
- Never duplicate business logic across files or services
- Reuse existing utilities before writing new ones

## Modular and Reusable Design
- Each function or class must have a single, clear responsibility
- Write functions that can be reused across the codebase without modification
- Prefer composition over duplication

## Keep It Simple
- Choose the simplest solution that correctly solves the problem
- Do not over-engineer or add abstractions that are not immediately needed
- If a solution feels complex, it probably is — step back and simplify

## Do Not Break Working Functionality
- Before modifying any existing code, understand what it currently does and what depends on it
- Do not refactor or restructure working code unless explicitly asked to
- Changes must be scoped to what is required — avoid unrelated edits
- If a change risks breaking existing behavior, flag it before proceeding

**nyhome:** Follow **`CLAUDE.md`** for routes, shortlist views, and API shape. Keep changes scoped; do not invent tables or env vars outside existing patterns.

## Bug Diagnosis — Read Real Data First
When reproducing a data bug (listings, visits, ratings):
1. Trace the code path from UI → `NyhomeAPI` / fetch → handler in `netlify/functions/`.
2. Confirm IDs and payloads (apartment id, timestamps) match what the UI sends.
3. Prefer a minimal repro against local `netlify dev` before changing shared helpers.