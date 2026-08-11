import { useState } from "react";
import { useReport } from "../store/ReportContext";
import { useDamageScope, pickDamageScopeValue } from "../store/DamageScopeContext";
import { useAllyScope, pickAllyScopeValue } from "../store/AllyScopeContext";
import Panel from "../components/ui/Panel";
import LeaderboardTable from "../components/ui/LeaderboardTable";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import type { DefensePlayer, HealingPlayer, LeaderboardEntry, OffensePlayer, PlayerSkillBreakdown, SupportPlayer } from "../types/report";
import { fmtCompact, fmtNum, profChip, profStyle } from "../utils/format";
import { ChevronDown, ChevronUp, Trophy, Swords, Heart, Shield, Zap, Droplet, Target, Wind } from "lucide-react";

type MetricKey =
  | "dps"
  | "damage"
  | "downContrib"
  | "healing"
  | "barrier"
  | "cleanses"
  | "strips"
  | "stability"
  | "cc"
  | "interrupts"
  | "dodges"
  | "kills";

const METRICS: { key: MetricKey; label: string; icon: typeof Trophy; unit?: string }[] = [
  { key: "dps", label: "DPS", icon: Swords, unit: "" },
  { key: "damage", label: "Total Damage", icon: Swords },
  { key: "downContrib", label: "Down Contribution", icon: Trophy },
  { key: "healing", label: "Healing", icon: Heart },
  { key: "barrier", label: "Barrier", icon: Shield },
  { key: "cleanses", label: "Cleanses", icon: Droplet },
  { key: "strips", label: "Strips", icon: Zap },
  { key: "stability", label: "Stability", icon: Shield },
  { key: "cc", label: "Crowd Control", icon: Target },
  { key: "interrupts", label: "Interrupts", icon: Zap },
  { key: "dodges", label: "Dodges", icon: Wind },
  { key: "kills", label: "Kills", icon: Swords },
];

function formatMetricValue(entry: LeaderboardEntry, unit?: string) {
  if (unit === "") return Math.round(entry.value).toLocaleString();
  return entry.value >= 100000 ? fmtCompact(entry.value) : fmtNum(entry.value);
}

function leaderboardSnapshotKey(metric: MetricKey, entries: LeaderboardEntry[]) {
  return `${metric}:${entries.slice(0, 12).map((entry) => `${entry.account}:${entry.profession}:${entry.rank}:${entry.value}:${entry.count}`).join("|")}`;
}

type SourceRow = {
  label: string;
  value: number;
  tone: string;
  icon?: string;
  hits?: number;
};

type PlayerSourceBreakdown = {
  damage: SourceRow[];
  healing: SourceRow[];
  barrier: SourceRow[];
  support: SourceRow[];
  defense: SourceRow[];
};

function positiveRow(label: string, value: number | undefined, tone: string, icon?: string, hits?: number): SourceRow | null {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return { label, value: numeric, tone, icon, hits };
}

function rows(...items: Array<SourceRow | null>) {
  return items.filter((item): item is SourceRow => !!item).sort((a, b) => b.value - a.value);
}

function findLeaderboardValue(leaderboards: Record<string, LeaderboardEntry[]>, key: string, account: string) {
  return leaderboards[key]?.find((entry) => entry.account === account)?.value ?? 0;
}

function findPlayerSkillBreakdown(reportBreakdowns: Record<string, PlayerSkillBreakdown> | undefined, entry: LeaderboardEntry) {
  if (!reportBreakdowns) return undefined;
  return reportBreakdowns[`${entry.account}::${entry.profession}`] ?? reportBreakdowns[entry.account];
}

function buildPlayerSourceBreakdown({
  account,
  offense,
  healing,
  support,
  defense,
  leaderboards,
  damageScope,
  allyScope,
  skillBreakdown,
}: {
  account: string;
  offense?: OffensePlayer;
  healing?: HealingPlayer;
  support?: SupportPlayer;
  defense?: DefensePlayer;
  leaderboards: Record<string, LeaderboardEntry[]>;
  damageScope: ReturnType<typeof useDamageScope>["scope"];
  allyScope: ReturnType<typeof useAllyScope>["scope"];
  skillBreakdown?: PlayerSkillBreakdown;
}): PlayerSourceBreakdown {
  const offenseTotals = offense?.offenseTotals;
  const healingTotals = healing?.healingTotals;
  const supportTotals = support?.supportTotals;
  const defenseTotals = defense?.defenseTotals;
  const damage = pickDamageScopeValue(damageScope, offenseTotals?.damage, offenseTotals?.damageAll);
  const healingTotal = pickAllyScopeValue(allyScope, healingTotals?.healing, healingTotals?.squadHealing);
  const barrierTotal = pickAllyScopeValue(allyScope, healingTotals?.barrier, healingTotals?.squadBarrier);

  return {
    damage: rows(
      ...(skillBreakdown?.damage.slice(0, 5).map((skill) => positiveRow(skill.name, skill.value, "bg-orange-400", skill.icon, skill.hits)) ?? []),
      positiveRow("Total damage", damage, "bg-orange-400"),
      positiveRow("Direct damage", offenseTotals?.directDmg, "bg-amber-400"),
      positiveRow("Critical damage", offenseTotals?.criticalDmg, "bg-yellow-300"),
      positiveRow("Down contribution", offenseTotals?.downContribution, "bg-sky-400"),
      positiveRow("Against downed", offenseTotals?.againstDownedDamage, "bg-rose-300"),
      positiveRow("Enemy downs", offenseTotals?.downed, "bg-cyan-400"),
      positiveRow("Kills", offenseTotals?.killed, "bg-red-400"),
    ),
    healing: rows(
      ...(skillBreakdown?.healing.slice(0, 5).map((skill) => positiveRow(skill.name, skill.value, "bg-emerald-400", skill.icon, skill.hits)) ?? []),
      positiveRow("Total healing", healingTotal, "bg-emerald-400"),
      positiveRow("Healing Power", pickAllyScopeValue(allyScope, healingTotals?.healingPowerHealing, healingTotals?.squadHealingPowerHealing), "bg-green-300"),
      positiveRow("Life steal / conversion", pickAllyScopeValue(allyScope, healingTotals?.conversionHealing, healingTotals?.squadConversionHealing), "bg-lime-300"),
      positiveRow("Hybrid healing", pickAllyScopeValue(allyScope, healingTotals?.hybridHealing, healingTotals?.squadHybridHealing), "bg-teal-300"),
      positiveRow("Downed healing", pickAllyScopeValue(allyScope, healingTotals?.downedHealing, healingTotals?.squadDownedHealing), "bg-cyan-300"),
      positiveRow("Self healing", healingTotals?.selfHealing, "bg-emerald-600"),
    ),
    barrier: rows(
      ...(skillBreakdown?.barrier.slice(0, 5).map((skill) => positiveRow(skill.name, skill.value, "bg-teal-400", skill.icon, skill.hits)) ?? []),
      positiveRow("Total barrier", barrierTotal, "bg-teal-400"),
      positiveRow("Group barrier", healingTotals?.groupBarrier, "bg-cyan-400"),
      positiveRow("Self barrier", healingTotals?.selfBarrier, "bg-sky-400"),
      positiveRow("Off-squad barrier", healingTotals?.offSquadBarrier, "bg-fuchsia-400"),
    ),
    support: rows(
      positiveRow("Cleanses", supportTotals?.condiCleanse, "bg-cyan-400"),
      positiveRow("Boon strips", supportTotals?.boonStrips, "bg-amber-400"),
      positiveRow("Stability", findLeaderboardValue(leaderboards, "stability", account), "bg-blue-400"),
      positiveRow("Crowd control", offenseTotals?.appliedCrowdControl, "bg-purple-400"),
      positiveRow("Interrupts", offenseTotals?.interrupts, "bg-pink-400"),
      positiveRow("Resurrects", supportTotals?.resurrects, "bg-emerald-300"),
      positiveRow("Stun breaks", supportTotals?.stunBreak, "bg-slate-300"),
    ),
    defense: rows(
      positiveRow("Damage taken", defenseTotals?.damageTaken, "bg-rose-400"),
      positiveRow("Power damage taken", defenseTotals?.powerDamageTaken, "bg-orange-300"),
      positiveRow("Condition damage taken", defenseTotals?.conditionDamageTaken, "bg-purple-300"),
      positiveRow("Barrier absorbed", defenseTotals?.damageBarrier, "bg-teal-300"),
      positiveRow("Dodges", findLeaderboardValue(leaderboards, "dodges", account), "bg-blue-300"),
      positiveRow("Blocks", defenseTotals?.blockedCount, "bg-sky-300"),
      positiveRow("Evades", defenseTotals?.evadedCount, "bg-indigo-300"),
      positiveRow("Downs", defenseTotals?.downCount, "bg-amber-300"),
      positiveRow("Deaths", defenseTotals?.deadCount, "bg-red-400"),
    ),
  };
}

function SourceGroup({ title, rows }: { title: string; rows: SourceRow[] }) {
  const max = rows[0]?.value ?? 0;
  return (
    <div className="rounded-xl border border-slate-800/70 bg-[#070b15]/70 p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.slice(0, 8).map((row) => (
            <div key={`${title}:${row.label}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="min-w-0 flex items-center gap-2 truncate text-slate-300">
                  {row.icon && <img src={row.icon} alt="" className="h-4 w-4 flex-shrink-0 rounded-sm object-cover" loading="lazy" />}
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="flex-shrink-0 text-right font-mono font-bold text-slate-100">
                  {fmtCompact(row.value)}
                  {typeof row.hits === "number" && row.hits > 0 && <span className="ml-1 text-[9px] text-slate-500">{fmtNum(row.hits)} hits</span>}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/80">
                <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${max > 0 ? Math.max(4, (row.value / max) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-slate-600">No recorded sources in this bucket.</div>
      )}
    </div>
  );
}

function PlayerMetricCard({
  entry,
  index,
  max,
  metricLabel,
  unit,
  breakdown,
  expanded,
  onToggle,
}: {
  entry: LeaderboardEntry;
  index: number;
  max: number;
  metricLabel: string;
  unit?: string;
  breakdown: PlayerSourceBreakdown;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = profStyle(entry.profession);
  const share = max > 0 ? Math.max(4, (entry.value / max) * 100) : 4;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-2xl border border-slate-800/80 bg-[#0a101f]/90 p-4 text-left shadow-lg transition-colors hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${profChip(entry.profession)}`}>
            <ProfessionIcon profession={entry.profession} className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-100">{entry.account}</div>
            <div className="mt-0.5 text-[10px] font-mono text-slate-500">{entry.profession}</div>
          </div>
        </div>
        <span className={`font-mono text-xs font-black ${entry.rank <= 3 ? "text-amber-400" : "text-slate-500"}`}>
          #{entry.rank || index + 1}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{metricLabel}</div>
            <div className="mt-1 font-mono text-2xl font-black text-slate-100">
              {formatMetricValue(entry, unit)}
              {unit && <span className="ml-1 text-[10px] font-bold text-slate-500">{unit}</span>}
            </div>
          </div>
          <div className="text-right text-[10px] font-mono text-slate-500">{entry.count} logs</div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/60">
          <div className={`h-full rounded-full ${style.dot} transition-all duration-500`} style={{ width: `${share}%` }} />
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Share of current leader
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-800/60 pt-3 text-[10px] font-bold uppercase tracking-wider text-sky-400">
        <span>{expanded ? "Hide source breakdown" : "Show source breakdown"}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </div>
      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          <SourceGroup title="Damage pressure" rows={breakdown.damage} />
          <SourceGroup title="Healing sources" rows={breakdown.healing} />
          <SourceGroup title="Barrier sources" rows={breakdown.barrier} />
          <SourceGroup title="Support / control" rows={breakdown.support} />
          <SourceGroup title="Defense context" rows={breakdown.defense} />
        </div>
      )}
    </button>
  );
}

export default function TopPlayersView() {
  const { report } = useReport();
  const { scope: damageScope } = useDamageScope();
  const { scope: allyScope } = useAllyScope();
  const [metric, setMetric] = useState<MetricKey>("downContrib");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  if (!report) return null;
  const lb = report.stats.leaderboards;
  const entries: LeaderboardEntry[] = lb[metric] ?? [];
  const active = METRICS.find((m) => m.key === metric)!;
  const maxValue = entries.length ? entries[0].value : 1;
  const snapshotKey = leaderboardSnapshotKey(metric, entries);

  return (
    <div className="space-y-5 animate-view pb-12" key={`top-players:${snapshotKey}`}>
      {/* Metric selector */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const isActive = metric === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                isActive
                  ? "bg-sky-500/15 text-sky-400 border-sky-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                  : "bg-[#0a101f] text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" key={`podium:${snapshotKey}`}>
        {entries.slice(0, 3).map((e, i) => {
          const place = i + 1;
          const colors = ["text-amber-400", "text-slate-300", "text-orange-400"];
          const borders = ["border-amber-500/40", "border-slate-500/40", "border-orange-600/40"];
          return (
            <div
              key={`${metric}:podium:${e.account}:${e.profession}:${e.rank}:${e.value}`}
              className={`bg-[#0a101f]/90 border ${borders[i]} rounded-2xl p-4 shadow-xl flex items-center gap-4`}
            >
              <div className={`text-3xl font-black font-mono ${colors[i]}`}>#{place}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-100 truncate">{e.account}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                  <ProfessionIcon profession={e.profession} className="h-3.5 w-3.5" />
                  {e.profession}
                </div>
                <div className={`text-lg font-black font-mono ${colors[i]} mt-1`}>
                  {formatMetricValue(e, active.unit)}
                  {active.unit && <span className="ml-1 text-[10px] text-slate-500">{active.unit}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Metric-bound player cards */}
      <Panel
        key={`panel:${snapshotKey}`}
        title={`${active.label} Player Cards`}
        subtitle="These cards are driven by the same selected metric as the podium and table."
        icon={<active.icon className="w-4 h-4" />}
        accent="text-sky-400"
      >
        {entries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" key={`cards:${snapshotKey}`}>
            {entries.slice(0, 12).map((entry, index) => (
              <PlayerMetricCard
                key={`${metric}:card:${entry.account}:${entry.profession}:${entry.rank}:${entry.value}:${entry.count}`}
                entry={entry}
                index={index}
                max={maxValue}
                metricLabel={active.label}
                unit={active.unit}
                expanded={expandedCard === `${metric}:${entry.account}`}
                onToggle={() => setExpandedCard((current) => current === `${metric}:${entry.account}` ? null : `${metric}:${entry.account}`)}
                breakdown={buildPlayerSourceBreakdown({
                  account: entry.account,
                  offense: report.stats.offensePlayers.find((player) => player.account === entry.account),
                  healing: report.stats.healingPlayers.find((player) => player.account === entry.account),
                  support: report.stats.supportPlayers.find((player) => player.account === entry.account),
                  defense: report.stats.defensePlayers.find((player) => player.account === entry.account),
                  leaderboards: lb,
                  damageScope,
                  allyScope,
                  skillBreakdown: findPlayerSkillBreakdown(report.stats.playerSkillBreakdowns, entry),
                })}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500">No leaderboard data available for {active.label}.</div>
        )}
      </Panel>

      {/* Full leaderboard */}
      <Panel title={`${active.label} Leaderboard`} icon={<active.icon className="w-4 h-4" />} accent="text-sky-400">
        <LeaderboardTable entries={entries} metricLabel={active.label} unit={active.unit} />
      </Panel>
    </div>
  );
}
