import { useRouteError } from "react-router";
import { Alert } from "../../ui/Alert/Alert";
import { Button } from "../../ui/Button/Button";
import { CenterScreen } from "../CenterScreen/CenterScreen";
import styles from "./RouteError.module.css";

/**
 * The root route's errorElement: shown on the whole screen instead of a
 * screen that crashed. The app has no lazy pages, so there are no chunks
 * that can go missing after a deploy.
 */
export function RouteError() {
  const error = useRouteError();

  return (
    <CenterScreen>
      <div className={styles.error}>
        <Alert
          title="Something went wrong"
          detail="This screen couldn't be shown. Reloading usually fixes it."
        />
        {import.meta.env.DEV && error instanceof Error && (
          <pre className={styles.details}>{error.message}</pre>
        )}
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </CenterScreen>
  );
}
