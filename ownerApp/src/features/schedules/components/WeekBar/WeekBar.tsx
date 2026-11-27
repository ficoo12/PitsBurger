import type { ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "../../../../components/ui/Button/Button";
import { addWeeks, thisWeekStart, weekLabel } from "../../week";
import styles from "./WeekBar.module.css";

type WeekBarProps = {
  /** The shown week's Monday, "YYYY-MM-DD". */
  weekStart: string;
  onChange: (weekStart: string) => void;
  /** Buttons for the shown week, left of "This week". */
  actions?: ReactNode;
};

/**
 * Above the schedules: arrows to the previous and next week around the shown
 * week's dates, and on the right the week's actions and a button back to
 * this week.
 */
export function WeekBar({ weekStart, onChange, actions }: WeekBarProps) {
  const today = thisWeekStart();

  return (
    <div className={styles.bar}>
      <div className={styles.week}>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Previous week"
          onClick={() => onChange(addWeeks(weekStart, -1))}
        >
          <ChevronLeftIcon />
        </button>
        <p className={styles.label} aria-live="polite">
          {weekLabel(weekStart)}
        </p>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Next week"
          onClick={() => onChange(addWeeks(weekStart, 1))}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <div className={styles.actions}>
        {actions}
        <Button variant="secondary" disabled={weekStart === today} onClick={() => onChange(today)}>
          This week
        </Button>
      </div>
    </div>
  );
}
