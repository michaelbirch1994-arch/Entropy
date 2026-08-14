import { useState } from "react";
import { useReport } from "../store/ReportContext";
import { useDamageScope, pickDamageScopeValue } from "../store/DamageScopeContext";
import { useAllyScope, pickAllyScopeValue } from "../store/AllyScopeContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtCompact, fmtFixed, fmtFixedGrouped } from "../utils/format";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { Users, Swords, Shield, Heart, Zap, Target, Activity, Crosshair, Gauge, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, CHART_COLORS } from "../utils/chartTheme";
import type { GeneralPlayer, HealingPlayer, HealingCoverage, OffensePlayer, TopHealingSource, TopSkill } from "../types/report";

type SquadOverviewSortKey = "player" | "class" | "damage" | "dps" | "downContribution" | "healing" | "cleanses" | "strips" | "logs";

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

function getChartClickIndex(event: unknown): number | null {
  const chartEvent = event as {
    activePayload?: Array<{ payload?: { index?: unknown } }>;
    activeTooltipIndex?: unknown;
  } | null | undefined;
  const payloadIndex = chartEvent?.activePayload?.[0]?.payload?.index;
  if (typeof payloadIndex === "number") return payloadIndex;
  if (typeof chartEvent?.activeTooltipIndex === "number") return chartEvent.activeTooltipIndex;
  return null;
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

function distanceTone(distance: number) {
  if (distance <= 600) return { label: "tight", dot: "bg-emerald-400", text: "text-emerald-300", border: "border-emerald-500/30", fill: "bg-emerald-500/10" };
  if (distance <= 1200) return { label: "wide", dot: "bg-amber-400", text: "text-amber-300", border: "border-amber-500/30", fill: "bg-amber-500/10" };
  return { label: "split", dot: "bg-rose-400", text: "text-rose-300", border: "border-rose-500/30", fill: "bg-rose-500/10" };
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
  const max = Math.max(...base.map((p) => p.pressureRaw), 1);
  return base.map((p) => ({ ...p, pressureScore: normalizeScore(p.pressureRaw, max), pressurePct: safeDiv(p.pressureRaw, max) }));
}

function buildDistanceRows(players: GeneralPlayer[]) {
  return players
    .filter((p) => !/commander/i.test(p.account) && p.distCount > 0 && p.totalDist >= 0)
    .map((p) => ({
      account: p.account,
      profession: p.profession,
      avgDistance: safeDiv(p.totalDist, p.distCount),
      samples: p.distCount,
      fights: p.logsJoined,
    }))
    .filter((p) => Number.isFinite(p.avgDistance) && p.avgDistance >= 0)
    .sort((a, b) => b.avgDistance - a.avgDistance);
}

function SkillSourceRows({
  rows,
  kind,
}: {
  rows: Array<TopSkill | TopHealingSource>;
  kind: "pressure" | "incoming" | "healing";
}) {
  const tone = kind === "healing" ? "text-emerald-200" : kind === "incoming" ? "text-rose-200" : "text-rose-200";
  return rows.length ? (
    <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
      {rows.map((skill, index) => {
        const asPressure = skill as TopSkill;
        const asHealing = skill as TopHealingSource;
        const primary = kind === "healing" ? asHealing.healing : kind === "incoming" ? asPressure.damage : asPressure.downContribution ?? 0;
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
              <span className="ml-1 text-[10px] text-slate-500">{kind === "pressure" ? "down" : kind === "incoming" ? "dmg" : "heal"}</span>
              {secondary > 0 && <span className="ml-2 text-slate-500">{fmtCompact(secondary)} {kind === "pressure" ? "dmg" : "down"}</span>}
              <span className="ml-2 text-slate-500">{fmtNum(skill.hits)} hits</span>
            </span>
          </div>
        );
      })}
    </div>
  ) : null;
}

export default function SquadStatsView() {
  const { report } = useReport();
  const { scope } = useDamageScope();
  const { scope: allyScope } = useAllyScope();
  const [selectedPressureIndex, setSelectedPressureIndex] = useState(0);
  const [selectedHealingIndex, setSelectedHealingIndex] = useState(0);
  const [hoveredDistanceAccount, setHoveredDistanceAccount] = useState<string | null>(null);
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
      hasExactOutgoingSkills: (fight.topOutgoingDamageSkills?.length ?? 0) > 0,
      hasExactIncomingSkills: (fight.topIncomingDamageSkills?.length ?? 0) > 0,
    };
  });
  const maxFightPressure = Math.max(...pressureChartRaw.map((fight) => fight.raw), 1);
  const pressureChartData = pressureChartRaw.map((fight) => ({
    ...fight,
    score: normalizeScore(fight.raw, maxFightPressure),
  }));
  const selectedPressureFight = pressureChartData[Math.min(selectedPressureIndex, Math.max(pressureChartData.length - 1, 0))];
  const pressureSkillRows = sortPressureSkills(
    selectedPressureFight?.outgoingSkills.length
      ? selectedPressureFight.outgoingSkills
      : ((s.topSkillsByDownContribution?.length ? s.topSkillsByDownContribution : s.topSkills) ?? []),
  ).filter((skill) => (skill.downContribution ?? 0) > 0 || (skill.damage ?? 0) > 0);
  const pressureIncomingRows = [...(selectedPressureFight?.incomingSkills.length ? selectedPressureFight.incomingSkills : (s.topIncomingSkills ?? []))]
    .filter((skill) => (skill.damage ?? 0) > 0 || (skill.downContribution ?? 0) > 0)
    .sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0) || (b.downContribution ?? 0) - (a.downContribution ?? 0));
  const totalDamageTaken = s.defensePlayers.reduce((a, p) => a + (p.defenseTotals.damageTaken ?? 0), 0);
  const effectiveHealingTotal = totalHealing + totalBarrier - totalDamageTaken;
  const healingEffectiveness = safeDiv(effectiveHealingTotal, totalDamageTaken);
  const healingChartData = s.fightBreakdown.slice(0, 40).map((fight, index) => {
    const healing = Number(fight.totalOutgoingHealing ?? 0);
    const barrier = Number(fight.totalOutgoingBarrier ?? fight.incomingBarrierAbsorbed ?? 0);
    const incomingDamage = Number(fight.totalIncomingDamage ?? 0);
    const exactOutgoingSkills = fight.topOutgoingHealingSkills ?? [];
    const exactIncomingSkills = fight.topIncomingDamageSkills ?? [];
    return {
      name: fight.label || `F${index + 1}`,
      index,
      fullLabel: fight.fullLabel || fight.mapName || `Fight ${index + 1}`,
      healing,
      barrier,
      incomingDamage,
      effectiveHealing: Number(fight.effectiveHealing ?? (healing + barrier - incomingDamage)),
      outgoingSkills: exactOutgoingSkills.length ? exactOutgoingSkills : (s.topHealingSkills ?? []),
      incomingSkills: exactIncomingSkills.length ? exactIncomingSkills : (s.topIncomingSkills ?? []),
      hasExactOutgoingSkills: exactOutgoingSkills.length > 0,
      hasExactIncomingSkills: exactIncomingSkills.length > 0,
    };
  });
  const hasPerFightHealing = s.fightBreakdown.some((fight) => typeof fight.totalOutgoingHealing === "number");
  const selectedHealingFight = healingChartData[Math.min(selectedHealingIndex, Math.max(healingChartData.length - 1, 0))];
  const distanceRows = buildDistanceRows(s.generalPlayers);
  const topDistanceRows = distanceRows.slice(0, 10);
  const averageTagDistance = safeDiv(
    distanceRows.reduce((sum, p) => sum + p.avgDistance * p.samples, 0),
    distanceRows.reduce((sum, p) => sum + p.samples, 0),
  );
  const splitCount = distanceRows.filter((p) => p.avgDistance > 1200).length;
  const tightCount = distanceRows.filter((p) => p.avgDistance <= 600).length;
  const pressureLeader = topPressureRows[0];
  const hoveredDistance = topDistanceRows.find((p) => p.account === hoveredDistanceAccount);
  const squadOverviewRows = (() => {
    const rows = s.offensePlayers.map((p) => {
      const heal = s.healingPlayers.find((h) => h.account === p.account);
      const sup = s.supportPlayers.find((sp) => sp.account === p.account);
      const damage = pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll);
      const dps = safeDiv(damage, p.totalFightMs / 1000);
      return {
        account: p.account,
        profession: p.profession,
        damage,
        dps,
        downContribution: p.offenseTotals.downContribution ?? 0,
        heal,
        healing: heal ? pickAllyScopeValue(allyScope, heal.healingTotals.healing, heal.healingTotals.squadHealing) : 0,
        cleanses: sup?.supportTotals.condiCleanse ?? 0,
        strips: sup?.supportTotals.boonStrips ?? 0,
        logs: s.generalPlayers.find((g) => g.account === p.account)?.logsJoined ?? 0,
      };
    });
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
            case "logs": return row.logs;
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
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-slate-300 ${overviewSort?.key === k ? "text-sky-400" : ""}`}
      >
        {label}
        <span className="text-[8px] opacity-70">{overviewSort?.key === k ? (overviewSort.dir === "desc" ? "▼" : "▲") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Damage" value={fmtCompact(totalDamage)} icon={<Swords className="w-3.5 h-3.5 text-orange-400" />} accent="text-orange-400" />
        <StatCard label="Down Contrib" value={fmtCompact(totalDownContrib)} icon={<Target className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
        <StatCard label="Total Healing" value={fmtCompact(totalHealing)} icon={<Heart className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label="Total Barrier" value={fmtCompact(totalBarrier)} icon={<Shield className="w-3.5 h-3.5 text-teal-400" />} accent="text-teal-400" />
        <StatCard label="Cleanses" value={fmtNum(totalCleanses)} icon={<Zap className="w-3.5 h-3.5 text-cyan-400" />} accent="text-cyan-400" />
        <StatCard label="Strips" value={fmtNum(totalStrips)} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <StatCard
          label="Kill Pressure"
          value={pressureLeader ? `${pressureLeader.pressureScore}/100` : "n/a"}
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

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
        <Panel
          title="Kill Pressure"
          subtitle="Damage that actually converts into downs and kills, instead of only raw padding."
          icon={<Crosshair className="w-4 h-4" />}
          accent="text-rose-400"
          action={pressureChartData.length ? `${pressureChartData.length} fights` : "no fights"}
        >
          <div className="space-y-4">
            <div className="h-72 cursor-crosshair">
              {pressureChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={pressureChartData}
                    margin={{ left: 6, right: 16, top: 12, bottom: 6 }}
                    onClick={(event) => {
                      const index = getChartClickIndex(event);
                      if (index !== null) setSelectedPressureIndex(index);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" interval="preserveStartEnd" />
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
            {selectedPressureFight && (
              <div className="rounded-xl border border-slate-800/70 bg-[#080d19]/70 p-3 text-xs text-slate-400">
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
                  <span>Downs <b className="block text-sky-300">{fmtNum(selectedPressureFight.downs)}</b></span>
                  <span>Kills <b className="block text-amber-300">{fmtNum(selectedPressureFight.kills)}</b></span>
                </div>
                {(!selectedPressureFight.hasExactOutgoingSkills || !selectedPressureFight.hasExactIncomingSkills) && (
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-200/90">
                    Exact per-fight pressure source rows were not available for this point, so Entropy is showing report-level source fallback rows.
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-3">
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
              <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-3">
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
          <div className="space-y-4">
            <div className="h-72">
              {healingChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={healingChartData}
                    margin={{ left: 8, right: 18, top: 12, bottom: 8 }}
                    onClick={(event) => {
                      const index = getChartClickIndex(event);
                      if (index !== null) setSelectedHealingIndex(index);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      stroke="#334155"
                      interval="preserveStartEnd"
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
                    <Line type="monotone" dataKey="barrier" name={hasPerFightHealing ? "Barrier" : "Barrier Absorbed"} stroke="#2dd4bf" strokeWidth={2} dot={{ r: 2, cursor: "pointer" }} activeDot={{ r: 5 }} connectNulls />
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
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-800/70 bg-[#080d19]/70 p-3 text-xs text-slate-400">
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
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                      <span>Incoming <b className="block text-rose-300">{fmtCompact(selectedHealingFight.incomingDamage)}</b></span>
                      <span>Healing <b className="block text-emerald-300">{fmtCompact(selectedHealingFight.healing)}</b></span>
                      <span>Barrier <b className="block text-teal-300">{fmtCompact(selectedHealingFight.barrier)}</b></span>
                    </div>
                    {(!selectedHealingFight.hasExactOutgoingSkills || !selectedHealingFight.hasExactIncomingSkills) && (
                      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-200/90">
                        Exact per-fight source rows were not available for this point, so Entropy is showing the best report-level source fallback instead of an empty panel.
                      </div>
                    )}
                  </>
                ) : hasPerFightHealing
                  ? "Click a point on the graph to inspect that fight."
                  : "This report was built before per-fight outgoing healing existed; exact fight-by-fight healing appears after reparsing with this build."}
              </div>
              {selectedHealingFight && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Top outgoing healing / barrier skills</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{selectedHealingFight.outgoingSkills.length}</div>
                    </div>
                    {selectedHealingFight.outgoingSkills.length ? <SkillSourceRows rows={selectedHealingFight.outgoingSkills} kind="healing" /> : (
                      <div className="text-[11px] text-slate-500">Exact per-fight healing sources need a report parsed with this build.</div>
                    )}
                  </div>
                  <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-3">
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

      <Panel
        title="Distance to Tag"
        subtitle="Average commander distance from EI/replay data. Green is tight, amber is wide, red means split."
        icon={<Gauge className="w-4 h-4" />}
        accent="text-blue-400"
        action={distanceRows.length ? `${distanceRows.length} players` : "no distance data"}
      >
        {distanceRows.length ? (
          <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-center">
            <div className="relative mx-auto aspect-square w-full max-w-[380px] rounded-full border border-slate-700/80 bg-[radial-gradient(circle,rgba(52,211,153,0.18)_0_24%,rgba(245,158,11,0.14)_25%_48%,rgba(251,113,133,0.12)_49%_72%,rgba(15,23,42,0.6)_73%)] shadow-inner">
              <div className="absolute inset-[24%] rounded-full border border-emerald-400/35" />
              <div className="absolute inset-[8%] rounded-full border border-amber-400/35" />
              <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-blue-400/40 bg-blue-500/15 text-[10px] font-black uppercase tracking-wider text-blue-200">
                Tag
              </div>
              {hoveredDistance && (
                <div className="absolute left-1/2 top-4 z-10 w-56 -translate-x-1/2 rounded-xl border border-slate-700 bg-[#080d19]/95 p-3 text-center shadow-xl">
                  <div className="truncate text-sm font-black text-slate-100">{hoveredDistance.account}</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                    <ProfessionIcon profession={hoveredDistance.profession} className="h-3.5 w-3.5" />
                    {hoveredDistance.profession}
                  </div>
                  <div className="mt-2 font-mono text-sm font-black text-blue-200">{fmtFixed(hoveredDistance.avgDistance, 0)} avg distance</div>
                  <div className="text-[10px] text-slate-500">{fmtNum(hoveredDistance.samples)} samples · {fmtNum(hoveredDistance.fights)} fights</div>
                </div>
              )}
              {topDistanceRows.map((p, index) => {
                const angle = (index / Math.max(1, topDistanceRows.length)) * Math.PI * 2 - Math.PI / 2;
                const radius = Math.min(43, Math.max(10, (p.avgDistance / 1800) * 43));
                const tone = distanceTone(p.avgDistance);
                const left = 50 + Math.cos(angle) * radius;
                const top = 50 + Math.sin(angle) * radius;
                return (
                  <div
                    key={p.account}
                    className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 ${tone.dot} shadow-[0_0_18px_rgba(255,255,255,0.15)]`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    onMouseEnter={() => setHoveredDistanceAccount(p.account)}
                    onMouseLeave={() => setHoveredDistanceAccount(null)}
                    onFocus={() => setHoveredDistanceAccount(p.account)}
                    onBlur={() => setHoveredDistanceAccount(null)}
                    title={`${p.account}: ${fmtFixed(p.avgDistance, 0)} average distance`}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {topDistanceRows.map((p) => {
                const tone = distanceTone(p.avgDistance);
                return (
                  <div key={p.account} className={`rounded-xl border ${tone.border} ${tone.fill} p-3`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <ProfessionIcon profession={p.profession} className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm font-bold text-slate-200">{p.account}</span>
                      </div>
                      <span className={`font-mono text-sm font-black ${tone.text}`}>{fmtFixed(p.avgDistance, 0)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
                      <span>{tone.label}</span>
                      <span>{fmtNum(p.samples)} samples · {fmtNum(p.fights)} fights</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
            This report does not include commander distance or replay positioning data, so Entropy is not inventing a tag-distance score.
          </div>
        )}
      </Panel>

      {/* DPS chart */}
      <Panel title="Top 10 DPS" icon={<Swords className="w-4 h-4" />} accent="text-orange-400">
        <div className="h-72">
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
      <Panel title="Squad Roster Overview" icon={<Users className="w-4 h-4" />} accent="text-sky-400" bodyClassName="p-0">
        <div className="overflow-x-auto custom-scrollbar">
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
                <SortHeader label="Logs" k="logs" align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {squadOverviewRows.map((p) => {
                return (
                  <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                    <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                    <td className="p-2.5 text-slate-400">{p.profession}</td>
                    <td className="p-2.5 text-right text-orange-400">{fmtCompact(p.damage)}</td>
                    <td className="p-2.5 text-right text-slate-200 font-bold">{fmtFixedGrouped(p.dps, 0)}</td>
                    <td className="p-2.5 text-right text-sky-400">{fmtCompact(p.downContribution)}</td>
                    <td className="p-2.5 text-right text-emerald-400">
                      {p.heal ? renderHealing(p.heal, p.healing) : "-"}
                    </td>
                    <td className="p-2.5 text-right text-cyan-400">{p.cleanses > 0 ? fmtNum(p.cleanses) : "-"}</td>
                    <td className="p-2.5 text-right text-amber-400">{p.strips > 0 ? fmtNum(p.strips) : "-"}</td>
                    <td className="p-2.5 text-right text-slate-500">{p.logs || "-"}</td>
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
