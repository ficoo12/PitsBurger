import { useId } from "react";
import { NOTE_MAX } from "./validation";
import styles from "./NoteField.module.css";

type NoteFieldProps = {
  value: string;
  onChange: (note: string) => void;
  error?: string;
};

/** The optional note for the manager, up to 100 characters, with a counter. */
export function NoteField({ value, onChange, error }: NoteFieldProps) {
  const id = useId();
  const length = value.trim().length;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Note for your manager (optional)
      </label>
      <textarea
        id={id}
        name="note"
        rows={2}
        className={[styles.input, error && styles.invalid].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-message`}
        placeholder="e.g. Only from 12:00 on Monday"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className={styles.row} id={`${id}-message`}>
        {error ? <span className={styles.error}>{error}</span> : <span />}
        <span className={length > NOTE_MAX ? styles.error : styles.count}>
          {length}/{NOTE_MAX}
        </span>
      </div>
    </div>
  );
}

/** The saved note when the screen is read-only. */
export function NoteText({ note }: { note: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>Note for your manager</span>
      <p className={styles.text}>{note}</p>
    </div>
  );
}
