import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const TOPBAR_MENU_OPEN_EVENT = "entropy:topbar-menu-open";

export function TopbarActionMenu({
  label,
  icon,
  children,
  align = "end",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const panelId = `${id}-panel`;

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(TOPBAR_MENU_OPEN_EVENT, { detail: id }));
  }, [id, open]);

  useEffect(() => {
    function handlePeerOpen(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener(TOPBAR_MENU_OPEN_EVENT, handlePeerOpen);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener(TOPBAR_MENU_OPEN_EVENT, handlePeerOpen);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [id]);

  return (
    <details
      ref={detailsRef}
      className="theme-topbar-menu"
      data-align={align}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        className="theme-quiet-button theme-topbar-menu-trigger flex items-center gap-1.5 px-2.5 py-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label} menu`}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className="h-3 w-3 theme-topbar-menu-chevron" aria-hidden="true" />
      </summary>
      <div id={panelId} className="theme-topbar-menu-panel" role="menu" hidden={!open}>
        {children}
      </div>
    </details>
  );
}

export function TopbarMenuButton({
  children,
  className = "",
  disabled,
  onClick,
  title,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        const parentMenu = event.currentTarget.closest("details");
        void onClick();
        window.setTimeout(() => {
          if (!parentMenu) return;
          parentMenu.open = false;
          parentMenu.dispatchEvent(new Event("toggle"));
        }, 0);
      }}
      disabled={disabled}
      title={title}
      className={`theme-topbar-menu-item ${className}`}
      role="menuitem"
    >
      {children}
    </button>
  );
}
