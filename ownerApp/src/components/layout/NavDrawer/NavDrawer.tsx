import { XIcon } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./NavDrawer.module.css";

type NavDrawerProps = {
  /** Called when the drawer has closed: the close button, Escape, the backdrop or a link. */
  onClose: () => void;
  children: ReactNode;
};

/**
 * The dashboard's menu on small screens: a panel that slides in from the left
 * over the page. It is a native <dialog> opened with showModal(), so the
 * browser keeps Tab inside it, makes the page behind it inert, closes it on
 * Escape and gives the focus back to the menu button that opened it.
 * A click on a link inside it closes it too, as the page changes.
 */
export function NavDrawer({ onClose, children }: NavDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  // A layout effect, so close() runs while the dialog is still in the page:
  // only then does the browser return the focus to where it was.
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  // Closing fires the dialog's "close" event, which calls onClose.
  function close() {
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className={styles.drawer}
      aria-label="Menu"
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
        // gave it back to the menu button.
        event.preventDefault();
        close();
      }}
    >
      <div
        className={styles.panel}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) close();
        }}
      >
        <button type="button" className={styles.close} aria-label="Close menu" onClick={close}>
          <XIcon />
        </button>
        {children}
      </div>
    </dialog>
  );
}
