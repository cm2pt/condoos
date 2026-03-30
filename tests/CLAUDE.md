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
- Backend: cobertura planeada quando testes de rotas aumentarem (atualmente ~58%)
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
- Helpers: `tests/ui/helpers/auth.js`:
  - `loginWithCredentials(page, role)` — Login com email/password
  - `loginWithDemoShortcut(page, role)` — Login via botão demo
  - `navigateToModule(page, moduleName, { heading })` — Navega para módulo com retry
  - `gotoLogin(page)` — Navega para página de login
- Helpers adicionais:
  - `tests/ui/helpers/branding.js` — Constantes de brand (BRAND_ASSETS, BRAND_TOKENS), leitura de CSS tokens
  - `tests/ui/helpers/accessibility.js` — `expectNoHighImpactA11yViolations()` via axe-core
- DB: Playwright apaga DB e deixa Knex migrar+seed automaticamente
- Artefactos (screenshots, vídeos): `test-results/` (gitignored)

### E2E Gotchas
- **Framer Motion animations**: Elementos podem não estar visíveis imediatamente. Usar `waitFor({ state: "visible", timeout: 2000 })` em vez de `isVisible()` instantâneo
- **Sidebar navigation**: Botões incluem texto de badges (ex: "Financeiro €2.1k"). Usar `navigateToModule()` helper que faz scroll + click + retry com `force: true`
- **Finance table sorting**: Cobranças em atraso aparecem primeiro. Para testar recibos, filtrar por status "partially_paid" antes de procurar botão "Recibo PDF"
- **Dialog handlers**: Usar `page.on("dialog", handler)` com `try/finally` para `page.off("dialog", handler)`

### Credenciais Demo
| Role | Email | Password |
|------|-------|----------|
| manager | gestao.demo@condoos.pt | Condoos!Gestao2026 |
| accounting | contabilidade.demo@condoos.pt | Condoos!Contabilidade2026 |
| operations | operacoes.demo@condoos.pt | Condoos!Operacoes2026 |
| resident | condomino.demo@condoos.pt | Condoos!Condomino2026 |
