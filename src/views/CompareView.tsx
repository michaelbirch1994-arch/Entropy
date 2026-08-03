import { useEffect, useMemo, useState } from "react";
import Panel from "../components/ui/Panel";
import { GitCompare, ArrowRight } from "lucide-react";
import { getArchivedById, type ArchiveEntry } from "../utils/reportArchive";
import { useCompare } from "../store/CompareContext";
import { useView } from "../store/ViewContext";
import { fmtCompact, fmtNum, fmtFixed } from "../utils/format";
import type { WvWReport } from "../types/report";

interface CompareMetrics {
  entry: ArchiveEntry;
  totalHealing: number;
  totalBarrier: number;
  totalDownContrib: number;
  totalCleanses: number;
  totalStrips: number;
  winRatePct: number;
}

function computeMetrics(entry: ArchiveEntry): CompareMetrics {
  const s = (entry.report as WvWReport).stats;
  const totalHealing = (s.healingPlayers ?? []).reduce((a, p) => a + (p.healingTotals?.healing ?? 0), 0);
  const totalBarrier = (s.healingPlayers ?? []).reduce((a, p) => a + (p.healingTotals?.barrier ?? 0), 0);
  const totalDownContrib = (s.offensePlayers ?? []).reduce((a, p) => a + (p.offenseTotals?.downContribution ?? 0), 0);
  const totalCleanses = (s.supportPlayers ?? []).reduce((a, p) => a + (p.supportTotals?.condiCleanse ?? 0), 0);
  const totalStrips = (s.supportPlayers ?? []).reduce((a, p) => a + (p.supportTotals?.boonStrips ?? 0), 0);
  const totalFights = entry.wins + entry.losses;
  const winRatePct = totalFights > 0 ? (entry.wins / totalFights) * 100 : 0;
  return { entry, totalHealing, totalBarrier, totalDownContrib, totalCleanses, totalStrips, winRatePct };
}

interface MetricRow {
  label: string;
  a: number;
  b: number;
  fmt: (v: number) => string;
  // Whether a higher number is the "better" outcome for this metric - used
  // only to color which side's cell is highlighted, not a value judgment on
  // the raid itself (e.g. a lopsided kill count might mean an easy fight,
  // not a better-played one).
  higherIsBetter: boolean;
}

function MetricTable({ rows, titleA, titleB }: { rows: MetricRow[]; titleA: string; titleB: string }) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
            <th className="p-2.5">Metric</th>
            <th className="p-2.5 text-right">{titleA}</th>
            <th className="p-2.5 text-right">{titleB}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/30 font-mono">
          {rows.map((r) => {
            const aWins = r.higherIsBetter ? r.a >= r.b : r.a <= r.b;
            return (
              <tr key={r.label} className="hover:bg-blue-950/20 transition-colors">
                <td className="p-2.5 text-slate-400 font-sans">{r.label}</td>
                <td className={`p-2.5 text-right font-bold ${aWins ? "text-emerald-400" : "text-slate-300"}`}>{r.fmt(r.a)}</td>
                <td className={`p-2.5 text-right font-bold ${!aWins ? "text-emerald-400" : "text-slate-300"}`}>{r.fmt(r.b)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CompareView() {
  const { compareIds } = useCompare();
  const { setActiveView } = useView();
  const [metricsA, setMetricsA] = useState<CompareMetrics | null>(null);
  const [metricsB, setMetricsB] = useState<CompareMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!compareIds) {
      setMetricsA(null);
      setMetricsB(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getArchivedById(compareIds[0]), getArchivedById(compareIds[1])]).then(([a, b]) => {
      if (cancelled) return;
      setMetricsA(a ? computeMetrics(a) : null);
      setMetricsB(b ? computeMetrics(b) : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [compareIds]);

  const rows = useMemo<MetricRow[]>(() => {
    if (!metricsA || !metricsB) return [];
    return [
      { label: "Fights", a: metricsA.entry.fights, b: metricsB.entry.fights, fmt: fmtNum, higherIsBetter: true },
      { label: "Wins", a: metricsA.entry.wins, b: metricsB.entry.wins, fmt: fmtNum, higherIsBetter: true },
      { label: "Losses", a: metricsA.entry.losses, b: metricsB.entry.losses, fmt: fmtNum, higherIsBetter: false },
      { label: "Win Rate", a: metricsA.winRatePct, b: metricsB.winRatePct, fmt: (v) => `${fmtFixed(v, 0)}%`, higherIsBetter: true },
      { label: "Avg Squad Size", a: metricsA.entry.avgSquadSize, b: metricsB.entry.avgSquadSize, fmt: (v) => fmtFixed(v, 1), higherIsBetter: true },
      { label: "Squad Damage", a: metricsA.entry.totalDamage, b: metricsB.entry.totalDamage, fmt: fmtCompact, higherIsBetter: true },
      { label: "Squad Healing", a: metricsA.totalHealing, b: metricsB.totalHealing, fmt: fmtCompact, higherIsBetter: true },
      { label: "Squad Barrier", a: metricsA.totalBarrier, b: metricsB.totalBarrier, fmt: fmtCompact, higherIsBetter: true },
      { label: "Down Contribution", a: metricsA.totalDownContrib, b: metricsB.totalDownContrib, fmt: fmtCompact, higherIsBetter: true },
      { label: "Condi Cleanses", a: metricsA.totalCleanses, b: metricsB.totalCleanses, fmt: fmtNum, higherIsBetter: true },
      { label: "Boon Strips", a: metricsA.totalStrips, b: metricsB.totalStrips, fmt: fmtNum, higherIsBetter: true },
    ];
  }, [metricsA, metricsB]);

  if (!compareIds) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Compare Reports"
          icon={<GitCompare className="w-4 h-4" />}
          accent="text-sky-400"
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              Pick two reports from the Archive to compare them side by side.
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setActiveView("archive")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-sky-500/20 transition-all"
                >
                  Go to Report Archive <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  if (loading || !metricsA || !metricsB) {
    return <div className="flex items-center justify-center py-24 text-slate-500 text-sm">Loading comparison...</div>;
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Compare Reports"
        subtitle="Squad-wide totals side by side - green highlights the higher value per row, which isn't always the 'better played' side (an easy fight can inflate several of these just as much as good play does)"
        icon={<GitCompare className="w-4 h-4" />}
        accent="text-sky-400"
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-amber-400/70 font-bold">Report A</div>
            <div className="text-sm font-bold text-slate-100 truncate">{metricsA.entry.title}</div>
            <div className="text-[10px] text-slate-500">{metricsA.entry.dateLabel}</div>
          </div>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-sky-400/70 font-bold">Report B</div>
            <div className="text-sm font-bold text-slate-100 truncate">{metricsB.entry.title}</div>
            <div className="text-[10px] text-slate-500">{metricsB.entry.dateLabel}</div>
          </div>
        </div>
        <MetricTable rows={rows} titleA="Report A" titleB="Report B" />
      </Panel>
    </div>
  );
}
