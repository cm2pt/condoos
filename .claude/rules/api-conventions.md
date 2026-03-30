# API Conventions

## Route Structure

All routes live in `backend/server.js` (main file) or `backend/routes/` (extracted modules).

```
GET    /api/{resource}          — List (filtered by tenant_id)
GET    /api/{resource}/:id      — Get single (filtered by tenant_id)
POST   /api/{resource}          — Create
PUT    /api/{resource}/:id      — Update
DELETE /api/{resource}/:id      — Delete
POST   /api/{resource}/:id/action — Custom action (e.g., /api/charges/:id/pay)
```

### Finance routes

Finance-related routes are organized under `backend/routes/finance/`:
- `index.js` — Router mounting and shared middleware
- `charges.js` — Charge CRUD, status transitions
- `payments.js` — Payment recording, receipt generation
- `reconciliation.js` — Payment reconciliation and reporting

## Middleware Stack

Every protected route uses this middleware chain:

```js
router.get("/api/resource", authenticate, resolveTenantScope, authorize("resource", "action"), handler);
```

1. **`authenticate`** — Validates JWT, sets `req.user`
2. **`resolveTenantScope`** — Extracts `x-tenant-id` header, sets `req.tenantId`
3. **`authorize(resource, action)`** — Checks `req.user.role` permissions via `rbac.js` (e.g., `authorize("fractions", "read")`)

## Error Response Format

Always return errors as:
```json
{ "error": "Human-readable message in Portuguese" }
```

With appropriate HTTP status codes:
- `400` — Validation error, bad request
- `401` — Not authenticated
- `403` — Not authorized (role insufficient)
- `404` — Resource not found (or not in tenant scope)
- `409` — Conflict (e.g., duplicate entry)
- `500` — Internal server error (log full error, return generic message)

## Service Function Signature

```js
async function serviceName(tenantId, ...businessArgs, db = null) {
  const knex = db || getKnex();
  // Always filter by tenant_id
}
```

- `tenantId` is always the **first** parameter
- `db` (for transaction support) is always the **last** parameter, defaulting to `null`
- Return plain objects, not Knex query builders

## Request Validation

- Validate required fields at the route handler level before calling services
- Use descriptive error messages in Portuguese for user-facing errors
- Sanitize inputs — trim strings, validate IDs are integers, validate enums

## Pagination

List endpoints support optional pagination:
```
GET /api/resource?page=1&per_page=25
```

Default: `per_page=50`, max: `200`. Response includes `{ data: [], pagination: { page, per_page, total } }`.
