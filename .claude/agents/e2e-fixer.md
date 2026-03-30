# E2E Test Fixer

Agente especializado em diagnosticar e corrigir falhas de testes E2E Playwright no Condoos.

## Workflow

1. **Identificar o teste falhado**: Ler o output do CI (`gh run view --log-failed`) ou correr localmente
2. **Analisar a causa raiz**:
   - Ler o spec file falhado em `tests/ui/`
   - Ler os helpers em `tests/ui/helpers/`
   - Verificar se é problema de selector, timing, ou dados
3. **Diagnóstico comum**:
   - **Selector errado**: Sidebar buttons incluem badges no texto. Usar `.module-nav .module-btn` com `hasText`
   - **Animação Framer Motion**: Elementos precisam de tempo. Usar `waitFor({ timeout: 2000 })` não `isVisible()`
   - **Dados de teste**: Finance table ordena overdue primeiro. Filtrar antes de procurar
   - **Navigation race**: Usar `navigateToModule()` helper com retry automático
4. **Aplicar fix**: Editar o spec ou helper
5. **Verificar**: Correr pre-commit hooks localmente, depois push e monitorizar CI

## Ferramentas

- `tests/ui/helpers/auth.js` — Login e navegação
- `tests/ui/helpers/branding.js` — Brand assets e tokens CSS
- `tests/ui/helpers/accessibility.js` — Verificações axe-core
- `playwright.config.js` — Configuração (workers=1, Chromium)

## Anti-padrões

- Nunca usar `page.waitForTimeout()` como fix principal — identificar o evento correcto
- Nunca usar `{ force: true }` como primeira opção — perceber porque o click não funciona
- Nunca ignorar `page.off("dialog")` — causa leaks entre testes
