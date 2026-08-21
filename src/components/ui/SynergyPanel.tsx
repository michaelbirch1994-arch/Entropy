import { motion } from "framer-motion";
import { CircleCheck, CircleAlert, TriangleAlert, Info, Sparkles } from "lucide-react";
import type { SynergyInsight } from "../../types/report";
import Panel from "./Panel";

const SEVERITY_STYLE: Record<SynergyInsight["severity"], { icon: React.ReactNode; text: string; border: string; bg: string }> = {
  good: { icon: <CircleCheck className="w-4 h-4" />, text: "text-emerald-400", border: "border-emerald-500/18", bg: "bg-[#090909]" },
  info: { icon: <Info className="w-4 h-4" />, text: "text-slate-300", border: "border-white/[0.08]", bg: "bg-[#090909]" },
  warn: { icon: <TriangleAlert className="w-4 h-4" />, text: "text-amber-400", border: "border-amber-500/18", bg: "bg-[#090909]" },
  critical: { icon: <CircleAlert className="w-4 h-4" />, text: "text-rose-400", border: "border-rose-500/18", bg: "bg-[#090909]" },
};

const SEVERITY_ORDER: Record<SynergyInsight["severity"], number> = { critical: 0, warn: 1, info: 2, good: 3 };

export default function SynergyPanel({ insights }: { insights: SynergyInsight[] }) {
  if (!insights || insights.length === 0) return null;
  const sorted = [...insights].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <Panel
      title="Squad Synergy"
      subtitle="Automated read on composition and performance, computed from this session's own data"
      icon={<Sparkles className="w-3.5 h-3.5" />}
      action={`${insights.length} insights`}
      className="theme-synergy-panel"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {sorted.map((insight, i) => {
          const s = SEVERITY_STYLE[insight.severity];
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`theme-alert-plate flex items-start gap-2.5 rounded-xl border ${s.border} ${s.bg} px-3.5 py-3`}
            >
              <span className={`${s.text} flex-shrink-0 mt-0.5`}>{s.icon}</span>
              <div>
                <p className={`text-xs font-bold ${s.text}`}>{insight.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{insight.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
