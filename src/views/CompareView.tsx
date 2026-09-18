import { useEffect, useMemo, useState } from "react";
import Panel from "../components/ui/Panel";
import { ArrowRight, GitCompare } from "lucide-react";
import { getArchivedById, type ArchiveEntry } from "../utils/reportArchive";
import { useCompare } from "../store/CompareContext";
import { useView } from "../store/ViewContext";
import { fmtCompact, fmtFixed, fmtNum } from "../utils/format";
import type { WvWReport } from "../types/report";
import "../Styles/CompareWorkspace.css";

interface CompareMetrics {
  entry: ArchiveEntry;
  totalHealing: number;
  totalBarrier: number;
  totalDownContrib: number;
  totalCleanses: number;
  totalStrips: number;
  winRatePct: number | null;
}

interface MetricRow {
  label: string;
  a: number;
  b: number;
  fmt: (v: number) => string;
  higherIsBetter: boolean;
}

function computeMetrics(entry: ArchiveEntry): CompareMetrics {
  const s = (entry.report as WvWReport).stats;
  const totalHealing = (s.healingPlayers ?? []).reduce((a, p) => a + (p.healingTotals?.healing ?? 0), 0);
  const totalBarrier = (s.healingPlayers ?? []).reduce((a, p) => a + (p.healingTotals?.barrier ?? 0), 0);
  const totalDownContrib = (s.offensePlayers ?? []).reduce((a, p) => a + (p.offenseTotals?.downContribution ?? 0), 0);
  const totalCleanses = (s.supportPlayers ?? []).reduce((a, p) => a + (p.supportTotals?.condiCleanse ?? 0), 0);
  const totalStrips = (s.supportPlayers ?? []).reduce((a, p) => a + (p.supportTotals?.boonStrips ?? 0), 0);
  const totalFights = entry.wins + entry.losses;
  const winRatePct = totalFights > 0 ? (entry.wins / totalFights) * 100 : null;
  return { entry, totalHealing, totalBarrier, totalDownContrib, totalCleanses, totalStrips, winRatePct };
}

export function ReportMetricTable({ rows, titleA, titleB }: { rows: MetricRow[]; titleA: string; titleB: string }) {
  return (
    <div className="compare-metrics overflow-x-auto custom-scrollbar">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-[10px] text-theme-muted uppercase font-bold tracking-wider border-b border-theme-border/50">
            <th scope="col" className="p-2.5">Metric</th>
            <th scope="col" className="p-2.5 text-right">{titleA}</th>
            <th scope="col" className="p-2.5 text-right">{titleB}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-theme-border/30 font-mono">
          {rows.map((r) => {
            const tied = r.a === r.b;
            const aWins = !tied && (r.higherIsBetter ? r.a > r.b : r.a < r.b);
            const bWins = !tied && !aWins;
            const maximum = Math.max(r.a, r.b, 1);
            return (
              <tr key={r.label} className="transition-colors hover:bg-theme-surface-elevated/60">
                <th scope="row" className="compare-metric-label p-2.5 text-theme-muted font-sans">{r.label}{tied && <span className="compare-tie">Equal</span>}</th>
                <td className={`p-2.5 text-right font-bold ${aWins ? "text-emerald-400" : "text-theme-text/80"}`}>
                  {r.fmt(r.a)}
                  <span className="compare-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, r.a / maximum) * 100}%` }} /></span>
                </td>
                <td className={`p-2.5 text-right font-bold ${bWins ? "text-emerald-400" : "text-theme-text/80"}`}>
                  {r.fmt(r.b)}
                  <span className="compare-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, r.b / maximum) * 100}%` }} /></span>
                </td>
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
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!compareIds) {
      setMetricsA(null);
      setMetricsB(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    Promise.all([getArchivedById(compareIds[0]), getArchivedById(compareIds[1])]).then(([a, b]) => {
      if (cancelled) return;
      setMetricsA(a ? computeMetrics(a) : null);
      setMetricsB(b ? computeMetrics(b) : null);
      setLoading(false);
      setLoadError(!a || !b);
    }).catch(() => {
      if (cancelled) return;
      setLoadError(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [compareIds]);

  const rows = useMemo<MetricRow[]>(() => {
    if (!metricsA || !metricsB) return [];
    const resultRows: MetricRow[] = metricsA.winRatePct != null && metricsB.winRatePct != null ? [
      { label: "Source-classified Wins", a: metricsA.entry.wins, b: metricsB.entry.wins, fmt: fmtNum, higherIsBetter: true },
      { label: "Source-classified Losses", a: metricsA.entry.losses, b: metricsB.entry.losses, fmt: fmtNum, higherIsBetter: false },
      { label: "Classified Win Rate", a: metricsA.winRatePct, b: metricsB.winRatePct, fmt: (v) => `${fmtFixed(v, 0)}%`, higherIsBetter: true },
    ] : [];
    return [
      { label: "Fights", a: metricsA.entry.fights, b: metricsB.entry.fights, fmt: fmtNum, higherIsBetter: true },
      { label: "Unclassified Outcomes", a: metricsA.entry.unclassified ?? Math.max(0, metricsA.entry.fights - metricsA.entry.wins - metricsA.entry.losses), b: metricsB.entry.unclassified ?? Math.max(0, metricsB.entry.fights - metricsB.entry.wins - metricsB.entry.losses), fmt: fmtNum, higherIsBetter: false },
      ...resultRows,
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
      <div className="compare-workspace space-y-5 animate-view pb-12">
        <Panel
          title="Compare Reports"
          icon={<GitCompare className="w-4 h-4" />}
          empty={
            <div className="py-10 text-center text-sm text-theme-muted">
              <GitCompare className="compare-empty-icon" aria-hidden="true" />
              <h3 className="compare-empty-title">Two sessions. One perspective.</h3>
              <p>No reports selected</p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setActiveView("archive")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-theme-accent/35 bg-theme-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-theme-accent-strong transition-all hover:bg-theme-accent/15"
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

  if (loadError) {
    return <div className="compare-workspace compare-unavailable" role="status">
      <GitCompare className="compare-empty-icon" aria-hidden="true" />
      <h2 className="compare-empty-title">Report unavailable</h2>
      <p>One of these reports could not be loaded from this device.</p>
      <button type="button" onClick={() => setActiveView("archive")}>Return to archive <ArrowRight size={16} /></button>
    </div>;
  }

  if (loading || !metricsA || !metricsB) {
    return <div className="flex items-center justify-center py-24 text-theme-muted text-sm">Loading comparison...</div>;
  }

  return (
    <div className="compare-workspace space-y-5 animate-view pb-12">
      <Panel
        title="Compare Reports"
        subtitle="Session totals. Differences in fight count, duration and squad size affect this comparison."
        icon={<GitCompare className="w-4 h-4" />}
        action={<button type="button" className="compare-change" onClick={() => setActiveView("archive")}><GitCompare size={16} /> Change reports</button>}
      >
        <div className="compare-identities grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-theme-border bg-theme-surface-inset/70 px-4 py-3 shadow-[inset_2px_0_0_color-mix(in_srgb,var(--theme-accent)_38%,transparent)]">
            <div className="text-[10px] uppercase tracking-wider text-theme-accent-strong font-bold">Report A</div>
            <div className="text-sm font-bold text-theme-text truncate">{metricsA.entry.title}</div>
            <div className="text-[10px] text-theme-muted">{metricsA.entry.dateLabel}</div>
          </div>
          <div className="rounded-xl border border-theme-border bg-theme-surface-inset/70 px-4 py-3 shadow-[inset_2px_0_0_color-mix(in_srgb,var(--theme-accent)_22%,transparent)]">
            <div className="text-[10px] uppercase tracking-wider text-theme-accent-strong font-bold">Report B</div>
            <div className="text-sm font-bold text-theme-text truncate">{metricsB.entry.title}</div>
            <div className="text-[10px] text-theme-muted">{metricsB.entry.dateLabel}</div>
            </div>
        </div>
        <ReportMetricTable rows={rows} titleA="Report A" titleB="Report B" />
      </Panel>
    </div>
  );
}
