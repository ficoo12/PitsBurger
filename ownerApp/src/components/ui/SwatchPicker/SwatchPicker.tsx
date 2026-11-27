import { useId } from "react";
import styles from "./SwatchPicker.module.css";

export type SwatchOption<T extends string> = {
  value: T;
  /** What the swatch is called, e.g. "Red" or "Early". Shown under it. */
  label: string;
  /** The CSS colours the swatch shows, as stripes from left to right. */
  colours: string[];
  /** Whose colour it is, e.g. "Kitchen". The swatch can't be picked then. */
  takenBy?: string;
};

type SwatchPickerProps<T extends string> = {
  legend: string;
  /** The radio group's name, so the form can focus the first swatch. */
  name: string;
  options: SwatchOption<T>[];
  /** The picked value, or null while nothing is picked. */
  value: T | null;
  onChange: (value: T) => void;
  /** Shown under the swatches while there is no error. */
  hint?: string;
  /** Marks the group invalid and is shown instead of the hint. */
  error?: string;
};

/**
 * A row of colour swatches to pick one from, as radio buttons, so arrow keys
 * move between them. A swatch another record already has is disabled and
 * says whose it is.
 */
export function SwatchPicker<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  hint,
  error,
}: SwatchPickerProps<T>) {
  const messageId = useId();
  const message = error ?? hint;

  return (
    <fieldset
      className={styles.field}
      aria-describedby={message ? messageId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.swatches}>
        {options.map((option) => {
          const taken = option.takenBy !== undefined;
          return (
            <label
              key={option.value}
              className={styles.option}
              data-taken={taken || undefined}
              title={taken ? `Used by ${option.takenBy}` : undefined}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                className={styles.input}
                checked={value === option.value}
                disabled={taken}
                aria-label={taken ? `${option.label}, used by ${option.takenBy}` : option.label}
                onChange={() => onChange(option.value)}
              />
              <span
                className={[styles.swatch, error && styles.invalid].filter(Boolean).join(" ")}
                aria-hidden="true"
              >
                {option.colours.map((colour) => (
                  <span key={colour} className={styles.stripe} style={{ background: colour }} />
                ))}
              </span>
              <span className={styles.label} aria-hidden="true">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      {message && (
        <span id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </span>
      )}
    </fieldset>
  );
}
