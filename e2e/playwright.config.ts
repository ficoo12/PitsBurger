import { defineConfig, devices, type Project } from "@playwright/test";
import { API_URL, EMPLOYEE_URL, OWNER_URL, backendEnv } from "./support/env.js";

// Production builds of the backend and both apps, on the dev ports.
// reuseExistingServer is false on purpose: a running dev backend would point
// the tests at your dev database, so the run fails until dev servers are stopped.
const SERVER_TIMEOUT_MS = 180_000;

// tests/owner/ → owner app, tests/employee/ → employee app, tests/cross/ →
// both apps (absolute URLs). The smoke test runs in every project.
const chromiumProjects: Project[] = [
  {
    name: "owner-chromium",
    testMatch: [/[\\/](owner|cross)[\\/]/, /smoke\.spec\.ts/],
    use: { ...devices["Desktop Chrome"], baseURL: OWNER_URL },
  },
  {
    name: "employee-chromium",
    testMatch: [/[\\/]employee[\\/]/, /smoke\.spec\.ts/],
    use: { ...devices["Desktop Chrome"], baseURL: EMPLOYEE_URL },
  },
];

// WebKit runs in CI (Linux) only: Playwright's WebKit build crashes on launch
// on the dev Mac (macOS 14.1.1, "Bus error").
const webkitProjects: Project[] = [
  {
    name: "owner-webkit",
    testMatch: [/[\\/]owner[\\/]/, /smoke\.spec\.ts/],
    use: { ...devices["Desktop Safari"], baseURL: OWNER_URL },
  },
  {
    name: "employee-iphone",
    testMatch: [/[\\/](employee|cross)[\\/]/, /smoke\.spec\.ts/],
    use: { ...devices["iPhone 15"], baseURL: EMPLOYEE_URL },
  },
];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  webServer: [
    {
      // prepareDb.mjs runs first, so the database is ready before the server starts.
      command:
        "node support/prepareDb.mjs && npm --prefix ../backend run build && npm --prefix ../backend start",
      url: `${API_URL}/health`,
      env: backendEnv,
      reuseExistingServer: false,
      timeout: SERVER_TIMEOUT_MS,
    },
    {
      command:
        "npm --prefix ../ownerApp run build && npm --prefix ../ownerApp run preview -- --port 5173 --strictPort",
      url: OWNER_URL,
      reuseExistingServer: false,
      timeout: SERVER_TIMEOUT_MS,
    },
    {
      command:
        "npm --prefix ../employeeApp run build && npm --prefix ../employeeApp run preview -- --port 5174 --strictPort",
      // With the trailing slash: Vite answers /employee (no slash) with a 404.
      url: `${EMPLOYEE_URL}/`,
      reuseExistingServer: false,
      timeout: SERVER_TIMEOUT_MS,
    },
  ],

  projects: [...chromiumProjects, ...(process.env.CI ? webkitProjects : [])],
});
