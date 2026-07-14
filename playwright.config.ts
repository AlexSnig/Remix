import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: '/tmp/remix-playwright-results',
  reporter: [['line']],
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {...devices['Pixel 5']},
    },
    {
      name: 'desktop-chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
});
