import { useEffect } from "react";
import { useRouteError } from "react-router";
import { isStaleChunkError, reloadOnce } from "../../../lib/staleChunk";
import { Alert } from "../../ui/Alert/Alert";
import { Button } from "../../ui/Button/Button";
import { CenterScreen } from "../CenterScreen/CenterScreen";
import styles from "./RouteError.module.css";

type RouteErrorProps = {
  /** The whole screen (outside the dashboard); otherwise only the page area, beside the sidebar. */
  fullScreen?: boolean;
};

/**
 * A route's errorElement: shown instead of a page that crashed or whose code
 * couldn't be loaded. A chunk from an older deploy reloads the page once by
 * itself (Vite's preload event usually does that already, in main.tsx).
 */
export function RouteError({ fullScreen = false }: RouteErrorProps) {
  const error = useRouteError();
  const stale = isStaleChunkError(error);

  // For a failed import that didn't go through Vite's preload helper.
  useEffect(() => {
    if (stale) reloadOnce();
  }, [stale]);

  const content = (
    <div className={styles.error}>
      <Alert
        title="Something went wrong"
        detail={
          stale
            ? "A new version of the app is available. Reload to get it."
            : "This page couldn't be shown. Reloading usually fixes it."
        }
      />
      {import.meta.env.DEV && error instanceof Error && (
        <pre className={styles.details}>{error.message}</pre>
      )}
      <Button variant="secondary" onClick={() => window.location.reload()}>
        Reload page
      </Button>
    </div>
  );

  return fullScreen ? <CenterScreen>{content}</CenterScreen> : content;
}
