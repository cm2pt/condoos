# Security Rules

## Multi-Tenant Isolation (CRITICAL)

Every database query touching tenant data **MUST** include a `WHERE tenant_id = ?` clause. There are no exceptions.

```js
// CORRECT
const fractions = await knex("fractions").where({ tenant_id: tenantId });

// WRONG — leaks data across tenants
const fractions = await knex("fractions").where({ id: fractionId });
```

### How tenant_id flows

1. Client sends `x-tenant-id` header (set by `AuthContext` after login)
2. `resolveTenantScope` middleware extracts and validates it
3. `req.tenantId` is available in all route handlers
4. Pass `tenantId` as first argument to all service functions

### Review checklist for new queries

- [ ] Has `WHERE tenant_id = ?` (or `.where({ tenant_id: tenantId })`)
- [ ] Joins also filter by tenant_id on both tables
- [ ] Subqueries include tenant_id constraint
- [ ] Aggregations (COUNT, SUM) are scoped to tenant

## Authentication

- JWT stored in httpOnly cookie (`condoos_token`) + Bearer token fallback
- `authenticate` middleware runs on all `/api/*` routes
- Token contains: `userId`, `tenantId`, `role`, `email`
- If JWT is invalid or expired, respond 401 — **never** fall through to unauthenticated access

## Authorization (RBAC)

4 roles with hierarchical permissions:

| Role | Key | Access |
|------|-----|--------|
| Gestao | `manager` | Full access to all modules |
| Contabilidade | `accounting` | Finance, fractions, documents, compliance |
| Operacoes | `operations` | Issues, fractions, documents, portal |
| Condomino | `resident` | Dashboard, finance (own), issues, portal, documents (public) |

Use `authorize(resource, action)` middleware (checks role permissions via `rbac.js`):
```js
router.get("/api/compliance", authenticate, authorize("audit", "read"), handler);
```

## Secrets Management

- **NEVER** commit `.env`, credentials, API keys, or tokens
- `.env` and `.env.local` are in `.gitignore`
- Environment variables: `JWT_SECRET`, `IFTHENPAY_*`, `DATABASE_URL`, `RESEND_API_KEY`
- Demo user passwords are in seed data only (acceptable for demo environment)

## Webhook Validation

- ifthenpay webhooks: validate `Anti-Phishing Key` matches `IFTHENPAY_ANTI_PHISHING_KEY`
- Always verify webhook origin before processing payments

## Rate Limiting

- `express-rate-limit` on auth routes only (25 req/10min): login, refresh, password reset
- Rate limiter configured inline in `backend/routes/auth.js`
