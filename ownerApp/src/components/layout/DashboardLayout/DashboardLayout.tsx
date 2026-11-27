import {
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  MenuIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useCurrentUser, useLogout } from "../../../features/auth";
import { Alert } from "../../ui/Alert/Alert";
import { Button } from "../../ui/Button/Button";
import { Logo } from "../../ui/Logo/Logo";
import { NavDrawer } from "../NavDrawer/NavDrawer";
import styles from "./DashboardLayout.module.css";

// Excerpt: the full app's sidebar also links to employees, restaurants,
// contracts, shifts and availability.
const links: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { to: "/dashboard/positions", label: "Positions", icon: BriefcaseBusinessIcon },
];

/**
 * The dashboard shell: a sidebar with the main links, and the current page
 * next to it. Below 768px the sidebar is replaced by a top bar whose menu
 * button opens the same content in a drawer.
 */
export function DashboardLayout() {
  const user = useCurrentUser();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  // The name is optional on an account; the email always exists.
  const displayName =
    user && ([user.firstName, user.lastName].filter(Boolean).join(" ") || user.email);

  return (
    <div className={styles.layout}>
      {/* Only below 768px (see the CSS). */}
      <header className={styles.topBar}>
        <Logo />
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <MenuIcon />
        </button>
      </header>
      <aside className={styles.sidebar}>
        <SidebarContent displayName={displayName} logout={logout} />
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
      {menuOpen && (
        <NavDrawer onClose={() => setMenuOpen(false)}>
          <SidebarContent displayName={displayName} logout={logout} />
        </NavDrawer>
      )}
    </div>
  );
}

type SidebarContentProps = {
  displayName: string | null;
  /** One logout for the sidebar and the drawer, so both show the same state. */
  logout: ReturnType<typeof useLogout>;
};

/** What the sidebar and the drawer both show: the logo, the main links, and who is signed in with Log out. */
function SidebarContent({ displayName, logout }: SidebarContentProps) {
  return (
    <>
      <Logo />
      <nav className={styles.nav} aria-label="Main">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.footer}>
        {displayName && <span className={styles.user}>{displayName}</span>}
        <Button
          variant="secondary"
          block
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Log out
        </Button>
        {logout.isError && (
          <Alert title="Couldn't log out" detail={logout.error.message} />
        )}
      </div>
    </>
  );
}
