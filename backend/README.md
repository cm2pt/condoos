# Backend API (V1 foundation)

Backend inicial para Condoos com:

- API REST em Express.
- Base de dados SQLite.
- Autenticacao com JWT.
- Enforcement RBAC no servidor.
- Escopo multi-tenant por condominio (`x-tenant-id`).
- Audit log para operacoes de escrita principais.
- Rate limiting em login.
- `x-request-id` e logs estruturados por request.

## Requisitos

- Node.js 22+ (usa `node:sqlite`).

## Arranque rapido

1. Instalar dependencias:

```bash
npm install
```

2. Inicializar ou re-seed da base de dados:

```bash
npm run db:seed
```

Para reset completo:

```bash
npm run db:reset
```

3. Arrancar API:

```bash
npm run api:dev
```

API por omissao: `http://127.0.0.1:4100`

4. Executar testes backend:

```bash
npm test
```

## Credenciais demo

As credenciais demo sao listadas no output de `npm run db:seed` / `npm run db:reset`.
Por defeito, o backend ativa contas demo apenas fora de producao.

Perfis seeded:

- `gestao.demo@condoos.pt` (manager)
- `contabilidade.demo@condoos.pt` (accounting)
- `operacoes.demo@condoos.pt` (operations)
- `condomino.demo@condoos.pt` (resident)

As passwords demo sao geradas no seeding e estao em `backend/db.js`.

Em producao:
- `ENABLE_DEMO_USERS=false` desativa a criacao de contas demo.
- Definir `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` para criar a conta inicial de gestor.

## Fluxo de autenticacao

1. `POST /api/auth/login` com `email` e `password`.
2. Usar `Authorization: Bearer <token>` nas rotas `/api/*`.
3. Definir condominio ativo com header `x-tenant-id` (opcional quando o utilizador so tem 1 condominio).

`/api/auth/login` e `/api/auth/me` devolvem tambem `capabilities` (modulos e acoes rapidas permitidas por perfil) para alinhar frontend com RBAC backend.

## Sessao e seguranca de auth

- `POST /api/auth/login`: emite `access token` + `refresh token`.
- `POST /api/auth/refresh`: roda refresh token e emite novo par.
- `POST /api/auth/logout`: revoga refresh token.
- `POST /api/auth/password-reset/request`: gera token de reset (em dev/test devolve `resetToken` para validacao local).
- `POST /api/auth/password-reset/confirm`: aplica nova password e revoga sessoes anteriores.

## Endpoints principais

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/tenants`
- `POST /api/tenants`
- `PATCH /api/tenants/:tenantId`
- `GET /api/dashboard/summary`
- `GET /api/fractions`
- `POST /api/fractions`
- `POST /api/fractions/import/csv`
- `GET /api/fractions/:fractionId/profile`
- `PATCH /api/fractions/:fractionId`
- `DELETE /api/fractions/:fractionId`
- `GET /api/people`
- `POST /api/people`
- `PATCH /api/people/:personId`
- `DELETE /api/people/:personId`
- `GET /api/fraction-parties`
- `POST /api/fraction-parties`
- `PATCH /api/fraction-parties/:partyId`
- `DELETE /api/fraction-parties/:partyId`
- `GET /api/finance/charges`
- `POST /api/finance/charges`
- `GET /api/finance/payments`
- `POST /api/finance/payments`
- `GET /api/finance/payments/:paymentId/receipt`
- `POST /api/finance/payments/:paymentId/receipt/regenerate`
- `POST /api/finance/reconciliation/import-csv`
- `GET /api/finance/reconciliation/transactions`
- `POST /api/finance/reconciliation/auto-match`
- `GET /api/finance/export/accounting.csv`
- `GET /api/issues`
- `POST /api/issues`
- `PATCH /api/issues/:issueId/status`
- `GET /api/documents`
- `POST /api/documents`
- `POST /api/documents/:documentId/versions`
- `GET /api/documents/:documentId/versions`
- `GET /api/documents/:documentId/download`
- `POST /api/integrations/payments/mb-reference`
- `POST /api/integrations/communications/email`
- `GET /api/audit-log`

### Nota de seguranca para documentos

`GET /api/documents` aplica filtro de visibilidade por perfil no backend:
- `manager`: `manager_only`, `residents`, `all`
- `accounting`, `operations`, `resident`: `residents`, `all`

Além disso, `storagePath` so e devolvido para `manager`; nos restantes perfis vem `null`.

Upload e versionamento:
- `POST /api/documents` cria documento + versao 1.
- `POST /api/documents/:documentId/versions` adiciona versao incremental.
- `GET /api/documents/:documentId/download` serve sempre a versao mais recente quando existe ficheiro.

## Variaveis de ambiente

- `API_HOST` (default `127.0.0.1`)
- `API_PORT` (default `4100`)
- `JWT_SECRET` (obrigatorio em producao; default apenas para desenvolvimento local)
- `JWT_EXPIRES_IN` (default `8h`)
- `AUTH_REFRESH_EXPIRES_DAYS` (default `30`)
- `AUTH_PASSWORD_RESET_EXPIRES_MINUTES` (default `30`)
- `CORS_ORIGINS` (lista CSV de origins)
- `ENABLE_DEMO_USERS` (default `true` em dev/test, `false` em producao)
- `BOOTSTRAP_ADMIN_EMAIL` (obrigatorio em producao quando `ENABLE_DEMO_USERS=false`)
- `BOOTSTRAP_ADMIN_PASSWORD` (obrigatorio em producao quando `ENABLE_DEMO_USERS=false`)
- `x-request-id` pode ser enviado pelo cliente; caso nao exista, o servidor gera automaticamente.
