import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Button } from "../../../../components/ui/Button/Button";
import { TextField } from "../../../../components/ui/Input/TextField";
import { toApiError } from "../../../../lib/apiClient";
import { useDeletePosition } from "../../api/useDeletePosition";
import type { Position } from "../../types";
import styles from "./DeletePosition.module.css";

type DeletePositionProps = {
  position: Position;
  /** Called when the window should go away: cancelled, or the position is deleted. */
  onClose: () => void;
};

/**
 * A modal window that deletes a position. Deleting can't be undone, so the
 * owner has to type the position's name before the button works.
 *
 * It is a native <dialog> opened with showModal(), so the browser keeps Tab
 * inside it, makes the page behind it inert, closes it on Escape and gives the
 * focus back to the button that opened it.
 */
export function DeletePosition({ position, onClose }: DeletePositionProps) {
  const remove = useDeletePosition();
  const [typedName, setTypedName] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const warningId = useId();

  const confirmed = typedName.trim() === position.name;
  const serverError = remove.error ? toApiError(remove.error) : null;

  // A layout effect, so close() runs while the dialog is still in the page:
  // only then does the browser return the focus to where it was.
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  // Closing fires the dialog's "close" event, which calls onClose.
  // While the request is running the window stays, so its result is seen.
  function close() {
    if (!remove.isPending) dialog.current?.close();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || remove.isPending) return;
    remove.mutate(position.id, { onSuccess: onClose });
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={warningId}
      // Escape: the browser closes the dialog unless this is prevented.
      onCancel={(event) => {
        if (remove.isPending) event.preventDefault();
      }}
      // "close" arrives a moment after close(). In development StrictMode runs
      // the effect above twice (open, close, open), so the event of that first
      // close arrives when the dialog is open again: that one is ignored.
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      // The dialog itself is only hit outside the panel: on the backdrop.
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        // Or the click would move the focus to the page right after close()
        // gave it back to the button that opened the window.
        event.preventDefault();
        close();
      }}
    >
      <div className={styles.panel}>
        <h2 id={titleId} className={styles.title}>
          Delete {position.name}?
        </h2>
        <p id={warningId} className={styles.warning}>
          Deleting this position also removes it from every employee who has it. The employees
          themselves stay. This can't be undone.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {serverError && (
            <Alert title="Couldn't delete the position" detail={serverError.message} />
          )}
          <TextField
            label={`Type "${position.name}" to confirm`}
            name="confirmName"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={typedName}
            onChange={(event) => {
              setTypedName(event.target.value);
              if (remove.isError) remove.reset();
            }}
          />
          <div className={styles.buttons}>
            <Button variant="secondary" disabled={remove.isPending} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!confirmed || remove.isPending}>
              {remove.isPending ? "Deleting …" : "Delete position"}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
