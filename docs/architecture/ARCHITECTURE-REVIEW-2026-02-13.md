# Architecture Review - 2026-02-13

## Context

Revisão orientada a piloto com foco em:

- consistência entre RBAC backend e UI,
- redução de drift entre frontend/backend,
- robustez para evolução para multi-tenant em produção.

## Findings

### 1) Drift entre permissões backend e capacidades de UI

Antes:
- O backend aplicava RBAC por recurso/ação.
- O frontend usava capacidades hardcoded por perfil para módulos/ações rápidas.

Risco:
- Divergência silenciosa entre o que o backend permite e o que a UI mostra.
- Maior custo de manutenção e regressões de autorização.

Decisão:
- Backend passa a devolver `capabilities` em `/api/auth/login` e `/api/auth/me`.
- Frontend em modo API usa as `capabilities` do backend como fonte de verdade.

Estado:
- Implementado.

### 2) Download de documentos sem contrato de API

Antes:
- UI sem endpoint dedicado para download protegido.

Risco:
- Fluxo incompleto para piloto e risco de implementação ad-hoc por cliente.

Decisão:
- Introdução de endpoint dedicado:
  - `GET /api/documents/:documentId/download`
- Enforcement por tenant e visibilidade por perfil.

Estado:
- Implementado.

### 3) Monólito de frontend (`src/App.jsx`)

Observação:
- Ficheiro concentra demasiada responsabilidade (estado, RBAC visual, fluxos de domínio, UI).

Risco:
- Dificulta onboarding, testes por domínio e mudanças seguras.

Decisão:
- Manter intervenção incremental no piloto.
- Planeado para próxima fase: extrair por domínio (finance, issues, documents, auth/session).

Estado:
- Ainda pendente (não bloqueante para piloto).

## Improvements applied in this iteration

1. Capabilities backend-first:
- `backend/rbac.js`:
  - `ROLE_UI_CAPABILITIES`
  - `getUiCapability(role)`
- `backend/server.js`:
  - `/api/auth/login` devolve `capabilities`
  - `/api/auth/me` devolve `capabilities`
- `src/services/condoosApi.js`:
  - normalização de `capabilities` no login/me
- `src/App.jsx`:
  - em modo API, usa capabilities vindas da sessão backend.

2. Contrato de download de documentos:
- endpoint protegido com enforcement por role/tenant.
- frontend com download funcional via API.

3. Cobertura de testes:
- integração para download de documentos com validação de escopo e metadata por role.
- unit tests para capacidades de UI no RBAC.

## Validation

- `npm run build` OK.
- `npm test -- --runInBand` OK.

## Next architecture steps (30-60 days)

1. Modularizar frontend por domínio:
- extrair hooks de sessão/autorização.
- extrair ecrãs por módulo para componentes próprios.

2. Introduzir camada de serviços backend por bounded context:
- `documents`, `finance`, `issues`, `auth`.

3. Migrar storage de documentos para provider real:
- URL assinada com expiração.
- trilho de auditoria para download.

4. Contratos tipados (OpenAPI + geração cliente):
- reduzir incompatibilidades frontend/backend.

5. Observabilidade:
- métricas por endpoint e erro de autorização.
- dashboard de saúde por tenant.
