import { defineConfig } from "@playwright/test";

const WEB_PORT = Number.parseInt(process.env.PW_WEB_PORT || "42373", 10);
const API_PORT = Number.parseInt(process.env.PW_API_PORT || "42370", 10);
const TEST_DB_FILE = process.env.PW_DB_FILE || "backend/data/condoos.ui.sqlite";

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "pt-PT",
  },
  webServer: [
    {
      command:
        `rm -f ${TEST_DB_FILE} ${TEST_DB_FILE}-shm ${TEST_DB_FILE}-wal && ` +
        `NODE_ENV=test CONDOOS_DB_FILE=${TEST_DB_FILE} API_HOST=127.0.0.1 API_PORT=${API_PORT} ` +
        `CORS_ORIGINS=http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT} npm run api`,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 180_000,
    },
    {
      command:
        `VITE_API_BASE_URL=http://127.0.0.1:${API_PORT} VITE_ENABLE_DEMO_LOGIN=true npm run dev -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}/login`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 180_000,
    },
  ],
});
