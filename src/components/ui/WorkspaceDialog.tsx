import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function WorkspaceDialog({ open, onClose, title, children, className = "" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  return (
    <dialog ref={ref} className={`entropy-dialog ${className}`} aria-labelledby={titleId}
      onCancel={() => closeRef.current()}
      onClick={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}>
      {open && <div className="entropy-dialog-content">
        <header className="entropy-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="entropy-icon-button" onClick={onClose} aria-label={`Close ${title}`} title="Close"><X size={18} /></button>
        </header>
        {children}
      </div>}
    </dialog>
  );
}
