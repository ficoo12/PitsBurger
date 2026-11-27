import styles from "./ColourChip.module.css";

type ColourChipProps = {
  /** The CSS colours, as stripes from left to right. */
  colours: string[];
  /** The colour's name, shown as a tooltip, e.g. "Red". */
  label: string;
};

/**
 * A small swatch next to a name in a list: the colour it has in the schedule.
 * Hidden from screen readers, so the row is still called by its name alone.
 */
export function ColourChip({ colours, label }: ColourChipProps) {
  return (
    <span className={styles.chip} aria-hidden="true" title={label}>
      {colours.map((colour) => (
        <span key={colour} className={styles.stripe} style={{ background: colour }} />
      ))}
    </span>
  );
}
