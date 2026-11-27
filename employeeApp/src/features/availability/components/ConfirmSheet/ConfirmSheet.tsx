import { useId, useLayoutEffect, useRef } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { times } from "../../format";
import type { ShiftTone } from "../../shiftTone";
import tone from "../../shiftTone.module.css";
import styles from "./ConfirmSheet.module.css";

export type SummaryDay = {
  /** "Mon". */
  label: string;
  /** What the day shows: a shift name, "–", or "" on a closed day. */
  value: string;
  tone: ShiftTone;
  /** For screen readers, e.g. "Monday: Früh". */
  description: string;
};

type ConfirmSheetProps = {
  /** Monday to Sunday, in the plan's colours. */
  days: SummaryDay[];
  /** How often the employee can still change it after this submit. */
  changesAfter: number;
  /** "Sunday, 23:59". */
  closes: string;
  pending: boolean;
  onConfirm: () => void;
  /** Called when the sheet should go away: Back, Escape or the backdrop. */
  onClose: () => void;
};

/**
 * The bottom sheet before the first submit: the week at a glance and how
 * often it can still be changed. A native <dialog> opened with showModal(),
 * so the browser traps the focus, makes the page inert and handles Escape.
 */
export function ConfirmSheet({ days, changesAfter, closes, pending, onConfirm, onClose }: ConfirmSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // A layout effect, so close() runs while the dialog is still in the page:
  // only then does the browser return the focus to where it was.
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  // Closing fires "close", which calls onClose. While saving the sheet stays.
  function close() {
    if (!pending) dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className={styles.sheet}
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      // In development StrictMode opens, closes and opens the dialog again;
      // the "close" event of that first close arrives while it is open.
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      // The dialog itself is only hit outside the panel: on the backdrop.
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        close();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.grip} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>
          Submit your availability?
        </h2>
        <ul className={styles.summary} aria-label="Your week">
          {days.map((day) => (
            <li key={day.label} className={tone.tone} data-tone={day.tone} aria-label={day.description}>
              <small aria-hidden="true">{day.label}</small>
              <span aria-hidden="true">{day.value}</span>
            </li>
          ))}
        </ul>
        <p className={styles.text}>
          {changesAfter > 0 ? (
            <>
              After this you can change it <b>{times(changesAfter)}</b>, until {closes}.
            </>
          ) : (
            <>
              After this you <b>can't change it</b>.
            </>
          )}
        </p>
        <div className={styles.buttons}>
          <Button size="lg" block disabled={pending} onClick={onConfirm}>
            {pending ? "Submitting …" : "Submit"}
          </Button>
          <Button size="lg" block variant="secondary" disabled={pending} onClick={close}>
            Back
          </Button>
        </div>
      </div>
    </dialog>
  );
}
