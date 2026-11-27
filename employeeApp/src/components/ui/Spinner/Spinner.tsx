import styles from "./Spinner.module.css";

type SpinnerProps = {
  /** What is loading, for screen readers. */
  label?: string;
};

/** A spinning ring for waits of unknown length. Appears only after 300ms. */
export function Spinner({ label = "Loading" }: SpinnerProps) {
  return (
    <div role="status">
      <div className={styles.spinner} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
