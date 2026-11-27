import { MobileAppBar } from "../../../../components/layout/MobileAppBar/MobileAppBar";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Button } from "../../../../components/ui/Button/Button";
import { Spinner } from "../../../../components/ui/Spinner/Spinner";
import { toApiError } from "../../../../lib/apiClient";
import { useCurrentUser, useLogout } from "../../../auth";
import { useAvailability } from "../../api/useAvailability";
import { AvailabilityWeek } from "../AvailabilityWeek/AvailabilityWeek";
import styles from "./Availability.module.css";

/**
 * The employee app's one screen: the app bar, then next week's availability
 * (or the week that was submitted, while the window is closed).
 */
export function Availability() {
  const user = useCurrentUser();
  const logout = useLogout();
  const {
    data: week,
    error,
    isPending,
    isRefetchError,
    refetch,
    isFetching,
  } = useAvailability();

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "";

  return (
    <div className={styles.screen}>
      <MobileAppBar
        name={name}
        onLogout={() => logout.mutate()}
        loggingOut={logout.isPending}
      />

      {logout.isError && (
        <div className={styles.notice}>
          <Alert
            title="Couldn't log out"
            detail={toApiError(logout.error).message}
          />
        </div>
      )}

      {isPending ? (
        <main className={styles.center}>
          <Spinner label="Loading your availability" />
        </main>
      ) : !week ? (
        <main className={styles.notice}>
          <Alert
            title="Couldn't load your availability"
            detail={toApiError(error).message}
          />
          <Button
            variant="secondary"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? "Trying again …" : "Try again"}
          </Button>
        </main>
      ) : (
        <>
          {isRefetchError && (
            <div className={styles.notice}>
              <Alert
                title="Couldn't refresh"
                detail={`${
                  toApiError(error).message
                } What you see may be out of date.`}
              />
            </div>
          )}
          <AvailabilityWeek key={week.weekStart} week={week} />
        </>
      )}
    </div>
  );
}
