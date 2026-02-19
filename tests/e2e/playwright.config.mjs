import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:12345',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm --prefix ../../InsightifyWeb run dev -- --host 127.0.0.1 --port 12345',
    url: 'http://127.0.0.1:12345',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
