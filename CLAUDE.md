# Condoos - Project Instructions

## Language
All UI text, comments, and commit messages should be in Portuguese (PT-PT) where applicable. Code identifiers (variables, functions, classes) remain in English.

## Architecture
- **Monorepo**: frontend at `src/`, backend at `backend/`
- **Backend**: Express 5 + Knex 3 (SQLite dev, PostgreSQL prod), routes in `backend/routes/`
- **Frontend**: React 19 + Vite 8 + TailwindCSS 4 + Framer Motion 12, pages in `src/pages/`
- **Icons**: Lucide React via `<Icon>` component (`src/components/shared/Icon.jsx`)
- **Typography**: Plus Jakarta Sans (self-hosted via `@fontsource-variable`)
- **Auth**: JWT with httpOnly cookies + Bearer token fallback
- **Multi-tenant**: all queries filter by `tenant_id`, passed via `x-tenant-id` header
- **Payments**: ifthenpay integration (Multibanco, MBWay, SEPA) via `backend/services/payments/`
- **Dark mode**: CSS custom properties with `[data-theme="dark"]`, managed by ThemeContext

## Quality Gates
A **pre-commit hook** (husky) enforces steps 1-3 automatically. E2E tests run in CI (GitHub Actions).

```bash
# 1. Backend tests (30 tests) — requires fresh test DB
rm -f backend/data/condoos.test.sqlite* && npm test

# 2. Frontend unit tests (66 tests) with 80% coverage threshold
npx vitest run --coverage

# 3. Production build
npx vite build

# 4. E2E tests (12 tests) — CI only, requires both servers
npx playwright test
```

### Coverage Thresholds (80% minimum)
- **Frontend**: lines, branches, functions, statements (vitest + v8)
- Enforced locally (pre-commit) and in CI (GitHub Actions)
- Backend coverage tracking planned once route test coverage increases

## Key Patterns
- **SQLite deadlocks**: see `.claude/rules/database.md`
- **Multi-tenant security**: see `.claude/rules/security.md`
- **API conventions**: see `.claude/rules/api-conventions.md`
- **Code style & design system**: see `.claude/rules/code-style.md`
