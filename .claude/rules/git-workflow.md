# Git Workflow

## Commit Messages
- Language: Portuguese (PT-PT)
- Format: imperative mood, concise (e.g., "Corrige deadlock na criação de pagamentos")
- Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` when AI-assisted

## Branches
- `main` — Production (auto-deploys to Vercel)
- Feature branches: `feature/descricao-curta`
- Fix branches: `fix/descricao-curta`

## Pre-commit Hook (Husky)
Runs automatically on every commit:
1. `rm -f backend/data/condoos.test.sqlite* && npm test` — Backend tests
2. `npx vitest run --coverage` — Frontend tests + 80% coverage
3. `npx vite build` — Production build check

If the hook fails, the commit is blocked. Fix the issue and create a **new** commit — never `--amend` to the previous commit after a hook failure.

## CI Pipeline (GitHub Actions)
Triggers on push to `main` and pull requests:
1. All pre-commit checks
2. E2E Playwright tests (starts both servers)
3. Deploys to Vercel on `main` push

## Deployment
- Vercel auto-deploys from `main`
- Preview deployments on pull requests
- Check deployment: `gh run list` + Vercel MCP tools
