import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function TopbarActionMenu({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <details className="theme-topbar-menu">
      <summary className="theme-quiet-button theme-topbar-menu-trigger flex items-center gap-1.5 px-2.5 py-1.5">
        {icon}
        <span>{label}</span>
        <ChevronDown className="h-3 w-3 theme-topbar-menu-chevron" aria-hidden="true" />
      </summary>
      <div className="theme-topbar-menu-panel" role="menu">
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
        window.setTimeout(() => parentMenu?.removeAttribute("open"), 0);
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
