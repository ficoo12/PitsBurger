import { useRef, type KeyboardEvent } from "react";
import tone from "../../shiftTone.module.css";
import styles from "./ShiftPicker.module.css";

type Shift = { id: number; name: string };

type ShiftPickerProps = {
  /** Read by screen readers, e.g. "Monday 30 Nov". */
  label: string;
  shifts: Shift[];
  /** The picked shift, or null for "–" (not available). */
  value: number | null;
  onChange: (shiftId: number | null) => void;
};

const NOT_AVAILABLE = { id: null, name: "–" } as const;

/**
 * One day's choice: one segment per shift plus "–". The picked segment is
 * filled (see ShiftTone). A radio group: Tab reaches the picked segment,
 * the arrow keys move and pick.
 */
export function ShiftPicker({ label, shifts, value, onChange }: ShiftPickerProps) {
  const options: { id: number | null; name: string }[] = [...shifts, NOT_AVAILABLE];
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Four to a row as in the design; more shifts wrap to a second row.
  const columns = Math.min(options.length, 4);

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div
      className={styles.picker}
      role="radiogroup"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const checked = option.id === value;
        return (
          <button
            key={option.id ?? "none"}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.id === null ? "Not available" : option.name}
            tabIndex={checked ? 0 : -1}
            className={`${styles.option} ${checked ? tone.tone : ""}`}
            data-tone={
              checked ? (option.id === null ? "none" : "plain") : undefined
            }
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

type ShiftValueProps = {
  /** The shift's name, or null for not available. */
  name: string | null;
};

/** A day's value when the screen is read-only, in the same colour as the picker. */
export function ShiftValue({ name }: ShiftValueProps) {
  return (
    <div
      className={`${styles.value} ${tone.tone}`}
      data-tone={name === null ? "none" : "plain"}
    >
      {name ?? "–"}
      {name === null && <span className={styles.srOnly}> Not available</span>}
    </div>
  );
}

/** A day with nothing submitted, when the screen is read-only. */
export function EmptyValue() {
  return <div className={`${styles.value} ${styles.empty}`}>Not submitted</div>;
}
