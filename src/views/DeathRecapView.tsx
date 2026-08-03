import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { fmtCompact, profChip } from "../utils/format";
import type { DeathRecapEntry, DeathRecapHit } from "../types/report";
import { Skull, ArrowDown, Swords, ShieldAlert } from "lucide-react";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function HitRow({ hit, deathTime }: { hit: DeathRecapHit; deathTime: number }) {
  // Times in the recap are absolute fight-clock ms; show them relative to the
  // death itself (negative = seconds before dying) since that's what actually
  // answers "what happened right before I died".
  const relSec = ((hit.time - deathTime) / 1000).toFixed(1);
  return (
    <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
      {hit.icon ? (
        <img src={hit.icon} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded border border-slate-700/50 flex-shrink-0" loading="lazy" />
      ) : (
        <div className="w-6 h-6 rounded bg-slate-800/60 border border-slate-700/50 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-200 truncate">{hit.name}</span>
          {hit.isIndirect && (
            <span className="px-1 py-0 rounded text-[9px] font-bold border border-fuchsia-500/30 text-fuchsia-400">
              condi/proc
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 truncate">from {hit.src}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs font-bold text-rose-400 font-mono">{fmtCompact(hit.damage)}</div>
        <div className="text-[10px] text-slate-500 font-mono">{relSec}s</div>
      </div>
    </div>
  );
}

function DeathCard({ entry }: { entry: DeathRecapEntry }) {
  const [open, setOpen] = useState(false);
  const totalToKill = entry.toKill.reduce((a, h) => a + h.damage, 0);
  const totalToDown = entry.toDown.reduce((a, h) => a + h.damage, 0);
  const killingBlow = entry.toKill[entry.toKill.length - 1] ?? entry.toDown[entry.toDown.length - 1];

  return (
    <div className="bg-[#0a101f]/90 border border-slate-800/80 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
          <Skull className="w-4 h-4 text-rose-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-100">{entry.account}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(entry.profession)}`}>
              {entry.profession}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {entry.fightName} &middot; died at {fmtClock(entry.deathTimeMs)}
            {killingBlow && <> &middot; killed by <span className="text-slate-400">{killingBlow.name}</span></>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-bold text-rose-400 font-mono">{fmtCompact(totalToKill + totalToDown)}</div>
          <div className="text-[10px] text-slate-500">total damage</div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {entry.toDown.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 px-2">
                <ArrowDown className="w-3 h-3" /> To Downstate ({fmtCompact(totalToDown)})
              </div>
              <div className="divide-y divide-slate-800/40">
                {entry.toDown.map((h, i) => (
                  <HitRow key={i} hit={h} deathTime={entry.deathTimeMs} />
                ))}
              </div>
            </div>
          )}
          {entry.toKill.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1 px-2">
                <Swords className="w-3 h-3" /> To Deadstate ({fmtCompact(totalToKill)})
              </div>
              <div className="divide-y divide-slate-800/40">
                {entry.toKill.map((h, i) => (
                  <HitRow key={i} hit={h} deathTime={entry.deathTimeMs} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DEFENSIVE_BOON_NAMES = ["Stability", "Protection", "Resistance", "Aegis"];

// Correlates each player's death count against their aggregate defensive-boon
// uptime (already computed for the Buffs view) so a squad can spot "this
// person keeps dying and also runs low stability/protection uptime" at a
// glance. This is a correlation over averages, not a per-death timeline -
// arcdps/EI's export doesn't expose exact boon-on/boon-off timestamps, so we
// deliberately don't claim "this exact boon dropped right before this exact
// death". squadAvgPct lets each cell be judged against the rest of the squad
// rather than an arbitrary fixed threshold.
function useDeathBoonCorrelation(report: ReturnType<typeof useReport>["report"]) {
  return useMemo(() => {
    if (!report) return null;
    const recaps = report.stats.deathRecaps ?? [];
    if (recaps.length === 0) return null;
    const boonData = report.stats.buffCategoryUptimes?.["Boons"] ?? report.stats.boonUptimes;
    if (!boonData || boonData.columns.length === 0 || boonData.rows.length === 0) return null;

    const cols = boonData.columns.filter((c) =>
      DEFENSIVE_BOON_NAMES.some((b) => c.name.toLowerCase().includes(b.toLowerCase())),
    );
    if (cols.length === 0) return null;

    const deathsByAccount = new Map<string, number>();
    recaps.forEach((r) => deathsByAccount.set(r.account, (deathsByAccount.get(r.account) ?? 0) + 1));

    const squadAvg: Record<number, number> = {};
    cols.forEach((c) => {
      const vals = boonData.rows.map((r) => r.uptimes[c.id]).filter((v): v is number => v !== undefined);
      squadAvg[c.id] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });

    const rows = boonData.rows
      .map((r) => ({
        account: r.account,
        profession: r.profession,
        deaths: deathsByAccount.get(r.account) ?? 0,
        boons: cols.map((c) => {
          const pct = r.uptimes[c.id] ?? 0;
          return { id: c.id, name: c.name, icon: c.icon, pct, squadAvgPct: squadAvg[c.id], belowAvg: pct < squadAvg[c.id] - 10 };
        }),
      }))
      .filter((r) => r.deaths > 0)
      .sort((a, b) => b.deaths - a.deaths);

    return rows.length > 0 ? { rows, cols } : null;
  }, [report]);
}

function DeathBoonCorrelationPanel({ data }: { data: NonNullable<ReturnType<typeof useDeathBoonCorrelation>> }) {
  return (
    <Panel
      title="Boon Uptime vs. Deaths"
      subtitle="Each player's average defensive-boon uptime next to how many times they died - cells noticeably below the squad average are flagged. Correlation, not a per-death timeline."
      icon={<ShieldAlert className="w-3.5 h-3.5" />}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-amber-500/10 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left font-bold px-4 py-3 sticky left-0 bg-[#0a0e1f]/95">Player</th>
              <th className="text-center font-bold px-2 py-3">Deaths</th>
              {data.cols.map((c) => (
                <th key={c.id} className="text-center font-bold px-2 py-3 min-w-[64px]">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr
                key={row.account}
                className={`border-b border-slate-800/40 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}
              >
                <td className="px-4 py-2.5 font-semibold text-slate-200 sticky left-0 bg-[#0a0e1f]/95 whitespace-nowrap">
                  {row.account}
                </td>
                <td className="text-center px-2 py-2.5 font-mono font-bold text-rose-400">{row.deaths}</td>
                {row.boons.map((b) => (
                  <td key={b.id} className="text-center px-2 py-2.5 font-mono">
                    <span className={`font-bold ${b.belowAvg ? "text-rose-400" : "text-slate-300"}`} title={`Squad avg ${b.squadAvgPct.toFixed(0)}%`}>
                      {b.pct.toFixed(0)}%
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function DeathRecapView() {
  const { report } = useReport();
  const recaps = report?.stats.deathRecaps ?? [];
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const accounts = useMemo(() => {
    const set = new Set(recaps.map((r) => r.account));
    return Array.from(set).sort();
  }, [recaps]);

  const filtered = accountFilter === "all" ? recaps : recaps.filter((r) => r.account === accountFilter);
  const boonCorrelation = useDeathBoonCorrelation(report);

  if (!report) return null;

  if (recaps.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Death Recap"
          icon={<Skull className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No deaths recorded, or death-recap data isn&apos;t available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports - it shows the exact hits
                that put each squad member into downstate and, if it happened, the hits that finished them off.
              </p>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2"
        >
          <option value="all">All players ({recaps.length} deaths)</option>
          {accounts.map((a) => (
            <option key={a} value={a}>
              {a} ({recaps.filter((r) => r.account === a).length})
            </option>
          ))}
        </select>
      </div>

      {boonCorrelation && <DeathBoonCorrelationPanel data={boonCorrelation} />}

      <div className="space-y-3">
        {filtered.map((entry, i) => (
          <DeathCard key={`${entry.account}-${entry.fightIndex}-${entry.deathTimeMs}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}
