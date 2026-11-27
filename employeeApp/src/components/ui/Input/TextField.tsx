import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./Input.module.css";

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  /** md: 40px (dashboard); lg: 48px (signup and login). */
  size?: "md" | "lg";
  /** Shown below the input while there is no error. */
  hint?: string;
  /** Marks the input invalid and is shown instead of the hint. */
  error?: string;
  /** A button inside the input on the right, e.g. the password show / hide toggle. */
  trailing?: ReactNode;
};

/** A labelled text input with an optional hint or error below it. */
export function TextField({ label, size = "md", hint, error, trailing, id, className, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? hint;
  const messageId = message ? `${inputId}-message` : undefined;

  const input = (
    <input
      id={inputId}
      className={[styles.input, size === "lg" && styles.lg, error && styles.invalid].filter(Boolean).join(" ")}
      aria-invalid={error ? true : undefined}
      aria-describedby={messageId}
      {...props}
    />
  );

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      {trailing ? (
        <div className={styles.control}>
          {input}
          {trailing}
        </div>
      ) : (
        input
      )}
      {message && (
        <span id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </span>
      )}
    </div>
  );
}
