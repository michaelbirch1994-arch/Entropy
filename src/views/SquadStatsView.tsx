import { useState, type KeyboardEvent } from "react";
import { useReport } from "../store/ReportContext";
import { useDamageScope, pickDamageScopeValue } from "../store/DamageScopeContext";
import { useAllyScope, pickAllyScopeValue } from "../store/AllyScopeContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtCompact, fmtDur, fmtFixed, fmtFixedGrouped } from "../utils/format";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { Users, Swords, Shield, Heart, Zap, Target, Activity, Crosshair, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, CHART_COLORS } from "../utils/chartTheme";
import { resolveChartSelectionIndex, type ChartSelectionRow } from "../utils/chartSelection";
import type { HealingPlayer, HealingCoverage, OffensePlayer, TopBarrierSource, TopHealingSource, TopSkill } from "../types/report";
import { buildHealingFightDrilldowns } from "../lib/squadStatsDrilldowns";
import DistanceToTagPanel, { resolveDistanceToTagResult } from "../components/squad/DistanceToTagPanel";
import BoundedDataRegion from "../components/ui/BoundedDataRegion";
import { buildSquadOverviewRows } from "../lib/squadOverviewAggregation";

type SquadOverviewSortKey = "player" | "class" | "damage" | "dps" | "downContribution" | "healing" | "cleanses" | "strips" | "combat" | "participation";

/**
 * Render a healing figure honestly.
 *
 * Guild Wars 2 only reports healing to the healing player's own client, so
 * arcdps_healing_stats can only see healing done by someone running it. Without
 * the addon a player's number is whatever leaked through to addon-running allies -
 * a real lower bound, not a total - and a zero means "never observed", not "healed
 * nothing". Showing either as a plain number ranks people on who happened to be
 * standing near an addon user.
 */
function renderHealing(heal: HealingPlayer, value: number) {
  // Reports archived/cached before healingCoverage existed have no such field.
  // Fall back to the addon flag, and if that is missing too, show the bare
  // number rather than mislabelling a real figure as unavailable.
  const coverage: HealingCoverage =
    heal.healingCoverage ?? (heal.hasHealAddon ? 'full' : value > 0 ? 'partial' : 'none');

  if (coverage === 'full') return <>{fmtCompact(value)}</>;
  if (coverage === 'partial') {
    return (
      <span
        className="text-emerald-400/70"
        title="Lower bound. This player was not running the arcdps healing addon, so only healing that landed on addon-running allies was recorded. Their true total is higher by an unknown amount."
      >
        {fmtCompact(value)}<span className="text-amber-500/80">+</span>
      </span>
    );
  }
  return (
    <span
      className="text-slate-600"
      title="Unavailable - this player was not running the arcdps healing addon and none of their healing was observed by an ally who was. This is not the same as zero healing."
    >
      n/a
    </span>
  );
}

function safeDiv(numerator: number, denominator: number) {
  return denominator > 0 && Number.isFinite(denominator) ? numerator / denominator : 0;
}

function pct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function normalizeScore(value: number, max: number) {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0;
  return Math.round((value / max) * 100);
}

function pressureSkillScore(skill: TopSkill) {
  return (skill.downContribution ?? 0) + (skill.damage ?? 0) * 0.05;
}

function sortPressureSkills(skills: TopSkill[]) {
  return [...skills].sort((a, b) => pressureSkillScore(b) - pressureSkillScore(a) || (b.damage ?? 0) - (a.damage ?? 0));
}

function buildPressureRows(players: OffensePlayer[], scope: ReturnType<typeof useDamageScope>["scope"]) {
  const base = players.map((p) => {
    const damage = pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll);
    const downContribution = p.offenseTotals.downContribution ?? 0;
    const enemyDowns = p.offenseTotals.downed ?? 0;
    const kills = p.offenseTotals.killed ?? 0;
    const dps = safeDiv(damage, p.totalFightMs / 1000);
    // Kill Pressure is intentionally not "total damage." It rewards damage
    // that helps force downs/kills, with a smaller baseline for sustained
    // player-vs-player pressure so finishers do not erase the setup work.
    const pressureRaw = downContribution + enemyDowns * 50000 + kills * 80000 + damage * 0.05;
    return { account: p.account, profession: p.profession, damage, dps, downContribution, enemyDowns, kills, pressureRaw };
  }).sort((a, b) => b.pressureRaw - a.pressureRaw);
  // Kill Pressure is this player's share of the SQUAD total pressure, not
  // normalized against the top player - otherwise the leader always shows
  // 100 (their own value divided by itself as the max).
  const total = base.reduce((sum, p) => sum + p.pressureRaw, 0) || 1;
  return base.map((p) => ({ ...p, pressureScore: normalizeScore(p.pressureRaw, total), pressurePct: safeDiv(p.pressureRaw, total) }));
}

function SkillSourceRows({
  rows,
  kind,
}: {
  rows: Array<TopSkill | TopHealingSource | TopBarrierSource>;
  kind: "pressure" | "incoming" | "healing" | "barrier";
}) {
  const tone = kind === "healing" ? "text-emerald-200" : kind === "barrier" ? "text-amber-200" : "text-rose-200";
  return rows.length ? (
    <BoundedDataRegion
      label={`${kind} skill sources, ${rows.length} skills`}
      itemCount={rows.length}
      maxHeightClass="max-h-[32rem]"
    >
      {rows.map((skill, index) => {
        const asPressure = skill as TopSkill;
        const asHealing = skill as TopHealingSource;
        const asBarrier = skill as TopBarrierSource;
        const primary = kind === "healing"
          ? asHealing.healing
          : kind === "barrier"
            ? asBarrier.barrier
            : kind === "incoming"
              ? asPressure.damage
              : asPressure.downContribution ?? 0;
        const secondary = kind === "pressure" ? asPressure.damage ?? 0 : kind === "incoming" ? asPressure.downContribution ?? 0 : 0;
        return (
          <div key={`${kind}:${skill.id}:${index}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-t border-slate-800/50 py-2 text-xs first:border-t-0">
            <span className="font-mono text-[10px] font-black text-slate-600">#{index + 1}</span>
            <span className="min-w-0 flex items-center gap-2 text-slate-300">
              {skill.icon && <img src={skill.icon} alt="" className="h-4 w-4 flex-shrink-0 rounded-sm" loading="lazy" />}
              <span className="truncate">{skill.name}</span>
            </span>
            <span className={`text-right font-mono text-[11px] font-bold ${tone}`}>
              {fmtCompact(primary)}
              <span className="ml-1 text-[10px] text-slate-500">{kind === "pressure" ? "down" : kind === "incoming" ? "dmg" : kind}</span>
              {secondary > 0 && <span className="ml-2 text-slate-500">{fmtCompact(secondary)} {kind === "pressure" ? "dmg" : "down"}</span>}
              <span className="ml-2 text-slate-500">{fmtNum(skill.hits)} hits</span>
            </span>
          </div>
        );
      })}
    </BoundedDataRegion>
  ) : null;
}

interface FightAxisTickProps {
  x?: number | string;
  y?: number | string;
  payload?: { index?: number; value?: unknown };
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function FightAxisTick({ x = 0, y = 0, payload, selectedIndex, onSelect }: FightAxisTickProps) {
  const index = payload?.index;
  if (typeof index !== "number") return null;
  const selected = index === selectedIndex;
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(index);
    }
  };

  return (
    <g
      transform={`translate(${Number(x)},${Number(y)})`}
      role="button"
      tabIndex={0}
      aria-label={`Select fight ${String(payload?.value ?? index + 1)}`}
      aria-pressed={selected}
      className="cursor-pointer outline-none"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(index);
      }}
      onKeyDown={handleKeyDown}
    >
      <rect x={-13} y={3} width={26} height={18} rx={2} fill={selected ? "rgba(230,78,36,0.22)" : "transparent"} stroke={selected ? "#e64e24" : "transparent"} />
      <text x={0} y={16} textAnchor="middle" fill={selected ? "#ff7540" : "#8f8178"} fontSize={9} fontWeight={selected ? 800 : 600}>
        {String(payload?.value ?? index + 1)}
      </text>
    </g>
  );
}

function FightSelectorStrip({
  rows,
  selectedIndex,
  onSelect,
  label,
}: {
  rows: readonly ChartSelectionRow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  label: string;
}) {
  return (
    <div className="theme-fight-selector border-t border-theme-border/60 pt-3">
      <div className="mb-2 text-[10px] font-black uppercase text-theme-muted">{label}</div>
      <div role="group" aria-label={label} className="flex gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
        {rows.map((row, index) => (
          <button
            key={row.id ?? `${row.name ?? row.label ?? "fight"}-${index}`}
            type="button"
            aria-pressed={selectedIndex === index}
            onClick={() => onSelect(index)}
            className={`h-8 min-w-10 border px-2 font-mono text-[10px] font-black transition-colors ${selectedIndex === index ? "border-theme-accent bg-theme-accent/15 text-theme-accent-strong" : "border-theme-border bg-theme-surface-inset text-theme-muted hover:border-theme-border-strong hover:text-theme-text"}`}
          >
            {row.name ?? row.label ?? `#${index + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SquadStatsView() {
  const { report } = useReport();
  const { scope } = useDamageScope();
  const { scope: allyScope } = useAllyScope();
  const initialFightIndex = () => {
    const saved = Number(localStorage.getItem("entropy.selectedFightIndex") ?? 0);
    return Number.isInteger(saved) && saved >= 0 ? saved : 0;
  };
  const [selectedPressureIndex, setSelectedPressureIndex] = useState(initialFightIndex);
  const [selectedHealingIndex, setSelectedHealingIndex] = useState(initialFightIndex);
  const [overviewSort, setOverviewSort] = useState<{ key: SquadOverviewSortKey; dir: "asc" | "desc" } | null>(null);
  if (!report) return null;
  const s = report.stats;

  // Aggregate squad totals from player arrays. healingTotals is a sparse
  // Record<string, number> - a player who did zero outgoing healing/barrier
  // this session (e.g. a pure-DPS build) never gets a 'healing'/'barrier' key
  // written at all, so it's `undefined` rather than 0. A bare `a + p.x` turns
  // into `a + undefined` -> NaN for the *entire* reduce the moment one such
  // player is hit, which is why these totals were rendering as "-". `?? 0`
  // guards every field the same way, in case any of them end up sparse too.
  const totalDamage = s.offensePlayers.reduce((a, p) => a + pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll), 0);
  const totalDownContrib = s.offensePlayers.reduce((a, p) => a + (p.offenseTotals.downContribution ?? 0), 0);
  const totalHealing = s.healingPlayers.reduce((a, p) => a + pickAllyScopeValue(allyScope, p.healingTotals.healing, p.healingTotals.squadHealing), 0);
  const totalBarrier = s.healingPlayers.reduce((a, p) => a + pickAllyScopeValue(allyScope, p.healingTotals.barrier, p.healingTotals.squadBarrier), 0);
  const totalCleanses = s.supportPlayers.reduce((a, p) => a + (p.supportTotals.condiCleanse ?? 0), 0);
  const totalStrips = s.supportPlayers.reduce((a, p) => a + (p.supportTotals.boonStrips ?? 0), 0);

  const topDps = [...s.offensePlayers]
    .map((p) => ({ account: p.account, profession: p.profession, dps: pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll) / (p.totalFightMs / 1000) }))
    .sort((a, b) => b.dps - a.dps)
    .slice(0, 10);

  const chartData = topDps.map((p) => ({ name: p.account.split(".")[0], DPS: Math.round(p.dps), profession: p.profession }));
  const pressureRows = buildPressureRows(s.offensePlayers, scope);
  const topPressureRows = pressureRows.slice(0, 8);
  const pressureChartRaw = s.fightBreakdown.slice(0, 40).map((fight, index) => {
    const raw = (fight.totalOutgoingDamage ?? 0) * 0.05 + (fight.enemyDowns ?? 0) * 50000 + (fight.enemyDeaths ?? 0) * 80000;
    return {
      name: fight.label || `F${index + 1}`,
      index,
      fullLabel: fight.fullLabel || fight.mapName || `Fight ${index + 1}`,
      outgoingDamage: fight.totalOutgoingDamage ?? 0,
      damage: Math.round((fight.totalOutgoingDamage ?? 0) / 1000000),
      downs: fight.enemyDowns ?? 0,
      kills: fight.enemyDeaths ?? 0,
      raw,
      outgoingSkills: fight.topOutgoingDamageSkills ?? [],
      incomingSkills: fight.topIncomingDamageSkills ?? [],
      hasExactOutgoingSkills: Array.isArray(fight.topOutgoingDamageSkills),
      hasExactIncomingSkills: Array.isArray(fight.topIncomingDamageSkills),
    };
  });
  const maxFightPressure = Math.max(...pressureChartRaw.map((fight) => fight.raw), 1);
  const pressureChartData = pressureChartRaw.map((fight) => ({
    ...fight,
    score: normalizeScore(fight.raw, maxFightPressure),
  }));
  const selectedPressureFight = pressureChartData[Math.min(selectedPressureIndex, Math.max(pressureChartData.length - 1, 0))];
  const pressureSkillRows = sortPressureSkills(
    selectedPressureFight?.outgoingSkills ?? [],
  ).filter((skill) => (skill.downContribution ?? 0) > 0 || (skill.damage ?? 0) > 0);
  const pressureIncomingRows = [...(selectedPressureFight?.incomingSkills ?? [])]
    .filter((skill) => (skill.damage ?? 0) > 0 || (skill.downContribution ?? 0) > 0)
    .sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0) || (b.downContribution ?? 0) - (a.downContribution ?? 0));
  const totalDamageTaken = s.defensePlayers.reduce((a, p) => a + (p.defenseTotals.damageTaken ?? 0), 0);
  const effectiveHealingTotal = totalHealing + totalBarrier - totalDamageTaken;
  const healingEffectiveness = safeDiv(effectiveHealingTotal, totalDamageTaken);
  const healingChartData = buildHealingFightDrilldowns(s.fightBreakdown);
  const hasPerFightHealing = s.fightBreakdown.some((fight) => typeof fight.totalOutgoingHealing === "number");
  const hasOutgoingBarrier = healingChartData.some((fight) => fight.outgoingBarrier !== null);
  const hasAbsorbedBarrier = healingChartData.some((fight) => fight.absorbedBarrier !== null && fight.absorbedBarrier > 0);
  const selectedHealingFight = healingChartData[Math.min(selectedHealingIndex, Math.max(healingChartData.length - 1, 0))];
  const distanceResult = resolveDistanceToTagResult(s.distanceToTag, s.generalPlayers);
  const distanceRows = distanceResult.rows;
  const averageTagDistance = safeDiv(
    distanceRows.reduce((sum, player) => sum + player.avg, 0),
    distanceRows.length,
  );
  const splitCount = distanceRows.filter((player) => player.avg > 1200).length;
  const tightCount = distanceRows.filter((player) => player.avg <= 600).length;
  const pressureLeader = topPressureRows[0];
  const squadOverviewRows = (() => {
    const rows = buildSquadOverviewRows(s, scope, allyScope);
    if (!overviewSort) return rows.sort((a, b) => b.damage - a.damage || a.account.localeCompare(b.account)).slice(0, 25);
    const dir = overviewSort.dir === "asc" ? 1 : -1;
    return rows
      .sort((a, b) => {
        if (overviewSort.key === "player") return a.account.localeCompare(b.account) * dir;
        if (overviewSort.key === "class") return a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account);
        const valueFor = (row: typeof rows[number]) => {
          switch (overviewSort.key) {
            case "damage": return row.damage;
            case "dps": return row.dps;
            case "downContribution": return row.downContribution;
            case "healing": return row.healing;
            case "cleanses": return row.cleanses;
            case "strips": return row.strips;
            case "combat": return row.combatMs;
            case "participation": return row.participation;
            default: return 0;
          }
        };
        return (valueFor(a) - valueFor(b)) * dir || a.account.localeCompare(b.account);
      })
      .slice(0, 25);
  })();
  const toggleOverviewSort = (key: SquadOverviewSortKey) => {
    setOverviewSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };
  const SortHeader = ({ label, k, align = "left" }: { label: string; k: SquadOverviewSortKey; align?: "left" | "right" }) => (
    <th className={`p-2.5 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => toggleOverviewSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-slate-300 ${overviewSort?.key === k ? "text-amber-400" : ""}`}
      >
        {label}
        <span className="text-[8px] opacity-70">{overviewSort?.key === k ? (overviewSort.dir === "desc" ? "▼" : "▲") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="theme-view-layout space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="theme-stat-grid grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Damage" value={fmtCompact(totalDamage)} icon={<Swords className="w-3.5 h-3.5 text-orange-400" />} accent="text-orange-400" />
        <StatCard label="Down Contrib" value={fmtCompact(totalDownContrib)} icon={<Target className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
        <StatCard label="Total Healing" value={fmtCompact(totalHealing)} icon={<Heart className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label="Total Barrier" value={fmtCompact(totalBarrier)} icon={<Shield className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
        <StatCard label="Cleanses" value={fmtNum(totalCleanses)} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
        <StatCard label="Strips" value={fmtNum(totalStrips)} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
      </div>

      <div className="theme-stat-grid grid grid-cols-1 xl:grid-cols-3 gap-4">
        <StatCard
          label="Kill Pressure"
          value={pressureLeader ? `${pressureLeader.pressureScore}%` : "n/a"}
          icon={<Crosshair className="w-3.5 h-3.5 text-rose-400" />}
          accent="text-rose-300"
          sub={pressureLeader ? `${pressureLeader.account} · ${fmtCompact(pressureLeader.downContribution)} down contribution` : "No pressure data available"}
        />
        <StatCard
          label="Healing Effectiveness"
          value={totalDamageTaken > 0 ? fmtCompact(effectiveHealingTotal) : "n/a"}
          icon={<Activity className="w-3.5 h-3.5 text-emerald-400" />}
          accent={effectiveHealingTotal >= 0 ? "text-emerald-300" : "text-rose-300"}
          sub={`healing + barrier - incoming · ${pct(healingEffectiveness)} of incoming`}
        />
        <StatCard
          label="Distance to Tag"
          value={distanceRows.length ? fmtFixed(averageTagDistance, 0) : "n/a"}
          icon={<MapPin className="w-3.5 h-3.5 text-blue-400" />}
          accent="text-blue-300"
          sub={distanceRows.length ? `${tightCount} tight · ${splitCount} split` : "No commander distance in this report"}
        />
      </div>

      <div className="theme-analysis-grid grid grid-cols-1 gap-5">
        <Panel
          title="Kill Pressure"
          subtitle="Damage that actually converts into downs and kills, instead of only raw padding."
          icon={<Crosshair className="w-4 h-4" />}
          accent="text-rose-400"
          action={pressureChartData.length ? `${pressureChartData.length} fights` : "no fights"}
        >
          <div className="theme-drilldown-panel space-y-4">
            <div className="theme-chart-stage h-72 cursor-crosshair">
              {pressureChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={pressureChartData}
                    margin={{ left: 6, right: 16, top: 12, bottom: 6 }}
                    onClick={(event) => {
                      const index = resolveChartSelectionIndex(event, pressureChartData);
                      if (index !== null) setSelectedPressureIndex(index);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="name"
                      tick={(props) => <FightAxisTick {...props} selectedIndex={selectedPressureIndex} onSelect={setSelectedPressureIndex} />}
                      stroke="#334155"
                      interval={0}
                      height={34}
                    />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    {selectedPressureFight && <ReferenceLine x={selectedPressureFight.name} stroke="#fb7185" strokeDasharray="4 4" />}
                    <Line type="monotone" dataKey="score" name="Pressure Score / 100" stroke="#fb7185" strokeWidth={2.25} dot={{ r: 2, cursor: "pointer" }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="downs" name="Enemy Downs" stroke="#38bdf8" strokeWidth={1.75} dot={{ r: 2, cursor: "pointer" }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="kills" name="Enemy Kills" stroke="#f59e0b" strokeWidth={1.75} dot={{ r: 2, cursor: "pointer" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                  No fight pressure timeline is available for this report.
                </div>
              )}
            </div>
            <FightSelectorStrip rows={pressureChartData} selectedIndex={selectedPressureIndex} onSelect={setSelectedPressureIndex} label="Select pressure fight" />
            {selectedPressureFight && (
              <div className="theme-selected-fight rounded-xl border border-slate-800/70 bg-[#080d19]/70 p-3 text-xs text-slate-400">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Selected pressure fight</div>
                    <div className="mt-1 text-sm font-black text-slate-100">
                      {selectedPressureFight.name} · {selectedPressureFight.fullLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPressureIndex(0)}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                  <span>Score <b className="block text-rose-300">{selectedPressureFight.score}/100</b></span>
                  <span>Damage <b className="block text-orange-300">{fmtCompact(selectedPressureFight.outgoingDamage)}</b></span>
                  <span>Downs <b className="block text-amber-300">{fmtNum(selectedPressureFight.downs)}</b></span>
                  <span>Kills <b className="block text-amber-300">{fmtNum(selectedPressureFight.kills)}</b></span>
                </div>
                {(!selectedPressureFight.hasExactOutgoingSkills || !selectedPressureFight.hasExactIncomingSkills) && (
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-200/90">
                    Exact per-fight pressure source rows are unavailable in this saved report. Reparse the original logs with this build to populate them.
                  </div>
                )}
              </div>
            )}
            <div className="theme-source-grid grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="theme-source-card rounded-xl border border-rose-500/15 bg-rose-500/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">Outgoing pressure skills</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{pressureSkillRows.length}</div>
                </div>
                {pressureSkillRows.length ? <SkillSourceRows rows={pressureSkillRows} kind="pressure" /> : (
                  <div className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">
                    No pressure skill breakdown is available for this report yet.
                  </div>
                )}
              </div>
              <div className="theme-source-card rounded-xl border border-rose-500/15 bg-rose-500/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">Incoming skills during fight</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{pressureIncomingRows.length}</div>
                </div>
                {pressureIncomingRows.length ? <SkillSourceRows rows={pressureIncomingRows} kind="incoming" /> : (
                  <div className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">
                    No incoming source rows are available for this selected fight.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Healing Effectiveness"
          subtitle="Effective healing is healing + barrier - incoming damage. Lines connect fights so spikes and sustain gaps are visible."
          icon={<Activity className="w-4 h-4" />}
          accent="text-emerald-400"
          action={totalDamageTaken > 0 ? `${fmtCompact(effectiveHealingTotal)} effective` : "no incoming"}
        >
          <div className="theme-drilldown-panel space-y-4">
            <div className="theme-chart-stage h-72">
              {healingChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={healingChartData}
                    margin={{ left: 8, right: 18, top: 12, bottom: 8 }}
                    onClick={(event) => {
                      const index = resolveChartSelectionIndex(event, healingChartData);
                      if (index !== null) setSelectedHealingIndex(index);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="name"
                      tick={(props) => <FightAxisTick {...props} selectedIndex={selectedHealingIndex} onSelect={setSelectedHealingIndex} />}
                      stroke="#334155"
                      interval={0}
                      height={34}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtCompact(Number(v))}
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      stroke="#334155"
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      formatter={(value, name) => [typeof value === "number" ? fmtCompact(value) : value, name]}
                    />
                    <ReferenceLine y={0} stroke="#334155" />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    {selectedHealingFight && <ReferenceLine x={selectedHealingFight.name} stroke="#f8fafc" strokeDasharray="4 4" />}
                    <Line type="monotone" dataKey="healing" name="Healing" stroke="#34d399" strokeWidth={2} dot={{ r: 2, cursor: "pointer" }} activeDot={{ r: 5 }} connectNulls />
                    {hasOutgoingBarrier && <Line type="monotone" dataKey="outgoingBarrier" name="Outgoing Barrier" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 2, cursor: "pointer" }} activeDot={{ r: 5 }} />}
                    {hasAbsorbedBarrier && <Line type="monotone" dataKey="absorbedBarrier" name="Barrier Absorbed" stroke="#67e8f9" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />}
                    <Line type="monotone" dataKey="incomingDamage" name="Incoming Damage" stroke="#fb7185" strokeWidth={2} dot={{ r: 2, cursor: "pointer" }} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="effectiveHealing" name="Effective Healing" stroke="#f8fafc" strokeWidth={2.5} dot={{ r: 2, cursor: "pointer" }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                  No healing or incoming damage rows are available.
                </div>
              )}
            </div>
            <FightSelectorStrip rows={healingChartData} selectedIndex={selectedHealingIndex} onSelect={setSelectedHealingIndex} label="Select healing fight" />
            <div className="space-y-3">
              <div className="theme-selected-fight rounded-xl border border-slate-800/70 bg-[#080d19]/70 p-3 text-xs text-slate-400">
                {selectedHealingFight ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Selected fight</div>
                        <div className="mt-1 text-sm font-black text-slate-100">{selectedHealingFight.name} · {selectedHealingFight.fullLabel}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedHealingIndex(0)}
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-slate-500 sm:grid-cols-4">
                      <span>Incoming <b className="block text-rose-300">{fmtCompact(selectedHealingFight.incomingDamage)}</b></span>
                      <span>Healing <b className="block text-emerald-300">{selectedHealingFight.healing === null ? "n/a" : fmtCompact(selectedHealingFight.healing)}</b></span>
                      <span>Barrier generated <b className="block text-amber-300">{selectedHealingFight.outgoingBarrier === null ? "n/a" : fmtCompact(selectedHealingFight.outgoingBarrier)}</b></span>
                      <span>Barrier absorbed <b className="block text-amber-300">{selectedHealingFight.absorbedBarrier === null ? "n/a" : fmtCompact(selectedHealingFight.absorbedBarrier)}</b></span>
                    </div>
                    {selectedHealingFight.effectiveHealing === null && (
                      <div className="mt-3 border-l-2 border-amber-400/60 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-100/80">
                        Effective healing is unavailable for this fight because outgoing healing or generated barrier was not recorded. Absorbed barrier is shown separately and is never substituted.
                      </div>
                    )}
                    {(!selectedHealingFight.hasExactOutgoingSkills || !selectedHealingFight.hasExactBarrierSkills || !selectedHealingFight.hasExactIncomingSkills) && (
                      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-200/90">
                        One or more exact per-fight source groups are unavailable in this saved report. Reparse the original logs with this build to populate them.
                      </div>
                    )}
                  </>
                ) : hasPerFightHealing
                  ? "Click a point on the graph to inspect that fight."
                  : "This report was built before per-fight outgoing healing existed; exact fight-by-fight healing appears after reparsing with this build."}
              </div>
              {selectedHealingFight && (
                <div className="theme-source-grid grid grid-cols-1 xl:grid-cols-3 gap-3">
                  <div className="theme-source-card rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Outgoing healing skills</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{selectedHealingFight.outgoingSkills.length}</div>
                    </div>
                    {selectedHealingFight.outgoingSkills.length ? <SkillSourceRows rows={selectedHealingFight.outgoingSkills} kind="healing" /> : (
                      <div className="text-[11px] text-slate-500">Exact per-fight healing sources need a report parsed with this build.</div>
                    )}
                  </div>
                  <div className="theme-source-card rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Outgoing barrier skills</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{selectedHealingFight.barrierSkills.length}</div>
                    </div>
                    {selectedHealingFight.barrierSkills.length ? <SkillSourceRows rows={selectedHealingFight.barrierSkills} kind="barrier" /> : selectedHealingFight.hasExactBarrierSkills ? (
                      <div className="text-[11px] text-slate-500">No outgoing barrier was attributed to a skill in this fight.</div>
                    ) : (
                      <div className="text-[11px] text-amber-200/75">Barrier skill attribution is unavailable in this saved report. Reparse the original log to populate it.</div>
                    )}
                  </div>
                  <div className="theme-source-card rounded-xl border border-rose-500/15 bg-rose-500/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">Top incoming damage skills</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{selectedHealingFight.incomingSkills.length}</div>
                    </div>
                    {selectedHealingFight.incomingSkills.length ? <SkillSourceRows rows={selectedHealingFight.incomingSkills} kind="incoming" /> : (
                      <div className="text-[11px] text-slate-500">Exact per-fight incoming sources need a report parsed with this build.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <DistanceToTagPanel result={distanceResult} />

      {/* DPS chart */}
      <Panel title="Top 10 DPS" icon={<Swords className="w-4 h-4" />} accent="text-orange-400">
        <div className="theme-chart-stage h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#334155" width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar dataKey="DPS" fill={CHART_COLORS.orange} radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Squad summary table */}
      <Panel title="Squad Roster Overview" icon={<Users className="w-4 h-4" />} accent="text-amber-400" bodyClassName="p-0">
        <div className="theme-table-shell overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                <SortHeader label="Player" k="player" />
                <SortHeader label="Class" k="class" />
                <SortHeader label="Damage" k="damage" align="right" />
                <SortHeader label="DPS" k="dps" align="right" />
                <SortHeader label="Down Contrib" k="downContribution" align="right" />
                <SortHeader label="Healing" k="healing" align="right" />
                <SortHeader label="Cleanses" k="cleanses" align="right" />
                <SortHeader label="Strips" k="strips" align="right" />
                <SortHeader label="Combat" k="combat" align="right" />
                <SortHeader label="Fights" k="participation" align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {squadOverviewRows.map((p) => {
                return (
                  <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                    <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                    <td className="p-2.5 text-slate-400">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <ProfessionIcon profession={p.profession} />
                        {p.profession}
                      </span>
                    </td>
                    <td className="p-2.5 text-right text-orange-400">{fmtCompact(p.damage)}</td>
                    <td className="p-2.5 text-right text-slate-200 font-bold">{fmtFixedGrouped(p.dps, 0)}</td>
                    <td className="p-2.5 text-right text-amber-400">{fmtCompact(p.downContribution)}</td>
                    <td className="p-2.5 text-right text-emerald-400">
                      {p.heal ? renderHealing(p.heal, p.healing) : "-"}
                    </td>
                    <td className="p-2.5 text-right text-amber-400">{p.cleanses > 0 ? fmtNum(p.cleanses) : "-"}</td>
                    <td className="p-2.5 text-right text-amber-400">{p.strips > 0 ? fmtNum(p.strips) : "-"}</td>
                    <td className="p-2.5 text-right text-slate-300" title="Active combat time across the fights this player joined">
                      {p.combatMs > 0 ? fmtDur(p.combatMs) : "-"}
                    </td>
                    <td className="p-2.5 text-right text-slate-400" title={`${p.logs} of ${s.total} fights (${pct(p.participation)})`}>
                      <span className="text-slate-200">{p.logs}/{s.total}</span>
                      <span className="ml-1 text-[10px] text-slate-500">{pct(p.participation)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

