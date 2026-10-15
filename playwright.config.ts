import { defineConfig, devices } from '@playwright/test';

// The e2e tests run against a production build made with .env.e2e (local signaling server on
// port 9000, no STUN servers), so nothing leaves the machine.
export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  testIgnore: /manual\//,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/peer-server.mjs',
      port: 9000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build:e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
      url: 'http://localhost:4173',
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      // the same app without the Epic 3 test fixture: the real contributions module (Epic 4 tests)
      command: 'npm run build:e2e-real && npx vite preview --outDir dist-e2e-real --port 4174 --strictPort',
      url: 'http://localhost:4174',
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
