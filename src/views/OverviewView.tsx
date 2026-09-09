import { useReport } from "../store/ReportContext";
import { fmtCompact, fmtNum, fmtFixed, fmtFixedGrouped, PROFESSION_FAMILY, normalizeProfessionLabel } from "../utils/format";
import type { MvpCard, MvpTopStat } from "../types/report";
import { Swords, Shield, Activity, Droplet, Zap, Target, Flame, BrainCircuit, Film, ArrowUpRight } from "lucide-react";
import { generateFightRecap } from "../lib/generateFightRecap";
import RecapPanel from "../components/ui/RecapPanel";
import SynergyPanel from "../components/ui/SynergyPanel";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import ProfessionIdentity from "../components/ui/ProfessionIdentity";
import { useView } from "../store/ViewContext";

export function MvpBlock({ mvp, silver, bronze, accent, label, onOpen }: {
  mvp: MvpCard; silver: MvpCard; bronze: MvpCard; accent: "amber" | "teal";
  label: string; onOpen: (card: MvpCard) => void;
}) {
  return (
    <section className="entropy-leaderboard" data-accent={accent} aria-label={label}>
      <header>
        {accent === "amber" ? <Swords size={16} /> : <Shield size={16} />}
        <h2>{label}</h2>
      </header>
      {[mvp, silver, bronze].map((card, index) => (
        <button type="button" key={index} className={`entropy-leader-row ${index === 0 ? "is-champion" : ""}`} data-profession-family={PROFESSION_FAMILY[normalizeProfessionLabel(card.profession)] ?? "default"} onClick={() => onOpen(card)}
          aria-label={index === 0 ? `View ${card.account} in Top Players for ${label}` : `View ${card.account} in Top Players`}>
          {index === 0 && <span className="entropy-leader-watermark" aria-hidden="true"><ProfessionIcon profession={card.profession} /></span>}
          <span className="entropy-leader-rank">{String(index + 1).padStart(2, "0")}</span>
          <span className="entropy-leader-emblem"><ProfessionIcon profession={card.profession} className="h-7 w-7" /></span>
          <span className="entropy-leader-identity">
            <strong>{card.account}</strong>
            <ProfessionIdentity profession={card.profession} />
            {index === 0 && card.reason && <small>{card.reason}</small>}
          </span>
          <span className="entropy-leader-facts">
            {index === 0 ? (card.topStats ?? []).slice(0, 3).map((stat: MvpTopStat) =>
              <span key={stat.name}><span>{stat.name}</span><strong>{stat.val}</strong></span>
            ) : <>
              <span><span>Down Contrib</span><strong>{fmtCompact(card.downContrib)}</strong></span>
              <span><span>Cleanses</span><strong>{fmtNum(card.cleanses)}</strong></span>
            </>}
          </span>
          <span className="entropy-leader-score">
            {index === 0 ? <><small>MVP score</small><strong>{fmtFixed(card.score ?? 0, 1)}</strong></> : <small>{index === 1 ? "Silver" : "Bronze"}</small>}
          </span>
        </button>
      ))}
    </section>
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
    { metric: "downContrib", label: "Down Contrib /s", value: fmtFixedGrouped(perSec(s.maxDownContrib)), icon: <Flame className="h-5 w-5 text-rose-400" />, player: s.maxDownContrib.player, count: s.maxDownContrib.count, glow: "neon-offense" },
    { metric: "healing", label: "Healing /s", value: fmtFixedGrouped(perSec(s.maxHealing)), icon: <Activity className="h-5 w-5 text-emerald-400" />, player: s.maxHealing.player, count: s.maxHealing.count, glow: "neon-healing" },
    { metric: "barrier", label: "Barrier /s", value: fmtFixedGrouped(perSec(s.maxBarrier)), icon: <Shield className="h-5 w-5 text-amber-400" />, player: s.maxBarrier.player, count: s.maxBarrier.count, glow: "neon-barrier" },
    { metric: "cleanses", label: "Cleanses /s", value: fmtFixedGrouped(perSec(s.maxCleanses)), icon: <Droplet className="h-5 w-5 text-amber-400" />, player: s.maxCleanses.player, count: s.maxCleanses.count, glow: "neon-barrier" },
    { metric: "strips", label: "Strips /s", value: fmtFixedGrouped(perSec(s.maxStrips)), icon: <Zap className="h-5 w-5 text-orange-400" />, player: s.maxStrips.player, count: s.maxStrips.count, glow: "neon-control" },
    { metric: "stability", label: "Stability Gen /s", value: fmtFixedGrouped(perSec(s.maxStab)), icon: <Shield className="h-5 w-5 text-amber-400" />, player: s.maxStab.player, count: s.maxStab.count, glow: "neon-control" },
    { metric: "cc", label: "CC /s", value: fmtFixedGrouped(perSec(s.maxCC)), icon: <Target className="h-5 w-5 text-rose-400" />, player: s.maxCC.player, count: s.maxCC.count, glow: "neon-control" },
    { metric: "interrupts", label: "Interrupts /s", value: fmtFixedGrouped(perSec(s.maxInterrupts)), icon: <Zap className="h-5 w-5 text-amber-500" />, player: s.maxInterrupts.player, count: s.maxInterrupts.count, glow: "neon-control" },
  ];

  const recap = generateFightRecap(s);

  return (
    <div className="entropy-overview pb-12">
      <header className="entropy-command-masthead">
        <div className="entropy-command-masthead-copy">
          <span className="entropy-command-eyebrow"><Activity size={16} /> World vs World</span>
          <h2>Entropy</h2>
          <p>{report.meta.title} <span>{report.meta.dateLabel}</span></p>
          <div className="entropy-command-masthead-actions">
            <button type="button" onClick={() => navigateToView("intelligence", { source: "overview" })}><BrainCircuit size={16} /> Intelligence <ArrowUpRight size={14} /></button>
            <button type="button" onClick={() => navigateToView("fight-replay", { source: "overview" })}><Film size={16} /> Fight replay <ArrowUpRight size={14} /></button>
          </div>
        </div>
      </header>
      <div className="theme-kdr-strip grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/60 rounded-2xl overflow-hidden border border-slate-800/80">
        {[
          { label: "Allied Downs", value: s.totalSquadDowns, color: "text-slate-100" },
          { label: "Allied Deaths", value: s.totalSquadDeaths, color: "text-slate-100" },
          { label: "Enemy Downs", value: s.totalEnemyDowns, color: "text-slate-100" },
          { label: "Enemy Deaths", value: s.totalEnemyDeaths, color: "text-slate-100" },
        ].map((b) => (
          <button
            type="button"
            onClick={() => navigateToView("kdr", { source: "overview" })}
            aria-label={`Open KDR for ${b.label}`}
            key={b.label}            className="theme-kdr-stat cursor-pointer text-center bg-[#090909] py-4 transition-colors hover:bg-[#0d0c0a] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500/40"
          >
            <span className={`text-3xl font-black font-mono ${b.color}`}>{fmtNum(b.value)}</span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mt-1">{b.label}</span>
          </button>
        ))}
      </div>

      <div className="entropy-overview-briefing">
        <RecapPanel recap={recap} />
        {s.synergyInsights && <SynergyPanel insights={s.synergyInsights} />}
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
        {perSecCards.map((c) => (
          <button
            type="button"
            onClick={() => navigateToView("top-players", { source: "overview", metric: c.metric, account: c.player })}
            aria-label={`View Top Players for ${c.label}`}
            key={c.label}            className={`theme-stat-card theme-metric-card ${c.glow} cursor-pointer bg-[#090909]/95 border border-slate-800/80 p-4 rounded-2xl text-left shadow-lg hover:border-amber-500/20 transition-colors flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-amber-500/45 focus:ring-offset-2 focus:ring-offset-black`}
          >
            <span className="entropy-stat-watermark" aria-hidden="true">{c.icon}</span>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {c.icon}
                {c.label}
              </div>
              <div className="text-2xl font-black font-mono text-slate-100">{c.value}</div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-between items-center text-[10px]">
              <span className="entropy-metric-player text-amber-300 font-bold">{c.player}</span>
              <span className="text-slate-500 font-mono">{c.count} logs</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
