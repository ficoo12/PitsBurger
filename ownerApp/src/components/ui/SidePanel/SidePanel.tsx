import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import styles from "./SidePanel.module.css";

type SidePanelProps = {
  title: string;
  subtitle?: string;
  /** Called on the close button and on Escape inside the panel. */
  onClose: () => void;
  children: ReactNode;
};

/**
 * A panel that slides in from the right edge, beside the page. It isn't
 * modal: the page behind stays usable (and things can be dragged from the
 * panel onto it). On open the focus moves to the panel's close button; when
 * it goes away the focus goes back to where it was, e.g. the button that
 * opened it.
 */
export function SidePanel({ title, subtitle, onClose, children }: SidePanelProps) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);

  // A layout effect, so the focus moves before the browser paints the panel.
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={styles.panel}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className={styles.header}>
        <div>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <button
          ref={closeButton}
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon />
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
