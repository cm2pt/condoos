# Backend — Instruções

## Estrutura
- `server.js` — Montagem de rotas e inicialização (~144 linhas, thin router)
- `routes/` — Rotas Express extraídas por domínio:
  - `finance/` — index.js, charges.js, payments.js, reconciliation.js
  - `notifications.js` — Alertas e centro de notificações
  - `reports.js` — Relatórios e exportação
- `services/` — Lógica de negócio:
  - `payments/` — ifthenpay integration (multibanco.js, mbway.js, sepa.js, webhook-handler.js)
  - `email/` — Resend email service
  - `pdf/` — Geração de recibos PDF
  - `charge-status.js` — Cálculo de estados de cobrança
  - `notifications.js` — Criação e gestão de notificações
- `db-knex.js` — Singleton Knex: `getKnex()`, `initializeKnex()`, `destroyKnex()`
- `auth.js` — JWT, RBAC middleware (`authenticate`, `authorize`)
- `rbac.js` — Definição de permissões por recurso/role
- `config.js` — Todas as variáveis de ambiente centralizadas:
  - `JWT_SECRET`, `JWT_EXPIRES_IN`, `API_HOST`, `API_PORT`
  - `IFTHENPAY_*` (API_KEY, MULTIBANCO_ENTITY, MULTIBANCO_SUBENTITY, MBWAY_KEY, ANTI_PHISHING_KEY, SANDBOX)
  - `SMTP_*` (HOST, PORT, USER, PASS, FROM)
  - `CORS_ORIGINS`, `ENABLE_DEMO_USERS`, `BOOTSTRAP_ADMIN_*`
- `audit.js` — Audit logging
- `logger.js` — Structured JSON logger

## Migrations (7 ficheiros)
- `20260220_001_initial_schema.js` — 20 tabelas base
- `20260220_002_payment_references.js` — payment_references, email_log, campos IBAN/BIC
- `20260304_003_issue_attachments_work_orders.js` — Anexos de ocorrências e ordens de trabalho
- `20260220_004_notifications.js` — Sistema de notificações
- `20260220_005_templates.js` — Templates de assembleias
- `20260220_006_voting.js` — Sistema de votação
- `20260328_007_performance_indices.js` — Índices de performance

## Seeds
- `seeds/001_synthetic.js` — Seed sintético com 2 tenants para dev/demo
- Usa PRNG determinístico (`seededRandom()`) para dados reproduzíveis
- 4 utilizadores demo: gestao, contabilidade, operacoes, condomino

## Padrões Críticos

### SQLite Deadlocks
Funções chamadas dentro de `knex.transaction()` DEVEM usar o objecto `trx`, nunca `getKnex()`.
better-sqlite3 usa pool=1 (uma só conexão). Ver `.claude/rules/database.md` para detalhes.

### Test DB Cleanup
Apagar **todos os 3 ficheiros** (Dropbox + WAL mode):
```bash
rm -f backend/data/condoos.test.sqlite*
```
Nunca apagar só o `.sqlite` — causa SQLITE_IOERR_SHORT_READ.

### Multi-tenant
Todas as queries filtram por `tenant_id`. O tenant vem do header `x-tenant-id`.
Rotas autenticadas recebem `req.tenantId` via middleware.

### Convenções de Rotas
- Usar `router.use(authenticate)` no topo de cada ficheiro de rotas
- Proteger com `authorize('resource', 'action')` do rbac.js
- Passar `db` (trx) a funções de serviço quando dentro de transação
- Ver `.claude/rules/api-conventions.md` para formato de erros e paginação
