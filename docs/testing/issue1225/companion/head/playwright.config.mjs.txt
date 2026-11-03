import { defineConfig, devices } from '@playwright/test';
import { HA_URL, USERS } from './scripts/users.mjs';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  // first-run/ and upgrade/ need their own Home Assistant (empty seed, older
  // integration) and run as separate CI jobs via --project
  testIgnore: ['**/first-run/**', '**/upgrade/**'],
  // One Home Assistant, one plan: journeys mutate shared state (lights, the
  // plan itself), so they run one after another, in file order.
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: HA_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'Europe/Moscow',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.mjs/ },
    // the seed plan brought to the product's plan model once, so the editing
    // journeys can put it back after themselves (tests/plan-model.setup.mjs)
    { name: 'plan-model', testMatch: /plan-model\.setup\.mjs/, dependencies: ['setup'], retries: 0 },
    {
      name: 'admin',
      testMatch: /.*\.admin\.spec\.mjs/,
      dependencies: ['setup', 'plan-model'],
      use: { ...devices['Desktop Chrome'], storageState: USERS.admin.storageState },
    },
    {
      name: 'viewer',
      testMatch: /.*\.viewer\.spec\.mjs/,
      dependencies: ['setup', 'plan-model'],
      use: { ...devices['Desktop Chrome'], storageState: USERS.viewer.storageState },
    },
    {
      name: 'mobile',
      testMatch: /.*\.mobile\.spec\.mjs/,
      dependencies: ['setup', 'plan-model'],
      use: { ...devices['Pixel 7'], storageState: USERS.admin.storageState },
    },
    // --- separate Home Assistant instances ---
    {
      name: 'first-run-viewer',
      testDir: './tests/first-run',
      testIgnore: [],
      testMatch: /.*\.viewer\.spec\.mjs/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: USERS.viewer.storageState },
    },
    {
      name: 'first-run-admin',
      testDir: './tests/first-run',
      testIgnore: [],
      testMatch: /.*\.admin\.spec\.mjs/,
      // the viewer must see the empty state before the admin creates a space;
      // creating it is not repeatable, so no retry
      dependencies: ['setup', 'first-run-viewer'],
      retries: 0,
      use: { ...devices['Desktop Chrome'], storageState: USERS.admin.storageState },
    },
    {
      name: 'upgrade',
      testDir: './tests/upgrade',
      testIgnore: [],
      dependencies: ['setup'],
      retries: 0,
      use: { ...devices['Desktop Chrome'], storageState: USERS.admin.storageState },
    },
  ],
});
