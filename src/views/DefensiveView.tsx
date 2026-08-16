import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtCompact, fmtFixed, profChip } from "../utils/format";
import { Shield, Heart, Droplet, Zap, Wind, Target } from "lucide-react";
import { useStatsDisplay, pickStatsDisplayValue } from "../store/StatsDisplayContext";
import { useAllyScope, pickAllyScopeValue } from "../store/AllyScopeContext";
import ProfessionIcon from "../components/ui/ProfessionIcon";

type Tab = "defense" | "support" | "healing";
type DefensiveSortKey =
  | "player" | "class" | "cleanses" | "strips" | "stunBreaks" | "resurrects" | "logs"
  | "healing" | "squadHealing" | "barrier" | "downedHealing"
  | "damageTaken" | "powerDamage" | "condiDamage" | "hits" | "barrierAbsorbed" | "mitigatedDamage" | "blocks" | "dodges" | "invulned" | "interrupted" | "downs" | "deaths";

// s.*Players arrays can contain duplicate entries for the same account (e.g.
// a build swap mid-report), which is easy to miss in the default sort order
// but becomes obvious once a column sort scatters the duplicates apart -
// mirrors the same account-dedupe fix applied in BuffsView/OffensiveView.
function dedupeByAccount<T extends { account: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((r) => [r.account, r])).values());
}

export default function DefensiveView() {
  const { report } = useReport();
  const [tab, setTab] = useState<Tab>("support");
  const [sort, setSort] = useState<{ key: DefensiveSortKey; dir: "asc" | "desc" } | null>(null);
  const { mode } = useStatsDisplay();
  const { scope: allyScope } = useAllyScope();
  const s = report?.stats;

  // Deduped once here so every summary card, MVP list, and sortable table
  // built from these derives from a single row per player instead of
  // silently double-counting totals or rendering the same player twice.
  const supportPlayers = useMemo(() => dedupeByAccount(s?.supportPlayers ?? []), [s]);
  const healingPlayers = useMemo(() => dedupeByAccount(s?.healingPlayers ?? []), [s]);
  const defensePlayers = useMemo(() => dedupeByAccount(s?.defensePlayers ?? []), [s]);
  const damageMitigationPlayers = useMemo(() => dedupeByAccount(s?.damageMitigationPlayers ?? []), [s]);

  const mitigationByAccount = useMemo(() => {
    const rows = damageMitigationPlayers;
    const map = new Map<string, (typeof rows)[number]>();
    rows.forEach((row) => {
      map.set(row.account, row);
      if (row.profession && row.profession !== "Unknown") map.set(`${row.account}::${row.profession}`, row);
    });
    return map;
  }, [damageMitigationPlayers]);

  const totals = useMemo(() => {
    if (!s) return null;

    // healingTotals/supportTotals are sparse Record<string, number> maps - a
    // player who never did a given thing this session (e.g. zero barrier from
    // a pure-DPS build) has no key for it at all (`undefined`, not 0), so an
    // unguarded `a + p.x` turns the whole reduce into NaN the moment it hits
    // one. `?? 0` guards every field the same way `damageTaken` already was.
    const totalCleanses = supportPlayers.reduce((a, p) => a + (p.supportTotals.condiCleanse ?? 0), 0);
    const totalStrips = supportPlayers.reduce((a, p) => a + (p.supportTotals.boonStrips ?? 0), 0);
    const totalRes = supportPlayers.reduce((a, p) => a + (p.supportTotals.resurrects ?? 0), 0);
    // Healing/Barrier respect the Squad Only / All Allies toggle - EI already
    // splits each player's healing/barrier into an all-allies total and a
    // squad-only subset (healingTotals.healing vs .squadHealing, same for
    // barrier), so this just picks which of that existing pair to sum.
    const totalHealing = healingPlayers.reduce(
      (a, p) => a + pickAllyScopeValue(allyScope, p.healingTotals.healing, p.healingTotals.squadHealing),
      0
    );
    const totalBarrier = healingPlayers.reduce(
      (a, p) => a + pickAllyScopeValue(allyScope, p.healingTotals.barrier, p.healingTotals.squadBarrier),
      0
    );
    const totalDamageTaken = defensePlayers.reduce((a, p) => a + (p.defenseTotals.damageTaken ?? 0), 0);
    const totalMitigatedDamage = damageMitigationPlayers.reduce((a, p) => a + (p.mitigationTotals.totalMitigation ?? 0), 0);
    const totalBlocks = defensePlayers.reduce(
      (a, p) => a + ((mitigationByAccount.get(`${p.account}::${p.profession}`) ?? mitigationByAccount.get(p.account))?.mitigationTotals.blocked ?? p.defenseTotals.blockedCount ?? 0),
      0
    );
    // Barrier absorbed (damageBarrier) is an incoming/defensive stat - damage
    // that never landed because a barrier ate it - distinct from "Total
    // Barrier" above (barrier the player *generated* for others). Both are
    // effectively healing in the sense that they're HP the squad didn't lose,
    // so surface this one alongside Total Healing/Total Barrier too.
    const totalBarrierAbsorbed = defensePlayers.reduce((a, p) => a + (p.defenseTotals.damageBarrier ?? 0), 0);

    // Per Second mode divides each total by the combined active seconds of the
    // players behind it, rather than a single fight duration - a multi-fight
    // report has players joining/leaving at different times, so this is the
    // same "how fast was this actually happening" idea as DPS, generalized to
    // every summary card instead of just damage.
    const healingActiveSec = healingPlayers.reduce((a, p) => a + (p.activeMs ?? 0), 0) / 1000;
    const supportActiveSec = supportPlayers.reduce((a, p) => a + (p.activeMs ?? 0), 0) / 1000;
    const defenseActiveSec = defensePlayers.reduce((a, p) => a + (Number(p.totalFightMs) || 0), 0) / 1000;
    const mitigationActiveSec = damageMitigationPlayers.reduce((a, p) => a + (Number(p.activeMs) || 0), 0) / 1000;

    return {
      totalCleanses,
      totalStrips,
      totalRes,
      totalHealing,
      totalBarrier,
      totalDamageTaken,
      totalMitigatedDamage,
      totalBlocks,
      totalBarrierAbsorbed,
      healingActiveSec,
      supportActiveSec,
      defenseActiveSec,
      mitigationActiveSec: mitigationActiveSec || defenseActiveSec,
    };
  }, [s, allyScope, supportPlayers, healingPlayers, defensePlayers, damageMitigationPlayers, mitigationByAccount]);

  const supportRows = useMemo(() => {
    if (!s || tab !== "support") return [];
    const rows = [...supportPlayers].sort((a, b) => (b.supportTotals.condiCleanse ?? 0) - (a.supportTotals.condiCleanse ?? 0));
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    const numeric: Partial<Record<DefensiveSortKey, (p: typeof rows[number]) => number>> = {
      cleanses: (p) => p.supportTotals.condiCleanse ?? 0,
      strips: (p) => p.supportTotals.boonStrips ?? 0,
      stunBreaks: (p) => p.supportTotals.stunBreak ?? 0,
      resurrects: (p) => p.supportTotals.resurrects ?? 0,
      logs: (p) => p.logsJoined ?? 0,
    };
    if (sort.key === "player") return rows.sort((a, b) => a.account.localeCompare(b.account) * dir);
    if (sort.key === "class") return rows.sort((a, b) => a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account));
    const get = numeric[sort.key];
    return get ? rows.sort((a, b) => (get(a) - get(b)) * dir || a.account.localeCompare(b.account)) : rows;
  }, [s, tab, sort, supportPlayers]);

  const healingRows = useMemo(() => {
    if (!s || tab !== "healing") return [];
    const rows = [...healingPlayers].sort(
      (a, b) =>
        pickAllyScopeValue(allyScope, b.healingTotals.healing, b.healingTotals.squadHealing) -
        pickAllyScopeValue(allyScope, a.healingTotals.healing, a.healingTotals.squadHealing)
    );
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    const numeric: Partial<Record<DefensiveSortKey, (p: typeof rows[number]) => number>> = {
      healing: (p) => pickAllyScopeValue(allyScope, p.healingTotals.healing, p.healingTotals.squadHealing),
      squadHealing: (p) => p.healingTotals.squadHealing ?? 0,
      barrier: (p) => pickAllyScopeValue(allyScope, p.healingTotals.barrier, p.healingTotals.squadBarrier),
      downedHealing: (p) => p.healingTotals.downedHealing ?? 0,
    };
    if (sort.key === "player") return rows.sort((a, b) => a.account.localeCompare(b.account) * dir);
    if (sort.key === "class") return rows.sort((a, b) => a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account));
    const get = numeric[sort.key];
    return get ? rows.sort((a, b) => (get(a) - get(b)) * dir || a.account.localeCompare(b.account)) : rows;
  }, [s, tab, allyScope, sort, healingPlayers]);

  const healingMvpRows = useMemo(() => {
    if (!s || tab !== "healing") return [];
    const firstPositive = (...values: Array<number | undefined>) => values.find((value) => Number.isFinite(value) && (value ?? 0) > 0) ?? 0;

    return [...healingPlayers]
      .map((p) => {
        const scopeHealing = pickAllyScopeValue(allyScope, p.healingTotals.healing, p.healingTotals.squadHealing);
        const scopeBarrier = pickAllyScopeValue(allyScope, p.healingTotals.barrier, p.healingTotals.squadBarrier);
        const healing = firstPositive(scopeHealing, p.healingTotals.squadHealing, p.healingTotals.healing);
        const barrier = firstPositive(scopeBarrier, p.healingTotals.squadBarrier, p.healingTotals.barrier);
        const downedHealing = firstPositive(
          p.healingTotals.squadDownedHealing,
          p.healingTotals.groupDownedHealing,
          p.healingTotals.downedHealing,
        );
        const lifeSiphon = firstPositive(p.healingTotals.squadConversionHealing, p.healingTotals.conversionHealing);
        const sustain = healing + barrier + downedHealing + lifeSiphon;
        return { ...p, healing, barrier, downedHealing, lifeSiphon, sustain };
      })
      .filter((p) => p.sustain > 0)
      .sort((a, b) => b.sustain - a.sustain)
      .slice(0, 8);
  }, [s, tab, allyScope, healingPlayers]);

  const defenseRows = useMemo(() => {
    if (!s || tab !== "defense") return [];
    const rows = [...defensePlayers].sort((a, b) => (b.defenseTotals.damageTaken ?? 0) - (a.defenseTotals.damageTaken ?? 0));
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    const mitigationFor = (p: typeof rows[number]) => (mitigationByAccount.get(`${p.account}::${p.profession}`) ?? mitigationByAccount.get(p.account))?.mitigationTotals;
    const numeric: Partial<Record<DefensiveSortKey, (p: typeof rows[number]) => number>> = {
      damageTaken: (p) => p.defenseTotals.damageTaken ?? 0,
      powerDamage: (p) => p.defenseTotals.powerDamageTaken ?? 0,
      condiDamage: (p) => p.defenseTotals.conditionDamageTaken ?? 0,
      hits: (p) => p.defenseTotals.damageTakenCount ?? 0,
      barrierAbsorbed: (p) => p.defenseTotals.damageBarrier ?? 0,
      mitigatedDamage: (p) => mitigationFor(p)?.totalMitigation ?? 0,
      blocks: (p) => mitigationFor(p)?.blocked ?? p.defenseTotals.blockedCount ?? 0,
      dodges: (p) => p.defenseTotals.dodgeCount ?? 0,
      invulned: (p) => p.defenseTotals.invulnedCount ?? 0,
      interrupted: (p) => p.defenseTotals.interruptedCount ?? 0,
      downs: (p) => p.defenseTotals.downCount ?? 0,
      deaths: (p) => p.defenseTotals.deadCount ?? 0,
    };
    if (sort.key === "player") return rows.sort((a, b) => a.account.localeCompare(b.account) * dir);
    if (sort.key === "class") return rows.sort((a, b) => a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account));
    const get = numeric[sort.key];
    return get ? rows.sort((a, b) => (get(a) - get(b)) * dir || a.account.localeCompare(b.account)) : rows;
  }, [s, tab, sort, mitigationByAccount, defensePlayers]);

  if (!report || !s || !totals) return null;

  const isPerSecond = mode === "perSecond";
  // Per-player cells divide by that player's own active combat time, not the
  // squad-wide total the summary cards use - otherwise a "/s" column would be
  // rating everyone against the whole squad's clock.
  const perPlayer = (v: number, activeMs: number | undefined) => {
    if (!isPerSecond) return fmtCompact(v);
    const secs = (activeMs ?? 0) / 1000;
    return secs > 0 ? fmtFixed(v / secs, 2) : "-";
  };
  const fmtStat = (v: number, decimals = 0) => (isPerSecond ? fmtFixed(v, decimals || 2) : fmtCompact(v));
  const fmtStatN = (v: number, decimals = 0) => (isPerSecond ? fmtFixed(v, decimals || 2) : fmtNum(v));
  const lbl = (base: string) => (isPerSecond ? `${base}/s` : base);
  const toggleSort = (key: DefensiveSortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };
  const SortHeader = ({ label, k, align = "left", title }: { label: string; k: DefensiveSortKey; align?: "left" | "right"; title?: string }) => (
    <th className={`p-2.5 ${align === "right" ? "text-right" : ""}`} title={title}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-slate-300 ${sort?.key === k ? "text-sky-400" : ""}`}
      >
        {label}
        <span className="text-[8px] opacity-70">{sort?.key === k ? (sort.dir === "desc" ? "▼" : "▲") : "↕"}</span>
      </button>
    </th>
  );

  const ClassCell = ({ profession }: { profession: string }) => (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(profession)}`}>
      <ProfessionIcon profession={profession} className="w-3.5 h-3.5 shrink-0" />
      {profession}
    </span>
  );

  return (
    <div className="space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-9 gap-4">
        <StatCard label={lbl("Total Healing")} value={fmtStat(pickStatsDisplayValue(mode, totals.totalHealing, totals.healingActiveSec))} icon={<Heart className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label={lbl("Total Barrier")} value={fmtStat(pickStatsDisplayValue(mode, totals.totalBarrier, totals.healingActiveSec))} icon={<Shield className="w-3.5 h-3.5 text-teal-400" />} accent="text-teal-400" />
        <StatCard label={lbl("Barrier Absorbed")} value={fmtStat(pickStatsDisplayValue(mode, totals.totalBarrierAbsorbed, totals.defenseActiveSec))} icon={<Shield className="w-3.5 h-3.5 text-teal-300" />} accent="text-teal-300" />
        <StatCard label={lbl("Mitigated Damage")} value={fmtStat(pickStatsDisplayValue(mode, totals.totalMitigatedDamage, totals.mitigationActiveSec))} icon={<Shield className="w-3.5 h-3.5 text-blue-400" />} accent="text-blue-400" />
        <StatCard label={lbl("Cleanses")} value={fmtStatN(pickStatsDisplayValue(mode, totals.totalCleanses, totals.supportActiveSec))} icon={<Droplet className="w-3.5 h-3.5 text-cyan-400" />} accent="text-cyan-400" />
        <StatCard label={lbl("Boon Strips")} value={fmtStatN(pickStatsDisplayValue(mode, totals.totalStrips, totals.supportActiveSec))} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
        <StatCard label={lbl("Resurrects")} value={fmtStatN(pickStatsDisplayValue(mode, totals.totalRes, totals.supportActiveSec))} icon={<Wind className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
        <StatCard label={lbl("Blocks")} value={fmtStatN(pickStatsDisplayValue(mode, totals.totalBlocks, totals.defenseActiveSec))} icon={<Shield className="w-3.5 h-3.5 text-indigo-400" />} accent="text-indigo-400" />
        <StatCard label={lbl("Damage Taken")} value={fmtStat(pickStatsDisplayValue(mode, totals.totalDamageTaken, totals.defenseActiveSec))} icon={<Target className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" />
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
                  <SortHeader label="Player" k="player" />
                  <SortHeader label="Class" k="class" />
                  <SortHeader label="Cleanses" k="cleanses" align="right" />
                  <SortHeader label="Strips" k="strips" align="right" />
                  <SortHeader label="Stun Breaks" k="stunBreaks" align="right" />
                  <SortHeader label="Resurrects" k="resurrects" align="right" />
                  <SortHeader label="Logs" k="logs" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 font-mono">
                {supportRows.map((p, i) => (
                  <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                    <td className={`p-2.5 font-bold ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>{i + 1}</td>
                    <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                    <td className="p-2.5"><ClassCell profession={p.profession} /></td>
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
        <Panel
          title="Healing MVP Player Cards"
          subtitle="Top sustain output by player. This replaces the per-target attribution overview until that data path is reliable."
          icon={<Heart className="w-4 h-4" />}
          accent="text-emerald-400"
        >
          {healingMvpRows.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {healingMvpRows.map((p, i) => (
                <div key={p.account} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-200">{p.account}</div>
                      <div className="mt-1"><ClassCell profession={p.profession} /></div>
                    </div>
                    <div className={`font-mono text-lg font-bold ${i < 3 ? "text-emerald-400" : "text-slate-300"}`}>
                      {fmtCompact(p.sustain)}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                    <div>
                      <div>Heal</div>
                      <div className="font-mono text-[12px] text-emerald-400">{fmtCompact(p.healing)}</div>
                    </div>
                    <div>
                      <div>Barrier</div>
                      <div className="font-mono text-[12px] text-teal-400">{fmtCompact(p.barrier)}</div>
                    </div>
                    <div>
                      <div>Downed</div>
                      <div className="font-mono text-[12px] text-lime-400">{fmtCompact(p.downedHealing)}</div>
                    </div>
                    <div>
                      <div>Life</div>
                      <div className="font-mono text-[12px] text-purple-400">{fmtCompact(p.lifeSiphon)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-5 text-center text-sm text-slate-500">
              No healing, barrier, downed healing, or life-siphon output was available in this report.
            </div>
          )}
        </Panel>
      )}

      {tab === "healing" && (
        <Panel title="Healing & Barrier" icon={<Heart className="w-4 h-4" />} accent="text-emerald-400" bodyClassName="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                  <th className="p-2.5">#</th>
                  <SortHeader label="Player" k="player" />
                  <SortHeader label="Class" k="class" />
                  <SortHeader label="Healing" k="healing" align="right" />
                  <SortHeader label="Squad Heal" k="squadHealing" align="right" />
                  <SortHeader label="Barrier" k="barrier" align="right" />
                  <SortHeader label="Downed Heal" k="downedHealing" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 font-mono">
                {healingRows.map((p, i) => (
                  <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                    <td className={`p-2.5 font-bold ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>{i + 1}</td>
                    <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                    <td className="p-2.5"><ClassCell profession={p.profession} /></td>
                    <td className="p-2.5 text-right text-emerald-400 font-bold">{perPlayer(pickAllyScopeValue(allyScope, p.healingTotals.healing, p.healingTotals.squadHealing), p.activeMs)}</td>
                    <td className="p-2.5 text-right text-emerald-400/70">{perPlayer(p.healingTotals.squadHealing ?? 0, p.activeMs)}</td>
                    <td className="p-2.5 text-right text-teal-400">{perPlayer(pickAllyScopeValue(allyScope, p.healingTotals.barrier, p.healingTotals.squadBarrier), p.activeMs)}</td>
                    <td className="p-2.5 text-right text-lime-400">{perPlayer(p.healingTotals.downedHealing ?? 0, p.activeMs)}</td>
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
                  <SortHeader label="Player" k="player" />
                  <SortHeader label="Class" k="class" />
                  <SortHeader label="Damage Taken" k="damageTaken" align="right" />
                  <SortHeader label="Power Dmg" k="powerDamage" align="right" />
                  <SortHeader label="Condi Dmg" k="condiDamage" align="right" />
                  <SortHeader label="Hits" k="hits" align="right" />
                  <SortHeader label="Barrier Absorbed" k="barrierAbsorbed" align="right" title="Damage absorbed by barrier" />
                  <SortHeader label="Mitigated Dmg" k="mitigatedDamage" align="right" title="Damage prevented by blocks, evades, misses, invulnerability, interrupts, and glancing hits" />
                  <SortHeader label="Blocks" k="blocks" align="right" title="Blocked incoming hits" />
                  <SortHeader label="Dodges" k="dodges" align="right" title="Number of dodges" />
                  <SortHeader label="Invulned" k="invulned" align="right" title="Number of times was invulnerable to damage" />
                  <SortHeader label="Interrupted" k="interrupted" align="right" title="Number of times interrupted" />
                  <SortHeader label="Downs" k="downs" align="right" />
                  <SortHeader label="Deaths" k="deaths" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 font-mono">
                {defenseRows.map((p, i) => {
                  const mitigation = (mitigationByAccount.get(`${p.account}::${p.profession}`) ?? mitigationByAccount.get(p.account))?.mitigationTotals;
                  return (
                    <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                      <td className={`p-2.5 font-bold ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>{i + 1}</td>
                      <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                      <td className="p-2.5"><ClassCell profession={p.profession} /></td>
                      <td className="p-2.5 text-right text-rose-400 font-bold">{fmtCompact(p.defenseTotals.damageTaken)}</td>
                      <td className="p-2.5 text-right text-orange-400">{fmtCompact(p.defenseTotals.powerDamageTaken)}</td>
                      <td className="p-2.5 text-right text-fuchsia-400">{fmtCompact(p.defenseTotals.conditionDamageTaken)}</td>
                      <td className="p-2.5 text-right text-slate-400">{fmtNum(p.defenseTotals.damageTakenCount)}</td>
                      <td className="p-2.5 text-right text-teal-400">{fmtCompact(p.defenseTotals.damageBarrier ?? 0)}</td>
                      <td className="p-2.5 text-right text-blue-400">{fmtCompact(mitigation?.totalMitigation ?? 0)}</td>
                      <td className="p-2.5 text-right text-indigo-400">{fmtNum(mitigation?.blocked ?? p.defenseTotals.blockedCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-cyan-400">{fmtNum(p.defenseTotals.dodgeCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-sky-400">{fmtNum(p.defenseTotals.invulnedCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-purple-400">{fmtNum(p.defenseTotals.interruptedCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-amber-400">{fmtNum(p.defenseTotals.downCount ?? 0)}</td>
                      <td className="p-2.5 text-right text-slate-300">{fmtNum(p.defenseTotals.deadCount ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
