# Testing Rules

## Test Pyramid

1. **Backend integration tests** (30) — Run pre-commit + CI
2. **Frontend unit tests** (66) — Run pre-commit + CI, 80% coverage threshold
3. **E2E Playwright tests** (12) — CI only

## Fresh Test DB

Always start with a clean database:
```bash
rm -f backend/data/condoos.test.sqlite* && npm test
```

The 3-file deletion pattern (`*`) is critical — see `rules/database.md`.

## Frontend Unit Test Patterns

- Test files: `src/**/*.test.{js,jsx}` alongside source
- Only `src/lib/` has coverage threshold enforcement
- Re-export files (`financeUtils.js`, `icons.js`) excluded from coverage
- Mock DOM APIs with `vi.spyOn(document, ...)`, restore in `afterEach`
- Don't test React component rendering unless testing complex logic

## E2E Test Patterns

### Navigation
Always use `navigateToModule()` helper — never click sidebar buttons directly:
```js
import { navigateToModule } from "./helpers/auth.js";
await navigateToModule(page, "Financeiro", {
  heading: page.getByRole("heading", { name: /Tesouraria/i }),
});
```

### Animated Elements
Framer Motion elements need time to become visible:
```js
// CORRECT — waits for animation
await page.getByRole("button", { name: /Recibo PDF/i })
  .waitFor({ state: "visible", timeout: 2000 });

// WRONG — checks instantly, fails on animated elements
const visible = await page.getByRole("button", { name: /Recibo PDF/i }).isVisible();
```

### Dialog Handling
Always clean up dialog handlers:
```js
page.on("dialog", dialogHandler);
try {
  // ... test actions that trigger dialogs
} finally {
  page.off("dialog", dialogHandler);
}
```

### Table Testing with Filters
Finance tables sort overdue charges first. To reach specific charge types:
```js
// Filter BEFORE scanning rows
await page.locator('select[aria-label="Filtrar por estado financeiro"]')
  .selectOption("partially_paid");
await page.waitForTimeout(300); // Wait for re-render
```

## CI Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. Install dependencies
2. Run backend tests (fresh DB)
3. Run frontend tests + coverage
4. Build production bundle
5. Run E2E tests (starts both servers)
