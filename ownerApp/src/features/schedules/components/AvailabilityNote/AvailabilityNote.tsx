import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift as shiftAway,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useId, useState } from "react";
import styles from "./AvailabilityNote.module.css";

type AvailabilityNoteProps = {
  /** The person's full name, for the dot's label and the popover's title. */
  name: string;
  /** The note they sent with their availability for the week. */
  note: string;
};

/**
 * A small red dot after a name in the schedule: the person sent a note with
 * their availability. Clicking it shows the note in a popover under the dot;
 * Escape or a click outside closes it, and the focus goes back to the dot.
 */
export function AvailabilityNote({ name, note }: AvailabilityNoteProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const {
    refs: { setReference, setFloating },
    floatingStyles,
    context,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    middleware: [offset(6), flip({ padding: 8 }), shiftAway({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  return (
    <>
      <button
        ref={setReference}
        type="button"
        className={styles.dot}
        aria-label={`Note from ${name}`}
        {...getReferenceProps()}
      />
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} returnFocus>
            <div
              ref={setFloating}
              style={floatingStyles}
              className={styles.popover}
              aria-labelledby={titleId}
              {...getFloatingProps()}
            >
              <h2 id={titleId} className={styles.title}>
                Note from {name}
              </h2>
              <p className={styles.text}>{note}</p>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
