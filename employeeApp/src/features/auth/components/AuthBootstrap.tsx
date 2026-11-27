import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router";
import { CenterScreen } from "../../../components/layout/CenterScreen/CenterScreen";
import { Alert } from "../../../components/ui/Alert/Alert";
import { Button } from "../../../components/ui/Button/Button";
import { Spinner } from "../../../components/ui/Spinner/Spinner";
import { sessionQuery } from "../api/useCurrentUser";
import { useSessionExpiry } from "../hooks/useSessionExpiry";

/**
 * Root route: holds every page back until /employees/me has answered,
 * so a signed-in employee never sees the login page flash. Also watches for the
 * session ending later (useSessionExpiry).
 */
export function AuthBootstrap() {
  const session = useQuery(sessionQuery);
  useSessionExpiry();

  // Also covers the retries after a failed first try.
  if (session.isPending) {
    return (
      <CenterScreen>
        <Spinner />
      </CenterScreen>
    );
  }

  // Only when the very first check failed: a failed refresh later keeps the user we have.
  if (session.data === undefined) {
    return (
      <CenterScreen>
        <Alert title="Connection failed" detail={session.error?.message} />
        {/* Retrying goes back to the spinner above, so this can't be clicked twice. */}
        <Button variant="secondary" onClick={() => void session.refetch()}>
          Try again
        </Button>
      </CenterScreen>
    );
  }

  return <Outlet />;
}
