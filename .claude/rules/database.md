# Database Rules

## SQLite Deadlock Prevention (CRITICAL)

better-sqlite3 uses `pool: { min: 1, max: 1 }` — a single connection. Any function called inside `knex.transaction()` that calls `getKnex()` instead of using the `trx` object **will deadlock** because the single connection is already held by the transaction.

### Pattern: Always accept a `db` parameter

```js
// CORRECT — accepts optional db, falls back to getKnex()
async function updateFractionBalance(tenantId, fractionId, amount, db = null) {
  const knex = db || getKnex();
  return knex("fractions").where({ tenant_id: tenantId, id: fractionId }).update({ balance: amount });
}

// CORRECT — pass trx when calling from inside a transaction
await knex.transaction(async (trx) => {
  await updateFractionBalance(tenantId, fractionId, newAmount, trx);
  await createAuditLog(tenantId, "balance_update", details, trx);
});
```

```js
// WRONG — calls getKnex() inside a transaction, DEADLOCKS
async function updateFractionBalance(tenantId, fractionId, amount) {
  const knex = getKnex(); // BUG: grabs the only connection, already held by caller's trx
  return knex("fractions").where({ tenant_id: tenantId, id: fractionId }).update({ balance: amount });
}
```

### Service function signature convention

```js
async function myServiceFunction(tenantId, ...businessArgs, db = null)
```

`db` is always the **last** parameter, always defaults to `null`.

## WAL File Cleanup (Dropbox + SQLite)

SQLite WAL mode creates 3 files: `.sqlite`, `.sqlite-shm`, `.sqlite-wal`. **NEVER** delete just the `.sqlite` file — you'll get `SQLITE_IOERR_SHORT_READ`.

```bash
# CORRECT — delete all 3 files
rm -f backend/data/condoos.test.sqlite*

# WRONG — orphaned WAL/SHM files cause corruption
rm -f backend/data/condoos.test.sqlite
```

## Migrations

- Directory: `backend/migrations/`
- Naming: `YYYYMMDD_NNN_descriptive_name.js` (e.g., `20260220_001_initial_schema.js`)
- Always create a **new** migration file. Never edit existing migrations that have been deployed.
- Run `npx knex migrate:latest --knexfile backend/knexfile.js` to apply
- Current schema: 7 migration files covering 20+ tables

## Seed Data

- `backend/seeds/001_synthetic.js` — deterministic seed using PRNG (`seededRandom()`)
- `SEEDED_TENANT_ID` constant used by tests for reliable tenant targeting
- Seed creates 4 demo users (gestao, contabilidade, operacoes, condomino) with known passwords
- Generates realistic Portuguese condominium data: fractions, charges, payments, issues, documents

## Dual-DB Strategy

- **Development/Test**: SQLite via better-sqlite3 (pool=1)
- **Production**: PostgreSQL via `pg` (configurable pool)
- Knex.js abstracts the difference — write standard SQL, avoid SQLite-specific syntax
- `backend/knexfile.js` switches based on `process.env.DATABASE_URL`
