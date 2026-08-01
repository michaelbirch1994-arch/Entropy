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
      className={`bg-white/[0.03] border border-amber-500/10 rounded-2xl shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-amber-500/20 ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-amber-500/8 px-5 py-3.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-200">
              {icon && <span className={accent ?? "text-amber-500"}>{icon}</span>}
              {title}
            </div>
            {subtitle && (
              <p className="text-[10px] text-slate-500 font-medium">{subtitle}</p>
            )}
          </div>
          {action && <div className="text-[10px] font-mono text-slate-500">{action}</div>}
        </header>
      )}
      <div className={bodyClassName || "p-5"}>{empty ?? children}</div>
    </section>
  );
}
