import { CheckCircleIcon, ClockIcon, LockIcon } from "../../../../components/ui/Icon/Icon";
import styles from "./StatusBanner.module.css";

type StatusBannerProps = {
  /**
   * open: the employee can save (green); closed: outside the window (grey);
   * locked: no changes left (red); saved: the short "Saved" toast (black).
   */
  tone: "open" | "closed" | "locked" | "saved";
  title: string;
  detail: string;
  /** One bar per change after the first submit; the used ones are faded. */
  pips?: { total: number; left: number };
};

const ICONS = {
  open: ClockIcon,
  closed: LockIcon,
  locked: LockIcon,
  saved: CheckCircleIcon,
};

/** Whether the employee can enter availability right now, and how many changes are left. */
export function StatusBanner({ tone, title, detail, pips }: StatusBannerProps) {
  const Icon = ICONS[tone];
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role="status">
      <Icon />
      <div>
        <strong className={styles.title}>{title}</strong>
        <span className={styles.detail}>{detail}</span>
        {pips && pips.total > 0 && (
          <span className={styles.pips} aria-hidden="true">
            {Array.from({ length: pips.total }, (_, index) => (
              <i key={index} className={index < pips.left ? undefined : styles.used} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
