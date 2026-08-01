import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: string;
  sub?: string;
  className?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  accent = "text-slate-100",
  sub,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`bg-white/[0.03] border border-amber-500/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-amber-500/20 flex flex-col gap-2.5 ${className}`}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-black font-mono ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-slate-500">{sub}</div>}
    </div>
  );
}
