# Condoos - Project Instructions

## Language
All UI text, comments, and commit messages should be in Portuguese (PT-PT) where applicable. Code identifiers (variables, functions, classes) remain in English.

## Test Commands
Before every commit or push, run ALL test suites and verify the build:

```bash
# 1. Backend integration tests (30 tests) — requires fresh test DB
rm -f backend/data/condoos.test.sqlite* && npm test

# 2. Frontend unit tests (58 tests)
npx vitest run

# 3. Production build verification
npx vite build

# 4. Playwright E2E tests (12 tests) — requires both servers running
npx playwright test
```

All four must pass (or only have known pre-existing failures) before committing.

### Known Pre-existing Failures
- `workflows.spec.js` > "finance flow allows receipt download in pdf" — fails because the seed tenant has 0 fractions/charges, so no receipts exist to download. This is a seed data gap, not a code issue.

## Architecture
- **Monorepo**: frontend at `src/`, backend at `backend/`
- **Backend**: Express + Knex.js (SQLite dev, PostgreSQL prod), routes in `backend/routes/`
- **Frontend**: React 18 + Vite + TailwindCSS, pages in `src/pages/`
- **Auth**: JWT with httpOnly cookies + Bearer token fallback
- **Multi-tenant**: all queries filter by `tenant_id`, passed via `x-tenant-id` header

## Critical Patterns
- **SQLite deadlocks**: functions called inside `knex.transaction()` MUST use the `trx` object, not `getKnex()`. Pass `db` parameter: `async function foo(tenantId, id, db = null) { const knex = db || getKnex(); ... }`
- **Test DB cleanup**: delete `backend/data/condoos.test.sqlite*` (all 3 files: .sqlite, .sqlite-shm, .sqlite-wal) when tests fail due to stale data
- **WCAG contrast**: `--muted` color must maintain >= 4.5:1 contrast ratio against `--bg` and `--surface` backgrounds
