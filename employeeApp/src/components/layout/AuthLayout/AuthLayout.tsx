import type { ReactNode } from "react";
import { Logo } from "../../ui/Logo/Logo";
import styles from "./AuthLayout.module.css";

type AuthLayoutProps = {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
};

/** The login page: one centered card. Fills the whole screen on phones. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Logo size={56} />
        <div className={styles.title}>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {children}
        <p className={styles.foot}>Pit's Burger</p>
      </div>
    </main>
  );
}
