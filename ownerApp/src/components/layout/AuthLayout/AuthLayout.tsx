import type { ReactNode } from "react";
import { Logo } from "../../ui/Logo/Logo";
import { AuthArt } from "./AuthArt";
import styles from "./AuthLayout.module.css";

type AuthLayoutProps = {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
};

/** Split screen for the login page: content on the left, the schedule illustration on the right. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.card}>
          <Logo size={56} />
          <div className={styles.title}>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {children}
          <p className={styles.foot}>
            Pit's Burger · Manager app for owners and managers
          </p>
        </div>
      </main>
      <AuthArt />
    </div>
  );
}
