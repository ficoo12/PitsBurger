import type { ConsoleMessage, Page } from "@playwright/test";

// A guest's session check answers 401, and the browser logs that response as
// a console error. That one is expected; any other error is a bug.
const GUEST_SESSION_CHECKS = ["/api/auth/me", "/api/employees/me"];

function isGuestSessionCheck(msg: ConsoleMessage): boolean {
  const { url } = msg.location();
  return (
    msg.text().includes("401") &&
    GUEST_SESSION_CHECKS.some((path) => url.endsWith(path))
  );
}

/**
 * Collects uncaught exceptions and console errors of `page`. Call it before
 * navigating, then assert the returned list is empty.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isGuestSessionCheck(msg)) {
      errors.push(`console: ${msg.text()} (${msg.location().url})`);
    }
  });
  return errors;
}
