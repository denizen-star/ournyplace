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

**MyDay:** The loved-one app has **classic** and **scroll** modes (`CLAUDE.md`). Implementing scroll must **not** regress classic behavior; reuse shared APIs (e.g. task completion, offline queue) where possible.

## Bug Diagnosis — Always Read Application Context First
When diagnosing a bug tied to a specific application (scoring, matching, documents):
1. Read `application.yaml` in the application folder **before** writing any test code
2. Confirm `resume_id` — never assume base resume; alternate resumes have their own `skills.yaml`
3. Run tests against the **exact resume and job description** that produced the bug
4. Confirm the data source matches before drawing any conclusions