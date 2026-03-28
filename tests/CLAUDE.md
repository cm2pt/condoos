# Testes — Instruções

## Suites

| Suite | Comando | Testes | Onde corre |
|-------|---------|--------|------------|
| Backend integração + RBAC | `rm -f backend/data/condoos.test.sqlite* && npm test` | 30 | Pre-commit + CI |
| Frontend unitários + coverage | `npx vitest run --coverage` | 66 | Pre-commit + CI |
| Build produção | `npx vite build` | — | Pre-commit + CI |
| E2E Playwright | `npx playwright test` | 12 | CI apenas |

## Cobertura (80% mínimo)
- Frontend: configurado em `vite.config.js` → `test.coverage.thresholds`
- Backend: flags `--test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80`
- CI: `.github/workflows/ci.yml`

## Padrões de Teste

### Backend
- Testes partilham uma só DB SQLite — usar `SEEDED_TENANT_ID` para tenant determinístico
- Sempre apagar `condoos.test.sqlite*` (3 ficheiros) antes de correr
- `NODE_ENV=test` e `ENABLE_DEMO_USERS=true` obrigatórios

### Frontend (Vitest)
- Ambiente: jsdom (configurado em `vite.config.js`)
- Setup: `src/test/setup.js`
- Padrão de ficheiro: `src/**/*.test.{js,jsx}`
- Mocks de DOM: usar `vi.spyOn(document, ...)` com `vi.restoreAllMocks()` no final

### E2E (Playwright)
- Config: `playwright.config.js`
- Workers: 1 (SQLite pool=1 não suporta paralelismo)
- Browsers: Chromium apenas
- Auth helpers: `tests/ui/helpers.js` — `loginWithDemoShortcut(page, profile)`
- DB: Playwright apaga DB e deixa Knex migrar+seed automaticamente
- Artefactos (screenshots, vídeos): `test-results/` (gitignored)
