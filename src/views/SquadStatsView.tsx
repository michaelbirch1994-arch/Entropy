import { useReport } from "../store/ReportContext";
import { useDamageScope, pickDamageScopeValue } from "../store/DamageScopeContext";
import { useAllyScope, pickAllyScopeValue } from "../store/AllyScopeContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtCompact, fmtFixed, fmtFixedGrouped } from "../utils/format";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { Users, Swords, Shield, Heart, Zap, Target, Activity, Crosshair, Gauge, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine, ScatterChart, Scatter, ZAxis } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, CHART_COLORS } from "../utils/chartTheme";
import type { GeneralPlayer, HealingPlayer, HealingCoverage, OffensePlayer, DefensePlayer } from "../types/report";

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
    const pressureScore = downContribution + enemyDowns * 25000 + kills * 15000;
    return { account: p.account, profession: p.profession, damage, dps, downContribution, enemyDowns, kills, pressureScore };
  }).sort((a, b) => b.pressureScore - a.pressureScore);
  const max = Math.max(...base.map((p) => p.pressureScore), 1);
  return base.map((p) => ({ ...p, pressurePct: safeDiv(p.pressureScore, max) }));
}

function buildHealingRows(healers: HealingPlayer[], defenders: DefensePlayer[], allyScope: ReturnType<typeof useAllyScope>["scope"]) {
  const defenseByAccount = new Map(defenders.map((p) => [p.account, p]));
  return healers.map((h) => {
    const healing = pickAllyScopeValue(allyScope, h.healingTotals.healing, h.healingTotals.squadHealing);
    const barrier = pickAllyScopeValue(allyScope, h.healingTotals.barrier, h.healingTotals.squadBarrier);
    const downedHealing = pickAllyScopeValue(allyScope, h.healingTotals.downedHealing, h.healingTotals.squadDownedHealing);
    const sustain = healing + barrier + downedHealing;
    const taken = defenseByAccount.get(h.account)?.defenseTotals.damageTaken ?? 0;
    const coverage: HealingCoverage = h.healingCoverage ?? (h.hasHealAddon ? "full" : sustain > 0 ? "partial" : "none");
    return {
      account: h.account,
      profession: h.profession,
      healing,
      barrier,
      downedHealing,
      sustain,
      taken,
      effectiveness: safeDiv(sustain, taken),
      coverage,
    };
  }).filter((r) => r.sustain > 0 || r.taken > 0).sort((a, b) => b.sustain - a.sustain);
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

function MetricBar({ value, tone = "bg-blue-400" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(3, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export default function SquadStatsView() {
  const { report } = useReport();
  const { scope } = useDamageScope();
const { scope: allyScope } = useAllyScope();
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
  const pressureChartData = s.fightBreakdown.slice(0, 40).map((fight, index) => ({
    name: fight.label || `F${index + 1}`,
    damage: Math.round((fight.totalOutgoingDamage ?? 0) / 1000000),
    downs: fight.enemyDowns ?? 0,
    kills: fight.enemyDeaths ?? 0,
    score: Math.round((fight.enemyDowns ?? 0) * 2 + (fight.enemyDeaths ?? 0) * 3 + safeDiv(fight.totalOutgoingDamage ?? 0, 1000000)),
  }));
  const healingRows = buildHealingRows(s.healingPlayers, s.defensePlayers, allyScope);
  const topHealingRows = healingRows.slice(0, 8);
  const totalDamageTaken = s.defensePlayers.reduce((a, p) => a + (p.defenseTotals.damageTaken ?? 0), 0);
  const sustainTotal = totalHealing + totalBarrier;
  const healingEffectiveness = safeDiv(sustainTotal, totalDamageTaken);
  const fullCoverageCount = healingRows.filter((r) => r.coverage === "full").length;
  const partialCoverageCount = healingRows.filter((r) => r.coverage === "partial").length;
  const distanceRows = buildDistanceRows(s.generalPlayers);
  const topDistanceRows = distanceRows.slice(0, 10);
  const averageTagDistance = safeDiv(
    distanceRows.reduce((sum, p) => sum + p.avgDistance * p.samples, 0),
    distanceRows.reduce((sum, p) => sum + p.samples, 0),
  );
  const splitCount = distanceRows.filter((p) => p.avgDistance > 1200).length;
  const tightCount = distanceRows.filter((p) => p.avgDistance <= 600).length;
  const pressureLeader = topPressureRows[0];

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
          value={pressureLeader ? fmtCompact(pressureLeader.pressureScore) : "n/a"}
          icon={<Crosshair className="w-3.5 h-3.5 text-rose-400" />}
          accent="text-rose-300"
          sub={pressureLeader ? `${pressureLeader.account} · ${fmtCompact(pressureLeader.downContribution)} down contribution` : "No pressure data available"}
        />
        <StatCard
          label="Healing Effectiveness"
          value={totalDamageTaken > 0 ? pct(healingEffectiveness) : "n/a"}
          icon={<Activity className="w-3.5 h-3.5 text-emerald-400" />}
          accent="text-emerald-300"
          sub={`${fullCoverageCount} full coverage · ${partialCoverageCount} lower-bound`}
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
          <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-5">
            <div className="h-72">
              {pressureChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pressureChartData} margin={{ left: 6, right: 16, top: 12, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    <Line type="monotone" dataKey="score" name="Pressure Score" stroke="#fb7185" strokeWidth={2.25} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="downs" name="Enemy Downs" stroke="#38bdf8" strokeWidth={1.75} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="kills" name="Enemy Kills" stroke="#f59e0b" strokeWidth={1.75} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                  No fight pressure timeline is available for this report.
                </div>
              )}
            </div>
            <div className="space-y-3">
              {topPressureRows.length ? topPressureRows.map((p) => (
                <div key={p.account} className="rounded-xl border border-slate-800/70 bg-[#080d19]/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <ProfessionIcon profession={p.profession} className="h-4 w-4 shrink-0" />
                      <div className="truncate text-sm font-bold text-slate-200">{p.account}</div>
                    </div>
                    <div className="font-mono text-sm font-black text-rose-300">{fmtCompact(p.pressureScore)}</div>
                  </div>
                  <div className="mt-2">
                    <MetricBar value={p.pressurePct} tone="bg-rose-400" />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                    <span>Downs <b className="text-sky-300">{fmtNum(p.enemyDowns)}</b></span>
                    <span>Kills <b className="text-amber-300">{fmtNum(p.kills)}</b></span>
                    <span>Down C. <b className="text-rose-300">{fmtCompact(p.downContribution)}</b></span>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-800 p-5 text-xs text-slate-500">
                  No player pressure rows are available.
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Healing Effectiveness"
          subtitle="Sustain output compared against the squad damage environment. Healing coverage still matters."
          icon={<Activity className="w-4 h-4" />}
          accent="text-emerald-400"
          action={totalDamageTaken > 0 ? `${pct(healingEffectiveness)} sustain / incoming` : "no incoming"}
        >
          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.95fr] gap-5">
            <div className="h-72">
              {healingRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: 8, right: 18, top: 12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      type="number"
                      dataKey="taken"
                      name="Damage Taken"
                      tickFormatter={(v) => fmtCompact(Number(v))}
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      stroke="#334155"
                    />
                    <YAxis
                      type="number"
                      dataKey="sustain"
                      name="Healing + Barrier"
                      tickFormatter={(v) => fmtCompact(Number(v))}
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      stroke="#334155"
                    />
                    <ZAxis type="number" dataKey="effectiveness" range={[50, 180]} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      formatter={(value, name) => [typeof value === "number" ? fmtCompact(value) : value, name]}
                      cursor={{ strokeDasharray: "3 3" }}
                    />
                    <ReferenceLine y={0} stroke="#334155" />
                    <Scatter name="Players" data={healingRows} fill="#34d399" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                  No healing or incoming damage rows are available.
                </div>
              )}
            </div>
            <div className="space-y-3">
              {topHealingRows.length ? topHealingRows.map((p) => {
                const tone = p.coverage === "full" ? "text-emerald-300" : p.coverage === "partial" ? "text-amber-300" : "text-slate-500";
                return (
                  <div key={p.account} className="rounded-xl border border-slate-800/70 bg-[#080d19]/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <ProfessionIcon profession={p.profession} className="h-4 w-4 shrink-0" />
                        <div className="truncate text-sm font-bold text-slate-200">{p.account}</div>
                      </div>
                      <div className={`font-mono text-xs uppercase tracking-wider ${tone}`}>{p.coverage}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                      <span>Heal <b className="text-emerald-300">{fmtCompact(p.healing)}</b></span>
                      <span>Barrier <b className="text-teal-300">{fmtCompact(p.barrier)}</b></span>
                      <span>Ratio <b className="text-slate-200">{pct(p.effectiveness)}</b></span>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-slate-800 p-5 text-xs text-slate-500">
                  No healing effectiveness rows are available.
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
                <th className="p-2.5">Player</th>
                <th className="p-2.5">Class</th>
                <th className="p-2.5 text-right">Damage</th>
                <th className="p-2.5 text-right">DPS</th>
                <th className="p-2.5 text-right">Down Contrib</th>
                <th className="p-2.5 text-right">Healing</th>
                <th className="p-2.5 text-right">Cleanses</th>
                <th className="p-2.5 text-right">Strips</th>
                <th className="p-2.5 text-right">Logs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {s.offensePlayers.slice(0, 25).map((p) => {
                const heal = s.healingPlayers.find((h) => h.account === p.account);
                const sup = s.supportPlayers.find((sp) => sp.account === p.account);
                const dps = pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll) / (p.totalFightMs / 1000);
                return (
                  <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                    <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                    <td className="p-2.5 text-slate-400">{p.profession}</td>
                    <td className="p-2.5 text-right text-orange-400">{fmtCompact(pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll))}</td>
                    <td className="p-2.5 text-right text-slate-200 font-bold">{fmtFixedGrouped(dps, 0)}</td>
                    <td className="p-2.5 text-right text-sky-400">{fmtCompact(p.offenseTotals.downContribution)}</td>
                    <td className="p-2.5 text-right text-emerald-400">
                      {heal ? renderHealing(heal, pickAllyScopeValue(allyScope, heal.healingTotals.healing, heal.healingTotals.squadHealing)) : "—"}
                    </td>
                    <td className="p-2.5 text-right text-cyan-400">{sup ? fmtNum(sup.supportTotals.condiCleanse) : "—"}</td>
                    <td className="p-2.5 text-right text-amber-400">{sup ? fmtNum(sup.supportTotals.boonStrips) : "—"}</td>
                    <td className="p-2.5 text-right text-slate-500">{s.generalPlayers.find((g) => g.account === p.account)?.logsJoined ?? "—"}</td>
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
