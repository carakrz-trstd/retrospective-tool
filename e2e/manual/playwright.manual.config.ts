import { defineConfig, devices } from '@playwright/test';

// Manual smoke test against the real public PeerJS broker (not part of CI).
export default defineConfig({
  testDir: '.',
  testMatch: /real-broker\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  use: { baseURL: 'http://localhost:4174', headless: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    timeout: 180_000,
    reuseExistingServer: false,
    cwd: '../..',
  },
});
