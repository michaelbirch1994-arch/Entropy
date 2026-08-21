import { useEffect, useMemo, useRef, useState } from "react";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";
import Panel from "../components/ui/Panel";
import BoundedDataRegion from "../components/ui/BoundedDataRegion";
import { fmtCompact, profChip } from "../utils/format";
import type { DeathRecapEntry, DeathRecapHit } from "../types/report";
import { Skull, ArrowDown, Swords, ShieldAlert, Film, BrainCircuit } from "lucide-react";
import {
  buildDeathBoonCorrelationRows,
  nextDeathBoonSort,
  sortDeathBoonRows,
  type DeathBoonSortKey,
  type DeathBoonSortState,
} from "../lib/deathRecapTable";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function HitRow({ hit, deathTime }: { hit: DeathRecapHit; deathTime: number }) {
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

function DeathCard({
  entry,
  focused = false,
  onViewIntelligence,
  onViewReplay,
  replayUnavailableReason,
}: {
  entry: DeathRecapEntry;
  focused?: boolean;
  onViewIntelligence?: () => void;
  onViewReplay?: () => void;
  replayUnavailableReason?: string;
}) {
  const [open, setOpen] = useState(focused);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const totalToKill = entry.toKill.reduce((a, h) => a + h.damage, 0);
  const totalToDown = entry.toDown.reduce((a, h) => a + h.damage, 0);
  const killingBlow = entry.toKill[entry.toKill.length - 1] ?? entry.toDown[entry.toDown.length - 1];

  useEffect(() => {
    if (!focused) return;
    setOpen(true);
    const frame = requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focused]);

  return (
    <div
      ref={cardRef}
      className={`bg-[#0a101f]/90 border rounded-2xl overflow-hidden transition-shadow ${
        focused
          ? "border-sky-400/45 shadow-[0_0_28px_-14px_rgba(56,189,248,0.75)]"
          : "border-slate-800/80"
      }`}
    >
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
            {focused && (
              <span className="rounded-full border border-sky-400/25 bg-sky-500/[0.08] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-200">
                Intelligence evidence
              </span>
            )}
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
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 ${onViewIntelligence || onViewReplay ? "border-violet-400/20 bg-violet-500/[0.05]" : "border-slate-700/60 bg-slate-900/40"}`}>
            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider ${onViewIntelligence || onViewReplay ? "text-violet-200" : "text-slate-500"}`}>Evidence workspace</div>
              <div className="mt-0.5 text-[10px] leading-4 text-slate-500">
                Intelligence keeps the exact {fmtClock(entry.deathTimeMs)} source moment and only selects nearby persisted evidence. {onViewReplay
                  ? "Replay can open the same timestamp with this player selected."
                  : replayUnavailableReason ?? "Exact Replay coverage is unavailable for this death."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {onViewIntelligence && (
                <button
                  type="button"
                  onClick={onViewIntelligence}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-400/25 bg-violet-500/[0.08] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-violet-200 transition-colors hover:border-violet-300/40 hover:bg-violet-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
                >
                  <BrainCircuit className="h-3.5 w-3.5" /> Inspect in Intelligence
                </button>
              )}
              {onViewReplay && (
                <button
                  type="button"
                  onClick={onViewReplay}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/[0.08] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-sky-200 transition-colors hover:border-sky-300/40 hover:bg-sky-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                >
                  <Film className="h-3.5 w-3.5" /> View in Replay
                </button>
              )}
            </div>
          </div>
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

    const rows = buildDeathBoonCorrelationRows(boonData.rows, cols, recaps);
    return rows.length > 0 ? { rows, cols } : null;
  }, [report]);
}

function DeathBoonCorrelationPanel({ data }: { data: NonNullable<ReturnType<typeof useDeathBoonCorrelation>> }) {
  const [sort, setSort] = useState<DeathBoonSortState>(null);
  const rows = useMemo(() => sortDeathBoonRows(data.rows, sort), [data.rows, sort]);

  const toggleSort = (key: DeathBoonSortKey) => {
    setSort((prev) => nextDeathBoonSort(prev, key));
  };

  const sortLabel = (key: DeathBoonSortKey) => (!sort || sort.key !== key ? "SORT" : sort.dir === "desc" ? "DESC" : "ASC");

  const sortButtonClass = (key: DeathBoonSortKey, extra = "") =>
    `inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
      sort?.key === key ? "text-rose-300" : "text-slate-500 hover:text-slate-300"
    } ${extra}`;

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
              <th className="text-left font-bold px-4 py-3 sticky left-0 bg-[#0a0e1f]/95">
                <button type="button" onClick={() => toggleSort("player")} className={sortButtonClass("player")}>
                  Player <span className="text-[8px] opacity-70">{sortLabel("player")}</span>
                </button>
              </th>
              <th className="text-center font-bold px-2 py-3">
                <button type="button" onClick={() => toggleSort("deaths")} className={sortButtonClass("deaths")}>
                  Deaths <span className="text-[8px] opacity-70">{sortLabel("deaths")}</span>
                </button>
              </th>
              {data.cols.map((c) => (
                <th key={c.id} className="text-center font-bold px-2 py-3 min-w-[64px]">
                  <button type="button" onClick={() => toggleSort(c.id)} className={sortButtonClass(c.id, "justify-center")}>
                    {c.name} <span className="text-[8px] opacity-70">{sortLabel(c.id)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.key}
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
  const { navigationTarget, navigateToView } = useView();
  const recaps = report?.stats.deathRecaps ?? [];
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const replayFightIds = useMemo(
    () => new Set((report?.stats.replayFights ?? []).map((entry) => entry.fightId)),
    [report],
  );

  const intelligenceTarget = navigationTarget?.targetView === "death-recap" && navigationTarget.source === "intelligence"
    ? navigationTarget
    : null;

  useEffect(() => {
    if (!intelligenceTarget?.account) return;
    setAccountFilter(intelligenceTarget.account);
  }, [intelligenceTarget?.account, intelligenceTarget?.timestampMs, intelligenceTarget?.fightIndex]);

  const accounts = useMemo(() => {
    const set = new Set(recaps.map((r) => r.account));
    return Array.from(set).sort();
  }, [recaps]);

  const filtered = accountFilter === "all" ? recaps : recaps.filter((r) => r.account === accountFilter);
  const boonCorrelation = useDeathBoonCorrelation(report);

  const isFocusedDeath = (entry: DeathRecapEntry) => !!intelligenceTarget
    && entry.account === intelligenceTarget.account
    && entry.fightIndex === intelligenceTarget.fightIndex
    && entry.deathTimeMs === intelligenceTarget.timestampMs;

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
        {intelligenceTarget && (
          <span className="rounded-full border border-sky-400/20 bg-sky-500/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-sky-200">
            Opened from Intelligence · Fight {(intelligenceTarget.fightIndex ?? 0) + 1} · {fmtClock(intelligenceTarget.timestampMs ?? 0)}
          </span>
        )}
      </div>

      {boonCorrelation && <DeathBoonCorrelationPanel data={boonCorrelation} />}

      <BoundedDataRegion
        label={`Death recap list, ${filtered.length} deaths`}
        itemCount={filtered.length}
        maxHeightClass={filtered.length > 6 ? "max-h-[46rem]" : "max-h-none"}
        className="space-y-3 pr-1"
      >
        {filtered.map((entry, i) => {
          const fightId = report.stats.fightBreakdown[entry.fightIndex]?.id;
          const replayAvailable = !!fightId && replayFightIds.has(fightId) && Number.isFinite(entry.deathTimeMs);
          return (
            <DeathCard
              key={`${entry.account}-${entry.fightIndex}-${entry.deathTimeMs}-${i}`}
              entry={entry}
              focused={isFocusedDeath(entry)}
              onViewIntelligence={fightId && Number.isFinite(entry.deathTimeMs) ? () => navigateToView("intelligence", {
                source: "other",
                fightId,
                fightIndex: entry.fightIndex,
                timestampMs: entry.deathTimeMs,
                account: entry.account,
                metric: "Death Recap",
              }) : undefined}
              onViewReplay={replayAvailable ? () => navigateToView("fight-replay", {
                source: "other",
                fightId,
                fightIndex: entry.fightIndex,
                timestampMs: entry.deathTimeMs,
                account: entry.account,
                metric: "Death Recap",
              }) : undefined}
              replayUnavailableReason={fightId
                ? "This fight has no persisted Replay position data; the hit breakdown remains authoritative."
                : "This report does not retain a stable fight identity for Replay navigation; the hit breakdown remains authoritative."}
            />
          );
        })}
      </BoundedDataRegion>
    </div>
  );
}
