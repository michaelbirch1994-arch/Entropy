import type { ReactNode } from "react";
import { inferSurfaceTone, type SurfaceTone } from "../../utils/themeTone";

interface PanelProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: string;
  tone?: SurfaceTone;
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
  tone,
  empty,
}: PanelProps) {
  const surfaceTone = tone ?? inferSurfaceTone(accent);

  return (
    <section
      className={`theme-panel min-w-0 overflow-hidden rounded-2xl ${className}`}
      data-tone={surfaceTone}
    >
      {title && (
        <header className="theme-panel-header flex min-h-[3.75rem] items-center justify-between gap-4 border-b border-theme-border/50 px-5 py-3.5">
          <div className="min-w-0 flex flex-col gap-1">
            <div className="theme-panel-title flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase leading-[1.35] tracking-[0.045em] text-theme-text">
              {icon && <span className="theme-panel-icon shrink-0 text-theme-accent-strong">{icon}</span>}
              <span className="min-w-0">{title}</span>
            </div>
            {subtitle && (
              <p className="theme-panel-subtitle max-w-[68ch] text-[12px] font-normal leading-[1.55] text-theme-muted">{subtitle}</p>
            )}
          </div>
          {action && <div className="theme-panel-action shrink-0 text-[11px] font-mono text-theme-muted">{action}</div>}
        </header>
      )}
      <div className={`theme-panel-body min-w-0 ${bodyClassName || "p-5"}`}>{empty ?? children}</div>
    </section>
  );
}
