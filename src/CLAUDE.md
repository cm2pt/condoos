# Frontend — Instruções

## Estrutura
- `App.jsx` — Shell principal com providers, sidebar, module switch (~2500 linhas)
- `pages/` — 10 páginas (Dashboard, Finance, Fractions, Issues, Assemblies, Portal, Documents, Compliance, Reports, Login)
- `components/shared/` — Componentes reutilizáveis (TenantSelector, Icon, etc.)
- `contexts/` — AuthContext, RuntimeContext
- `services/condoosApi.js` — Cliente API com React Query hooks
- `config/profiles.js` — Credenciais demo, perfis disponíveis
- `features/` — Funcionalidades extraídas (notifications, command-palette)
- `lib/` — Utilitários puros (finance, formatters, csv, issueHelpers, constants)

## Padrões

### Testes Unitários
- Apenas `src/lib/` tem cobertura obrigatória (80% threshold)
- Ficheiros de re-export (`financeUtils.js`, `icons.js`) estão excluídos da cobertura
- Usar `vi.spyOn` para mocks de DOM (downloadBlob, etc.)

### Estilo e Acessibilidade
- TailwindCSS com variáveis CSS custom (`--bg`, `--surface`, `--muted`, etc.)
- **WCAG contraste**: `--muted` deve manter ratio >= 4.5:1 contra `--bg` e `--surface`
- Mobile responsive: breakpoint `max-width: 600px`, touch targets 44px mínimo
- Todos os textos da UI em Português (PT-PT)

### React Query
- Queries definidas em `condoosApi.js` com hooks `useX()`
- Mutations com `useMutation()` + invalidação de queries relacionadas
- Header `x-tenant-id` adicionado automaticamente pelo interceptor

### Módulos
Cada módulo (dashboard, finance, fractions, etc.) corresponde a:
- Uma página em `src/pages/XPage.jsx`
- Uma ou mais rotas em `backend/routes/x.js`
- Entrada no sidebar via `MODULES` em `lib/constants.js`
- Permissões RBAC em `backend/rbac.js`
