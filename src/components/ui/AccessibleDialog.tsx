import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface AccessibleDialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** Native modal: top layer, inert background, focus containment and Escape. */
export function AccessibleDialog({ open, onClose, labelledBy, children, className = '', id }: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  return createPortal(
    <dialog id={id} ref={dialogRef} aria-labelledby={labelledBy} aria-modal="true"
      className={`accessible-dialog ${className}`}
      onCancel={event => { event.preventDefault(); closeRef.current(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRef.current();
      }}>
      {open ? children : null}
    </dialog>, document.body,
  );
}
