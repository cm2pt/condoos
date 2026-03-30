# Frontend — Instruções

## Estrutura
- `App.jsx` — Shell principal com providers, sidebar, module switch (~2566 linhas)
- `pages/` — 10 páginas (Dashboard, Finance, Fractions, Issues, Assemblies, Portal, Documents, Compliance, Reports, Login)
- `components/shared/` — Componentes reutilizáveis:
  - `Icon.jsx` — Wrapper Lucide React (`<Icon name="Wallet" size={18} />`)
  - `StatusPill.jsx` — Badges com ícones por tom (success, warning, danger, neutral)
  - `Toast.jsx` — Notificações toast com ícones e acção opcional
  - `AnimateSection.jsx` — Wrapper scroll-triggered com Framer Motion spring
  - `AnimatedTableBody.jsx` — Entrada staggered para linhas de tabela
  - `AnimatedNumber.jsx` — Contador animado para KPIs (requestAnimationFrame + easeOutCubic)
  - `ProgressRing.jsx` — Progresso circular SVG com stroke animado
  - `EmptyState.jsx` — Estados vazios contextuais com ícone, título e subtítulo
  - `Skeleton.jsx` — Skeletons de carregamento (SkeletonKPI, SkeletonTable, SkeletonPanel)
  - `ErrorBoundary.jsx` — Error boundary global React
  - `PageLoader.jsx` — Loader de página inteira
  - `TenantSelector.jsx` — Selector de tenant/condomínio
- `contexts/` — AuthContext, RuntimeContext, ThemeContext (dark mode)
- `hooks/` — React Query hooks organizados:
  - `mutations/` — Mutation hooks (useMutation wrappers)
  - `queries/` — Query hooks (useQuery wrappers)
- `services/condoosApi.js` — Cliente API com React Query hooks
- `config/profiles.js` — Credenciais demo, perfis disponíveis
- `features/` — Funcionalidades extraídas:
  - `notifications/NotificationCenter.jsx` — Painel de alertas agrupados por data
  - `command-palette/CommandPalette.jsx` — Paleta de comandos com ícones e pesquisa
  - `quick-actions/QuickActionDrawer.jsx` — Drawer de acções rápidas com spring animation
- `lib/` — Utilitários puros (finance, formatters, csv, issueHelpers, constants, icons)

## Padrões

### Design System
- Variáveis CSS custom em `:root` (`--brand-deep`, `--brand-mid`, `--brand-sand`, `--brand-highlight`, `--teal`, `--amber`)
- Dark mode via `[data-theme="dark"]` no `<html>`, gerido pelo ThemeContext
- Ícones: Lucide React exclusivamente, via `<Icon name="..." />` — nunca usar emoji como ícones
- Animações: Framer Motion com spring physics (`stiffness: 300-400, damping: 25-30`)
- Respeitar `prefers-reduced-motion` (já tratado no AnimateSection)

### Testes Unitários
- Apenas `src/lib/` tem cobertura obrigatória (80% threshold)
- Ficheiros de re-export (`financeUtils.js`, `icons.js`) estão excluídos da cobertura
- Usar `vi.spyOn` para mocks de DOM (downloadBlob, etc.)

### Estilo e Acessibilidade
- TailwindCSS 4 com variáveis CSS custom (`--bg`, `--surface`, `--muted`, etc.)
- **WCAG contraste**: `--muted` deve manter ratio >= 4.5:1 contra `--bg` e `--surface`
- Mobile responsive: breakpoint sidebar collapse a `930px`, bottom nav abaixo disso
- Touch targets 44px mínimo
- Todos os textos da UI em Português (PT-PT)

### React Query
- Queries definidas em `condoosApi.js` com hooks `useX()`
- Mutations com `useMutation()` + invalidação de queries relacionadas
- Header `x-tenant-id` adicionado automaticamente pelo interceptor

### Módulos
Cada módulo (dashboard, finance, fractions, etc.) corresponde a:
- Uma página em `src/pages/XPage.jsx`
- Uma ou mais rotas em `backend/routes/x.js`
- Entrada no sidebar via `MODULES` em `lib/constants.js` (com campo `icon`)
- Permissões RBAC em `backend/rbac.js`
