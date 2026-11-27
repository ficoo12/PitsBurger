import type { ReactNode } from "react";
import { AlertIcon, CheckCircleIcon } from "../Icon/Icon";
import styles from "./Alert.module.css";

type AlertProps = {
  title: string;
  detail?: ReactNode;
  /** error: brand-red tint; success: green tint; neutral: grey, for plain information. */
  tone?: "error" | "success" | "neutral";
  /** Defaults to a check for success and an alert circle otherwise. */
  icon?: ReactNode;
};

/** A banner shown inline above the content it belongs to (never a popup). */
export function Alert({ title, detail, tone = "error", icon }: AlertProps) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {icon ?? (tone === "success" ? <CheckCircleIcon /> : <AlertIcon />)}
      <div>
        <strong className={styles.title}>{title}</strong>
        {detail && <span className={styles.detail}>{detail}</span>}
      </div>
    </div>
  );
}
