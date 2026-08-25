import { motion } from "framer-motion";
import { useReport } from "../store/ReportContext";
import { fmtCompact, fmtNum, fmtFixed, fmtFixedGrouped, profChip } from "../utils/format";
import type { MvpCard, MvpTopStat } from "../types/report";
import { Swords, Shield, Crown, Activity, Droplet, Zap, Target, Flame } from "lucide-react";
import { generateFightRecap } from "../lib/generateFightRecap";
import RecapPanel from "../components/ui/RecapPanel";
import SynergyPanel from "../components/ui/SynergyPanel";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { useView } from "../store/ViewContext";

const ACCENT_STYLES = {
  amber: {
    border: "border-amber-500/30 hover:border-amber-500/50",
    glow: "shadow-[0_0_50px_-18px_rgba(214,168,75,0.24)]",
    heading: "text-amber-500",
    circle: "border-amber-500/50 bg-amber-500/10",
    crown: "text-amber-400",
    reason: "text-amber-400",
    statVal: "text-amber-400",
    scoreLbl: "text-amber-500/70",
    scoreVal: "text-amber-400",
  },
  teal: {
    border: "border-amber-500/25 hover:border-amber-500/45",
    glow: "shadow-[0_0_50px_-18px_rgba(214,168,75,0.18)]",
    heading: "text-amber-500",
    circle: "border-amber-500/45 bg-amber-500/[0.08]",
    crown: "text-amber-400",
    reason: "text-amber-300",
    statVal: "text-amber-300",
    scoreLbl: "text-amber-500/70",
    scoreVal: "text-amber-400",
  },
} as const;

function MvpBlock({ mvp, silver, bronze, accent = "amber", label, onOpen }: {
  mvp: MvpCard;
  silver: MvpCard;
  bronze: MvpCard;
  accent: "amber" | "teal";
  label: string;
  onOpen: (card: MvpCard) => void;
}) {
  const a = ACCENT_STYLES[accent];
  const score = mvp.score ?? 0;
  const topStats: MvpTopStat[] = mvp.topStats ?? [];

  const renderMedal = (card: MvpCard, medal: "silver" | "bronze") => {
    const vals = [
      { l: "Down Contrib", v: fmtCompact(card.downContrib) },
      { l: "Cleanses", v: fmtNum(card.cleanses) },
      { l: "Strips", v: fmtNum(card.strips) },
      { l: "Healing", v: fmtCompact(card.healing) },
      { l: "Participation", v: String(card.logsJoined ?? 0) },
    ].slice(0, 2);

    return (
      <button
        type="button"
        onClick={() => onOpen(card)}
        aria-label={`View ${card.account} in Top Players`}
        className={`w-full cursor-pointer rounded-xl bg-transparent p-2 text-left transition-colors hover:bg-theme-accent/[0.04] focus:outline-none focus:ring-2 focus:ring-theme-accent-strong/40 ${medal === "bronze" ? "border-l border-theme-accent/15 pl-4" : ""}`}
      >
        <span className={`text-[10px] font-black uppercase tracking-wider ${medal === "silver" ? "text-slate-300" : "text-amber-600"} block mb-1`}>
          {medal === "silver" ? "Silver" : "Bronze"}
        </span>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-5 h-5 rounded-sm flex items-center justify-center border overflow-hidden p-0.5 ${profChip(card.profession)}`}>
            <ProfessionIcon profession={card.profession} className="w-full h-full" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-200 leading-none">{card.account}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{card.profession}</p>
          </div>
        </div>
        <div className="space-y-1">
          {vals.map((s) => (
            <div key={s.l} className="flex justify-between items-center text-[10px] font-mono bg-slate-900/30 px-1.5 py-0.5 rounded">
              <span className="text-slate-500">{s.l}</span>
              <span className="text-slate-300">{s.v}</span>
            </div>
          ))}
        </div>
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: accent === "amber" ? 0 : 0.1 }}
      className={`theme-player-card theme-mvp-card ${accent === "amber" ? "neon-offense" : "neon-barrier"} w-full bg-[#090909]/95 backdrop-blur-md border rounded-2xl p-5 text-left transition-colors duration-300 flex flex-col ${a.border} ${a.glow}`}
    >
      <button
        type="button"
        onClick={() => onOpen(mvp)}
        aria-label={`View ${mvp.account} in Top Players for ${label}`}
        className="w-full cursor-pointer rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-amber-500/45"
      >
        <div className={`flex items-center gap-2 ${a.heading} text-[11px] font-black uppercase tracking-widest mb-4`}>
          {accent === "amber" ? <Swords className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
          {label}
        </div>

        <div className="flex justify-between items-start mb-6">
          <div className="flex gap-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.25, type: "spring", stiffness: 200 }}
              className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${a.circle}`}
            >
              <Crown className={`w-7 h-7 ${a.crown}`} />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-100">{mvp.account}</h3>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${profChip(mvp.profession)}`}>
                  <ProfessionIcon profession={mvp.profession} className="h-3.5 w-3.5" />
                  {mvp.profession}
                </span>
              </div>
              {mvp.reason && (
                <div className={`${a.reason} text-xs font-semibold mt-1 italic`}>&#9733; "{mvp.reason}"</div>
              )}
              <div className="mt-3 space-y-1.5 w-48">
                {topStats.slice(0, 3).map((ts: MvpTopStat) => (
                  <div key={ts.name} className="flex justify-between items-center text-[10px] font-mono bg-slate-900/50 px-2 py-1 rounded border border-slate-800">
                    <span className="text-slate-400">{ts.name}</span>
                    <span className={`${a.statVal} font-bold`}>{ts.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[10px] ${a.scoreLbl} font-bold uppercase tracking-wider block mb-1`}>{label}</span>
            <span className={`text-4xl font-black ${a.scoreVal} leading-none`}>{fmtFixed(score, 1)}</span>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-4 mt-auto pt-4 border-t border-slate-800/60">
        {renderMedal(silver, "silver")}
        {renderMedal(bronze, "bronze")}
      </div>
    </motion.div>
  );
}

export default function OverviewView() {
  const { report } = useReport();
  const { navigateToView } = useView();
  if (!report) return null;
  const s = report.stats;

  const perSec = (stat: { value: number; totalMs?: number }) => {
    const secs = (stat.totalMs ?? 0) / 1000;
    return secs > 0 ? stat.value / secs : 0;
  };

  const perSecCards = [
    { metric: "downContrib", label: "Down Contrib /s", value: fmtFixedGrouped(perSec(s.maxDownContrib)), icon: <Flame className="w-3.5 h-3.5 text-rose-400" />, player: s.maxDownContrib.player, count: s.maxDownContrib.count, glow: "neon-offense" },
    { metric: "healing", label: "Healing /s", value: fmtFixedGrouped(perSec(s.maxHealing)), icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />, player: s.maxHealing.player, count: s.maxHealing.count, glow: "neon-healing" },
    { metric: "barrier", label: "Barrier /s", value: fmtFixedGrouped(perSec(s.maxBarrier)), icon: <Shield className="w-3.5 h-3.5 text-amber-400" />, player: s.maxBarrier.player, count: s.maxBarrier.count, glow: "neon-barrier" },
    { metric: "cleanses", label: "Cleanses /s", value: fmtFixedGrouped(perSec(s.maxCleanses)), icon: <Droplet className="w-3.5 h-3.5 text-amber-400" />, player: s.maxCleanses.player, count: s.maxCleanses.count, glow: "neon-barrier" },
    { metric: "strips", label: "Strips /s", value: fmtFixedGrouped(perSec(s.maxStrips)), icon: <Zap className="w-3.5 h-3.5 text-orange-400" />, player: s.maxStrips.player, count: s.maxStrips.count, glow: "neon-control" },
    { metric: "stability", label: "Stability Gen /s", value: fmtFixedGrouped(perSec(s.maxStab)), icon: <Shield className="w-3.5 h-3.5 text-amber-400" />, player: s.maxStab.player, count: s.maxStab.count, glow: "neon-control" },
    { metric: "cc", label: "CC /s", value: fmtFixedGrouped(perSec(s.maxCC)), icon: <Target className="w-3.5 h-3.5 text-rose-400" />, player: s.maxCC.player, count: s.maxCC.count, glow: "neon-control" },
    { metric: "interrupts", label: "Interrupts /s", value: fmtFixedGrouped(perSec(s.maxInterrupts)), icon: <Zap className="w-3.5 h-3.5 text-amber-500" />, player: s.maxInterrupts.player, count: s.maxInterrupts.count, glow: "neon-control" },
  ];

  const recap = generateFightRecap(s);

  return (
    <div className="space-y-6 animate-view pb-12">
      <RecapPanel recap={recap} />
      {s.synergyInsights && <SynergyPanel insights={s.synergyInsights} />}

      <div className="theme-kdr-strip grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/60 rounded-2xl overflow-hidden border border-slate-800/80">
        {[
          { label: "Allied Downs", value: s.totalSquadDowns, color: "text-slate-100" },
          { label: "Allied Deaths", value: s.totalSquadDeaths, color: "text-slate-100" },
          { label: "Enemy Downs", value: s.totalEnemyDowns, color: "text-slate-100" },
          { label: "Enemy Deaths", value: s.totalEnemyDeaths, color: "text-slate-100" },
        ].map((b, i) => (
          <motion.button
            type="button"
            onClick={() => navigateToView("kdr", { source: "overview" })}
            aria-label={`Open KDR for ${b.label}`}
            key={b.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            className="theme-kdr-stat cursor-pointer text-center bg-[#090909] py-4 transition-colors hover:bg-[#0d0c0a] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500/40"
          >
            <span className={`text-3xl font-black font-mono ${b.color}`}>{fmtNum(b.value)}</span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mt-1">{b.label}</span>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <MvpBlock
          mvp={s.offensiveMvp}
          silver={s.offensiveSilver}
          bronze={s.offensiveBronze}
          accent="amber"
          label="Offensive MVP"
          onOpen={(card) => navigateToView("top-players", { source: "overview", metric: "downContrib", account: card.account })}
        />
        <MvpBlock
          mvp={s.defensiveMvp}
          silver={s.defensiveSilver}
          bronze={s.defensiveBronze}
          accent="teal"
          label="Defensive MVP"
          onOpen={(card) => navigateToView("top-players", { source: "overview", metric: "healing", account: card.account })}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {perSecCards.map((c, i) => (
          <motion.button
            type="button"
            onClick={() => navigateToView("top-players", { source: "overview", metric: c.metric, account: c.player })}
            aria-label={`View Top Players for ${c.label}`}
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 + i * 0.04 }}
            whileHover={{ y: -2 }}
            className={`theme-stat-card theme-metric-card ${c.glow} cursor-pointer bg-[#090909]/95 border border-slate-800/80 p-4 rounded-2xl text-left shadow-lg hover:border-amber-500/20 transition-colors flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-amber-500/45 focus:ring-offset-2 focus:ring-offset-black`}
          >
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {c.icon}
                {c.label}
              </div>
              <div className="text-2xl font-black font-mono text-slate-100">{c.value}</div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-between items-center text-[10px]">
              <span className="text-amber-300 font-bold truncate">{c.player}</span>
              <span className="text-slate-500 font-mono">{c.count} logs</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
