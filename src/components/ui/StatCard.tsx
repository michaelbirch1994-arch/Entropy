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
  accent = "text-slate-100",
  tone,
  sub,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`theme-stat-card rounded-2xl p-5 flex flex-col gap-2.5 ${className}`}
      data-tone={tone ?? inferSurfaceTone(accent)}
    >
      <div className="theme-stat-label flex items-center gap-2 text-[11px] font-bold uppercase text-theme-muted">
        {icon}
        {label}
      </div>
      <div className={`theme-stat-value text-2xl font-black font-mono ${accent}`}>{value}</div>
      {sub && <div className="theme-stat-sub text-[11px] font-mono text-theme-muted">{sub}</div>}
    </div>
  );
}
