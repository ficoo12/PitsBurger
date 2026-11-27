// After a deploy, a tab that is still open on the old version asks for page
// chunks (route `lazy`) whose files are gone. Reloading loads the new version.

const KEY = "reloaded-for-stale-chunk-at";
const WINDOW_MS = 10_000;

/** The browsers' messages for a dynamic import whose file is gone (Chrome, Firefox, Safari). */
export function isStaleChunkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed/i.test(error.message)
  );
}

/**
 * Reloads the page, unless it already did so in the last 10 seconds: then the
 * file is missing for another reason and reloading again would loop.
 * Returns whether it reloads.
 */
export function reloadOnce(reload = () => window.location.reload(), now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY));
    if (last && now - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    // No storage (e.g. blocked): show the error screen instead of risking a loop.
    return false;
  }
  reload();
  return true;
}
