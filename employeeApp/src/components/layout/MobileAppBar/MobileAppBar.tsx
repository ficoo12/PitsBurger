import { LogOutIcon } from "../../ui/Icon/Icon";
import styles from "./MobileAppBar.module.css";

type MobileAppBarProps = {
  name: string;
  onLogout: () => void;
  loggingOut?: boolean;
};

/** The employee app's top bar: logo, who is signed in, and Log out. The app has no other navigation. */
export function MobileAppBar({
  name,

  onLogout,
  loggingOut = false,
}: MobileAppBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <strong className={styles.logo}>Pit's Burger</strong>
        <div className={styles.who}>
          <strong>{name}</strong>
        </div>
        <button
          type="button"
          className={styles.logout}
          onClick={onLogout}
          disabled={loggingOut}
        >
          <LogOutIcon />
          {loggingOut ? "Logging out …" : "Log out"}
        </button>
      </div>
    </header>
  );
}
