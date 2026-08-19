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
  return (
    <section
      className={`theme-panel rounded-2xl ${className}`}
      data-tone={tone ?? inferSurfaceTone(accent)}
    >
      {title && (
        <header className="theme-panel-header flex items-center justify-between border-b border-theme-border/50 px-5 py-3.5">
          <div className="flex flex-col gap-0.5">
            <div className="theme-panel-title flex items-center gap-2 text-xs font-bold uppercase text-theme-text">
              {icon && <span className={accent ?? "text-theme-accent"}>{icon}</span>}
              {title}
            </div>
            {subtitle && (
              <p className="theme-panel-subtitle text-[11px] text-theme-muted font-medium">{subtitle}</p>
            )}
          </div>
          {action && <div className="text-[11px] font-mono text-theme-muted">{action}</div>}
        </header>
      )}
      <div className={`theme-panel-body ${bodyClassName || "p-5"}`}>{empty ?? children}</div>
    </section>
  );
}
