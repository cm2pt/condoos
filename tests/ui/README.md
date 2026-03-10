# Condoos UI Test Suite (Playwright)

This suite validates UX/UI quality, branding consistency, and role-based experience.

## Run

- Full UI suite: `npm run test:ui`
- Headed mode: `npm run test:ui:headed`
- Debug mode: `npm run test:ui:debug`

The test runner starts API + frontend automatically, with an isolated test database reset before each run.

## Coverage

- Branding and login experience (`branding-login.spec.js`)
- RBAC and localization UX (`rbac-localization.spec.js`)
- Core user workflows (`workflows.spec.js`)
- Responsive mobile behavior (`responsive.spec.js`)
- Accessibility checks (critical/serious) via axe-core

## Runtime ports

- API: `42370`
- Frontend: `42373`

Use `PW_API_PORT` and `PW_WEB_PORT` env vars to override if needed.
