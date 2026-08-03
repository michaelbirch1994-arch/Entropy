import { useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtCompact, fmtFixed, profChip } from "../utils/format";
import { Shield, Heart, Droplet, Zap, Wind, Target } from "lucide-react";
import { useStatsDisplay, pickStatsDisplayValue } from "../store/StatsDisplayContext";
import { useAllyScope, pickAllyScopeValue } from "../store/AllyScopeContext";

type Tab = "defense" | "support" | "healing";

export default function DefensiveView() {
  const { report } = useReport();
  const [tab, setTab] = useState<Tab>("support");
  const { mode } = useStatsDisplay();
  const { scope: allyScope } = useAllyScope();
  if (!report) return null;
  const s = report.stats;

  // healingTotals/supportTotals are sparse Record<string, number> maps - a
  // player who never did a given thing this session (e.g. zero barrier from
  // a pure-DPS build) has no key for it at all (`undefined`, not 0), so an
  // unguarded `a + p.x` turns the whole reduce into NaN the moment it hits
  // one. `?? 0` guards every field the same way `damageTaken` already was.
  const totalCleanses = s.supportPlayers.reduce((a, p) => a + (p.supportTotals.condiCleanse ?? 0), 0);
  const totalStrips = s.supportPlayers.reduce((a, p) => a + (p.supportTotals.boonStrips ?? 0), 0);
  const totalRes = s.supportPlayers.reduce((a, p) => a + (p.supportTotals.resurrects ?? 0), 0);
  // Healing/Barrier respect the Squad Only / All Allies toggle - EI already
  // splits each player's healing/barrier into an all-allies total and a
  // squad-only subset (healingTotals.healing vs .squadHealing, same for
  // barrier), so this just picks which of that existing pair to sum.
  const totalHealing = s.healingPlayers.reduce(
    (a, p) => a + pickAllyScopeValue(allyScope, p.healingTotals.healing, p.healingTotals.squadHealing),
    0
  );
  const totalBarrier = s.healingPlayers.reduce(
    (a, p) => a + pickAllyScopeValue(allyScope, p.healingTotals.barrier, p.healingTotals.squadBarrier),
    0
  );
  const totalDamageTaken = s.defensePlayers.reduce((a, p) => a + (p.defenseTotals.damageTaken ?? 0), 0);
  // Barrier absorbed (damageBarrier) is an incoming/defensive stat - damage
  // that never landed because a barrier ate it - distinct from "Total
  // Barrier" above (barrier the player *generated* for others). Both are
  // effectively healing in the sense that they're HP the squad didn't lose,
  // so surface this one alongside Total Healing/Total Barrier too.
  const totalBarrierAbsorbed = s.defensePlayers.reduce((a, p) => a + (p.defenseTotals.damageBarrier ?? 0), 0);

  // Per Second mode divides each total by the combined active seconds of the
  // players behind it, rather than a single fight duration - a multi-fight
  // report has players joining/leaving at different times, so this is the
  // same "how fast was this actually happening" idea as DPS, generalized to
  // every summary card instead of just damage.
  const healingActiveSec = s.healingPlayers.reduce((a, p) => a + (p.activeMs ?? 0), 0) / 1000;
  const supportActiveSec = s.supportPlayers.reduce((a, p) => a + (p.activeMs ?? 0), 0) / 1000;
  const defenseActiveSec = s.defensePlayers.reduce((a, p) => a + (Number(p.totalFightMs) || 0), 0) / 1000;

  const isPerSecond = mode === "perSecond";
  const fmtStat = (v: number, decimals = 0) => (isPerSecond ? fmtFixed(v, decimals || 2) : fmtCompact(v));
  const fmtStatN = (v: number, decimals = 0) => (isPerSecond ? fmtFixed(v, decimals || 2) : fmtNum(v));
  const lbl = (base: string) => (isPerSecond ? `${base}/s` : base);

  return (
    <div className="space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard label={lbl("Total Healing")} value={fmtStat(pickStatsDisplayValue(mode, totalHealing, healingActiveSec))} icon={<Heart className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label={lbl("Total Barrier")} value={fmtStat(pickStatsDisplayValue(mode, totalBarrier, healingActiveSec))} icon={<Shield className="w-3.5 h-3.5 text-teal-400" />} accent="text-teal-400" />
        <StatCard label={lbl("Barrier Absorbed")} value={fmtStat(pickStatsDisplayValue(mode, totalBarrierAbsorbed, defenseActiveSec))} icon={<Shield className="w-3.5 h-3.5 text-teal-300" />} accent="text-teal-300" />
        <StatCard label={lbl("Cleanses")} value={fmtStatN(pickStatsDisplayValue(mode, totalCleanses, supportActiveSec))} icon={<Droplet className="w-3.5 h-3.5 text-cyan-400" />} accent="text-cyan-400" />
        <StatCard label={lbl("Boon Strips")} value={fmtStatN(pickStatsDisplayValue(mode, totalStrips, supportActiveSec))} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
        <StatCard label={lbl("Resurrects")} value={fmtStatN(pickStatsDisplayValue(mode, totalRes, supportActiveSec))} icon={<Wind className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
        <StatCard label={lbl("Damage Taken")} value={fmtStat(pickStatsDisplayValue(mode, totalDamageTaken, defenseActiveSec))} icon={<Target className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {([
          { k: "support", l: "Support" },
          { k: "healing", l: "Healing" },
          { k: "defense", l: "Defensive Stats" },
        ] as { k: Tab; l: string }[]).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              tab === t.k
                ? "bg-teal-500/15 text-teal-400 border-teal-500/40"
                : "bg-[#0a101f] text-slate-500 border-slate-800 hover:text-slate-300"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "support" && (
        <Panel title="Support Stats" icon={<Droplet className="w-4 h-4" />} accent="text-cyan-400" bodyClassName="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Player</th>
                  <th className="p-2.5">Class</th>
                  <th className="p-2.5 text-right">Cleanses</th>
                  <th className="p-2.5 text-right">Strips</th>
                  <th className="p-2.5 text-right">Stun Breaks</th>
                  <th className="p-2.5 text-right">Resurrects</th>
                  <th className="p-2.5 text-right">Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 font-mono">
                {[...s.supportPlayers]
                  .sort((a, b) => (b.supportTotals.condiCleanse ?? 0) - (a.supportTotals.condiCleanse ?? 0))
                  .map((p, i) => (
                    <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                      <td className={`p-2.5 font-bold ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>{i + 1}</td>
                      <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(p.profession)}`}>
                          {p.profession}
                        </span>
                      </td>
                      <td className="p-2.5 text-right text-cyan-400 font-bold">{fmtNum(p.supportTotals.condiCleanse)}</td>
                      <td className="p-2.5 text-right text-amber-400">{p.supportTotals.boonStrips}</td>
                      <td className="p-2.5 text-right text-slate-300">{p.supportTotals.stunBreak}</td>
                      <td className="p-2.5 text-right text-emerald-400">{p.supportTotals.resurrects}</td>
                      <td className="p-2.5 text-right text-slate-500">{p.logsJoined}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "healing" && (
        <Panel title="Healing & Barrier" icon={<Heart className="w-4 h-4" />} accent="text-emerald-400" bodyClassName="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Player</th>
                  <th className="p-2.5">Class</th>
                  <th className="p-2.5 text-right">Healing</th>
                  <th className="p-2.5 text-right">Squad Heal</th>
                  <th className="p-2.5 text-right">Barrier</th>
                  <th className="p-2.5 text-right">Downed Heal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 font-mono">
                {[...s.healingPlayers]
                  .sort((a, b) => (b.healingTotals.healing ?? 0) - (a.healingTotals.healing ?? 0))
                  .map((p, i) => (
                    <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                      <td className={`p-2.5 font-bold ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>{i + 1}</td>
                      <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(p.profession)}`}>
                          {p.profession}
                        </span>
                      </td>
                      <td className="p-2.5 text-right text-emerald-400 font-bold">{fmtCompact(p.healingTotals.healing)}</td>
                      <td className="p-2.5 text-right text-emerald-400/70">{fmtCompact(p.healingTotals.squadHealing)}</td>
                      <td className="p-2.5 text-right text-teal-400">{fmtCompact(p.healingTotals.barrier)}</td>
                      <td className="p-2.5 text-right text-lime-400">{fmtCompact(p.healingTotals.downedHealing)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "defense" && (
        <Panel title="Defensive Stats" icon={<Shield className="w-4 h-4" />} accent="text-rose-400" bodyClassName="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Player</th>
                  <th className="p-2.5">Class</th>
                  <th className="p-2.5 text-right">Damage Taken</th>
                  <th className="p-2.5 text-right">Power Dmg</th>
                  <th className="p-2.5 text-right">Condi Dmg</th>
                  <th className="p-2.5 text-right">Hits</th>
                  <th className="p-2.5 text-right" title="Damage absorbed by barrier">Barrier Absorbed</th>
                  <th className="p-2.5 text-right" title="Number of dodges">Dodges</th>
                  <th className="p-2.5 text-right" title="Number of times was invulnerable to damage">Invulned</th>
                  <th className="p-2.5 text-right" title="Number of times interrupted">Interrupted</th>
                  <th className="p-2.5 text-right">Downs</th>
                  <th className="p-2.5 text-right">Deaths</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 font-mono">
                {[...s.defensePlayers]
                  .sort((a, b) => (b.defenseTotals.damageTaken ?? 0) - (a.defenseTotals.damageTaken ?? 0))
                  .map((p, i) => (
                    <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                      <td className={`p-2.5 font-bold ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>{i + 1}</td>
                      <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(p.profession)}`}>
                          {p.profession}
                        </span>
                      </td>
                      <td className="p-2.5 text-right text-rose-400 font-bold">{fmtCompact(p.defenseTotals.damageTaken)}</td>
                      <td className="p-2.5 text-right text-orange-400">{fmtCompact(p.defenseTotals.powerDamageTaken)}</td>
                      <td className="p-2.5 text-right text-fuchsia-400">{fmtCompact(p.defenseTotals.conditionDamageTaken)}</td>
                      <td className="p-2.5 text-right text-slate-400">{fmtNum(p.defenseTotals.damageTakenCount)}</td>
                      <td className="p-2.5 text-right text-teal-400">{fmtCompact(p.defenseTotals.damageBarrier ?? 0)}</td>
                      <td className="p-2.5 text-right text-cyan-400">{fmtNum(p.defenseTotals.dodgeCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-sky-400">{fmtNum(p.defenseTotals.invulnedCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-purple-400">{fmtNum(p.defenseTotals.interruptedCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-amber-400">{fmtNum(p.defenseTotals.downCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-slate-300">{fmtNum(p.defenseTotals.deadCount ?? 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
