"use client";

import { useEffect, useRef } from "react";

export interface SheetAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

/**
 * The iPhone-style menu behind a "…" button: rare actions, with Close at the bottom.
 * A native modal dialog, so focus stays inside, Escape closes it, and the page behind can't be tapped.
 */
export function ActionSheet({ open, title, actions, onClose }: { open: boolean; title: string; actions: SheetAction[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="action-sheet"
      aria-label={title}
      onClose={onClose}
      // A tap on the dimmed backdrop lands on the dialog itself: close, as iPhone does.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="action-group">
        <p>{title}</p>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.destructive ? "destructive" : undefined}
            onClick={() => {
              onClose();
              action.onSelect();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="action-group">
        <button type="button" className="close" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
