import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: ['steps/*.steps.ts', 'fixtures/*.ts'],
});

// This suite tests `bank-app`, a separate React app repo — it is not part of
// this repo and nothing here builds or bundles it. See README.md for the
// full dependency writeup. BASE_URL lets you point at an app already running
// anywhere (a different port, a deployed environment, CI's own checkout);
// when it's set we assume that server is already up and skip the webServer
// block entirely, since Playwright can't reliably manage a server it didn't
// start. BANK_APP_PATH overrides where to find a local checkout to start
// automatically; it defaults to `../bank-app-1`, a sibling-directory guess
// that holds on this machine but is NOT guaranteed elsewhere (a fresh clone,
// a different machine layout, CI) — set BANK_APP_PATH explicitly wherever
// that guess doesn't hold, or set BASE_URL and start the app yourself.
const bankAppPath = process.env.BANK_APP_PATH ?? '../bank-app-1';

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(process.env.BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          cwd: bankAppPath,
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      }),
});
