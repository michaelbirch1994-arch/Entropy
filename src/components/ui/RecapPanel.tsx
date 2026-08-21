import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { FightRecap } from "../../lib/generateFightRecap";

export default function RecapPanel({ recap }: { recap: FightRecap | null }) {
  if (!recap) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="theme-recap-panel relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[#080808] backdrop-blur-md p-5"
    >
      <div className="flex items-center gap-2 mb-2">
        <motion.span
          animate={{ rotate: [0, 15, -10, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
          className="text-amber-400"
        >
          <Sparkles className="w-4 h-4" />
        </motion.span>
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/90">Recap</span>
      </div>
      <h2 className="text-lg font-black text-slate-100 mb-2">{recap.headline}</h2>
      <div className="space-y-2">
        {recap.paragraphs.map((p, i) => (
          <p key={i} className="text-[13px] text-slate-300/90 leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </motion.div>
  );
}
