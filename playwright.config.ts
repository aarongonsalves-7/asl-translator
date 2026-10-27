import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end checks against the real static build.
 *
 * These cover the things jsdom cannot: that the vendored MediaPipe model actually loads in a
 * browser, that camera permission states are narrated correctly, and that the layout holds at
 * phone width and in dark mode.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: [],
        // Chromium has no webcam in CI/headless, so the live-path test gets a synthetic capture
        // device. Without these flags getUserMedia fails for reasons unrelated to the app.
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
