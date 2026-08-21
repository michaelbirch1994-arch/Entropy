import type { ReactNode } from "react";
import { inferSurfaceTone, type SurfaceTone } from "../../utils/themeTone";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: string;
  tone?: SurfaceTone;
  sub?: string;
  className?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  accent = "text-theme-text",
  tone,
  sub,
  className = "",
}: StatCardProps) {
  const surfaceTone = tone ?? inferSurfaceTone(accent);

  return (
    <div
      className={`theme-stat-card rounded-2xl p-5 flex flex-col gap-3 ${className}`}
      data-tone={surfaceTone}
    >
      <div className="theme-stat-label flex items-center gap-2.5 text-[11px] font-semibold uppercase leading-[1.35] tracking-[0.045em] text-theme-muted">
        {icon && (
          <span className="theme-stat-icon inline-grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-theme-border/80 bg-theme-surface-inset/80">
            {icon}
          </span>
        )}
        <span className="min-w-0">{label}</span>
      </div>
      <div className={`theme-stat-value font-mono text-[1.65rem] font-black leading-none tracking-[-0.03em] tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="theme-stat-sub text-[11px] font-mono leading-[1.55] text-theme-muted">{sub}</div>}
    </div>
  );
}
