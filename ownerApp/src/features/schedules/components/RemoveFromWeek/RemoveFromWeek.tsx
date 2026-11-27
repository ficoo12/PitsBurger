import { useId, useLayoutEffect, useRef } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { fullName } from "../../../employees";
import { hasAvailability, type ScheduleRow } from "../../scheduleRows";
import { weekLabel } from "../../week";
import styles from "./RemoveFromWeek.module.css";

type RemoveFromWeekProps = {
  row: ScheduleRow;
  restaurantName: string;
  /** The shown week's Monday, "YYYY-MM-DD". */
  weekStart: string;
  /** Takes the row out of the week; only offered for a row the owner added. */
  onRemove: () => void;
  /** Called when the window should go away: cancelled, or the row is removed. */
  onClose: () => void;
};

/**
 * A modal window that takes a person out of one zone of a restaurant's week.
 * Only a row the owner added can go. A row that is there because of saved
 * shifts stays until those shifts are cleared, and one that is there because
 * of the person's availability stays all week, so the window only says so.
 *
 * A native <dialog> opened with showModal(), like DeleteEmployee: the browser
 * keeps Tab inside it, closes it on Escape and gives the focus back.
 */
export function RemoveFromWeek({ row, restaurantName, weekStart, onRemove, onClose }: RemoveFromWeekProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();

  const name = fullName(row.employee);
  const zone = row.position ? row.position.name : "this list";
  const shifts = row.cells.size;

  // A layout effect, so close() runs while the dialog is still in the page:
  // only then does the browser return the focus to where it was.
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function close() {
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={textId}
      // "close" arrives a moment after close(). In development StrictMode runs
      // the effect above twice (open, close, open), so the event of that first
      // close arrives when the dialog is open again: that one is ignored.
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
        {row.added ? (
          <>
            <h2 id={titleId} className={styles.title}>
              Remove {name}?
            </h2>
            <p id={textId} className={styles.text}>
              This takes {name} out of {zone} at {restaurantName} for {weekLabel(weekStart)}.
            </p>
            <div className={styles.buttons}>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                autoFocus
                onClick={() => {
                  onRemove();
                  close();
                }}
              >
                Remove
              </Button>
            </div>
          </>
        ) : hasAvailability(row) ? (
          <>
            <h2 id={titleId} className={styles.title}>
              {name} can't be removed
            </h2>
            <p id={textId} className={styles.text}>
              {name} sent their availability for {weekLabel(weekStart)}, so they stay on the
              week at {restaurantName}.
            </p>
            <div className={styles.buttons}>
              <Button autoFocus onClick={close}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId} className={styles.title}>
              {name} can't be removed yet
            </h2>
            <p id={textId} className={styles.text}>
              {name} has {shifts === 1 ? "1 shift" : `${shifts} shifts`} at {restaurantName} this
              week. Clear {shifts === 1 ? "it" : "them"} first, then remove the row.
            </p>
            <div className={styles.buttons}>
              <Button autoFocus onClick={close}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
