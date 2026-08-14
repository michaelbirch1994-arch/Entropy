import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: string;
  empty?: ReactNode;
}

export default function Panel({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
  bodyClassName = "",
  accent,
  empty,
}: PanelProps) {
  return (
    <section
      className={`theme-panel rounded-2xl ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-theme-border/50 px-5 py-3.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-theme-text">
              {icon && <span className={accent ?? "text-theme-accent"}>{icon}</span>}
              {title}
            </div>
            {subtitle && (
              <p className="text-[10px] text-theme-muted font-medium">{subtitle}</p>
            )}
          </div>
          {action && <div className="text-[10px] font-mono text-theme-muted">{action}</div>}
        </header>
      )}
      <div className={bodyClassName || "p-5"}>{empty ?? children}</div>
    </section>
  );
}
