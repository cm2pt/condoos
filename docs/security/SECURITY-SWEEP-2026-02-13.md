# Security Sweep - 2026-02-13

## Scope

- API auth + RBAC enforcement.
- Tenant isolation (`x-tenant-id`).
- Document visibility and metadata exposure.
- Demo access surface (frontend and backend seeding).
- Dependency vulnerability check (`npm audit`).

## Findings and actions

### 1) Document metadata leakage across roles (fixed)

Issue:
- `GET /api/documents` already filtered document visibility by role, but returned `storagePath` to all roles.

Risk:
- Non-manager users could inspect internal storage metadata via network responses.

Fix:
- `storagePath` is now only returned for `manager`; other roles receive `null`.
- Files:
  - `backend/server.js`
  - `backend/tests/api.integration.test.js`

### 2) Demo access exposure in production (fixed)

Issue:
- Demo accounts and one-click demo login paths were suitable for development/demo, but unsafe as default in production.

Risk:
- Unauthorized access if demo users or demo shortcuts remain enabled in internet-facing environments.

Fix:
- Backend:
  - Added production-safe controls:
    - `ENABLE_DEMO_USERS` (default `false` in production, `true` in dev/test).
    - bootstrap admin requirement in production when demo users are disabled.
  - Added bootstrap manager seeding via:
    - `BOOTSTRAP_ADMIN_EMAIL`
    - `BOOTSTRAP_ADMIN_PASSWORD`
- Frontend:
  - Demo quick-login controls now require explicit enablement (`VITE_ENABLE_DEMO_LOGIN`) and valid credentials.
  - Removed default prefilled login email.
  - Production build no longer embeds demo credentials by default.
- Files:
  - `backend/config.js`
  - `backend/db.js`
  - `src/App.jsx`
  - `backend/README.md`

### 3) Dependency advisory (fixed)

Issue:
- `npm audit` reports moderate advisory in Vite/esbuild dev server chain.

Impact:
- Mainly relevant to development server exposure.

Action:
- Upgraded tooling to:
  - `vite@^7.3.1`
  - `@vitejs/plugin-react@^5.1.4`
- `npm audit` now reports zero vulnerabilities.

## Validation evidence

- `npm test -- --runInBand` -> 17/17 passing.
- `npm run build` -> successful.
- `npm audit --audit-level=moderate` -> 0 vulnerabilities.
- Production bundle scan:
  - no matches for demo emails/passwords in `dist/assets`.

## Production hardening baseline

- Set `JWT_SECRET` (required).
- Set `ENABLE_DEMO_USERS=false`.
- Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`.
- Keep `VITE_ENABLE_DEMO_LOGIN=0` (or unset) unless running controlled demos.
- Do not expose Vite dev server to the internet.
