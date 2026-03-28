# Backend — Instruções

## Estrutura
- `server.js` — Montagem de rotas e inicialização (~3700 linhas)
- `routes/` — Rotas Express extraídas por domínio (finance/, notifications, reports, etc.)
- `services/` — Lógica de negócio (payments, email, pdf, charge-status, notifications)
- `db-knex.js` — Singleton Knex: `getKnex()`, `initializeKnex()`, `destroyKnex()`
- `auth.js` — JWT, RBAC middleware
- `rbac.js` — Definição de permissões por recurso/role
- `config.js` — Todas as variáveis de ambiente centralizadas
- `migrations/` — Knex migrations (schema, payment_references, email, notifications, templates, voting)
- `seeds/` — Seed sintético com 2 tenants para dev/demo

## Padrões Críticos

### SQLite Deadlocks
Funções chamadas dentro de `knex.transaction()` DEVEM usar o objecto `trx`, nunca `getKnex()`.
better-sqlite3 usa pool=1 (uma só conexão).

```js
// ✅ Correcto
async function foo(tenantId, id, db = null) {
  const knex = db || getKnex();
  // ...
}
// Dentro de transação: foo(tenantId, id, trx)

// ❌ Errado — causa deadlock
async function foo(tenantId, id) {
  const knex = getKnex(); // ignora trx → deadlock
}
```

### Test DB Cleanup
Apagar **todos os 3 ficheiros** (Dropbox + WAL mode):
```bash
rm -f backend/data/condoos.test.sqlite*
# Inclui .sqlite, .sqlite-shm, .sqlite-wal
```
Nunca apagar só o `.sqlite` — causa SQLITE_IOERR_SHORT_READ.

### Multi-tenant
Todas as queries filtram por `tenant_id`. O tenant vem do header `x-tenant-id`.
Rotas autenticadas recebem `req.tenantId` via middleware.

### Convenções de Rotas
- Usar `router.use(authenticate)` no topo de cada ficheiro de rotas
- Proteger com `authorize('resource', 'action')` do rbac.js
- Passar `db` (trx) a funções de serviço quando dentro de transação
