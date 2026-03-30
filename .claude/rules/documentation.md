# Documentation Maintenance

## Golden Rule

When you modify source files, **update the corresponding documentation in the same commit**. Documentation is not a follow-up task — it's part of the change.

## Source → Documentation Map

When you change files in these areas, update the listed docs:

| Source area changed | Update these docs |
|--------------------|--------------------|
| `package.json` (dependency versions) | Root `CLAUDE.md` (Architecture section) |
| `backend/migrations/` (add/rename) | `backend/CLAUDE.md` (Migrations section) |
| `backend/routes/` (add/rename files) | `backend/CLAUDE.md` (Estrutura), `.claude/rules/api-conventions.md` |
| `backend/services/` (add/rename) | `backend/CLAUDE.md` (Estrutura) |
| `backend/config.js` (new env vars) | `backend/CLAUDE.md` (config.js section) |
| `backend/seeds/` (rename/restructure) | `backend/CLAUDE.md` (Seeds), `.claude/rules/database.md` |
| `backend/auth.js` or `backend/rbac.js` | `.claude/rules/security.md`, `.claude/rules/api-conventions.md` |
| `src/components/shared/` (add/remove) | `src/CLAUDE.md` (components/shared list) |
| `src/contexts/` (add/remove) | `src/CLAUDE.md` (contexts list) |
| `src/features/` (add/remove) | `src/CLAUDE.md` (features list) |
| `src/hooks/` (restructure) | `src/CLAUDE.md` (hooks section) |
| `src/pages/` (add/remove) | `src/CLAUDE.md` (pages list) |
| `src/index.css` (brand tokens) | `.claude/rules/code-style.md` (Brand Tokens) |
| `tests/ui/helpers/` (add/rename) | `tests/CLAUDE.md` (Helpers section) |
| `tests/ui/*.spec.js` (add/remove tests) | `tests/CLAUDE.md` (Suites table — E2E count), Root `CLAUDE.md` |
| `playwright.config.js` | `tests/CLAUDE.md` (E2E config) |
| `.github/workflows/ci.yml` | `.claude/rules/git-workflow.md` (CI Pipeline) |
| Any new `.claude/rules/*.md` | Root `CLAUDE.md` (Key Patterns section) |

## What to Update

When updating documentation:
- **Counts**: test counts, migration counts, component counts
- **Filenames**: actual names on disk, not assumed/remembered names
- **Line counts**: only update if significantly different (±200 lines)
- **Version numbers**: match `package.json` exactly
- **Hex values / tokens**: copy from source CSS, never from memory

## Verification Habit

Before committing, mentally check:
1. Did I add/remove/rename any files? → Update the relevant CLAUDE.md file list
2. Did I change a dependency version? → Update root CLAUDE.md
3. Did I add/remove tests? → Update test counts in tests/CLAUDE.md and root CLAUDE.md
4. Did I change CSS tokens or design system? → Update code-style.md
