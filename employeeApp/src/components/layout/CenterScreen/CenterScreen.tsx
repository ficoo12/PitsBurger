import type { ReactNode } from "react";
import styles from "./CenterScreen.module.css";

export function CenterScreen({ children }: { children: ReactNode }) {
  return <div className={styles.centerScreen}>{children}</div>;
}
