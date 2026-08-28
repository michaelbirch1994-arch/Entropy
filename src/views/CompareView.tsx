import { useEffect, useMemo, useState } from "react";
import Panel from "../components/ui/Panel";
import { Activity, ArrowRight, BarChart3, GitCompare, HeartPulse, Search, Shield, Swords, Zap } from "lucide-react";
import { getArchivedById, type ArchiveEntry } from "../utils/reportArchive";
import { useCompare } from "../store/CompareContext";
import { useView } from "../store/ViewContext";
import { fmtCompact, fmtDur, fmtFixed, fmtNum } from "../utils/format";
import type { WvWReport } from "../types/report";
import {
  buildPlayerDuelComparison,
  buildPlayerDuelOptions,
  type PlayerDuelComparison,
  type PlayerDuelMetric,
  type PlayerDuelSourceRow,
} from "../lib/playerDuelCompare";

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

type CompareMode = "reports" | "players";
type DuelCategory = PlayerDuelMetric["category"];

const DUEL_CATEGORIES: Array<{ key: DuelCategory; label: string; icon: typeof Swords }> = [
  { key: "overall", label: "Overall", icon: Activity },
  { key: "offense", label: "Offense", icon: Swords },
  { key: "support", label: "Support", icon: Zap },
  { key: "healing", label: "Healing", icon: HeartPulse },
  { key: "defense", label: "Defense", icon: Shield },
  { key: "mitigation", label: "Mitigation", icon: Shield },
  { key: "movement", label: "Movement", icon: Activity },
  { key: "conditions", label: "Conditions", icon: BarChart3 },
];

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

function formatDuelValue(metric: PlayerDuelMetric, value: number) {
  if (metric.format === "duration") return fmtDur(value);
  if (metric.format === "percent") return `${fmtFixed(value, 0)}%`;
  if (metric.format === "number") return fmtNum(value);
  return fmtCompact(value);
}

function winner(metric: PlayerDuelMetric): "a" | "b" | "tie" | "neutral" {
  if (metric.direction === "neutral") return "neutral";
  if (metric.a === metric.b) return "tie";
  if (metric.direction === "higher") return metric.a > metric.b ? "a" : "b";
  return metric.a < metric.b ? "a" : "b";
}

function deltaText(metric: PlayerDuelMetric) {
  const delta = metric.a - metric.b;
  const abs = Math.abs(delta);
  if (metric.a === metric.b) return "Even";
  const base = Math.max(Math.abs(metric.a), Math.abs(metric.b), 1);
  const pct = (abs / base) * 100;
  const formatted = metric.format === "duration" ? fmtDur(abs) : metric.format === "percent" ? `${fmtFixed(abs, 0)} pts` : metric.format === "number" ? fmtNum(abs) : fmtCompact(abs);
  return `${delta > 0 ? "+" : "-"}${formatted} · ${fmtFixed(pct, 0)}%`;
}

function ReportMetricTable({ rows, titleA, titleB }: { rows: MetricRow[]; titleA: string; titleB: string }) {
  return (
    <div className="overflow-x-auto custom-scrollbar rounded-xl border border-theme-border/70 bg-theme-surface-inset/55">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-[10px] text-theme-muted uppercase font-bold tracking-wider border-b border-theme-border/50">
            <th className="p-2.5">Metric</th>
            <th className="p-2.5 text-right">{titleA}</th>
            <th className="p-2.5 text-right">{titleB}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-theme-border/30 font-mono">
          {rows.map((r) => {
            const aWins = r.higherIsBetter ? r.a >= r.b : r.a <= r.b;
            return (
              <tr key={r.label} className="transition-colors hover:bg-theme-surface-elevated/60">
                <td className="p-2.5 text-theme-muted font-sans">{r.label}</td>
                <td className={`p-2.5 text-right font-bold ${aWins ? "text-emerald-400" : "text-theme-text/80"}`}>{r.fmt(r.a)}</td>
                <td className={`p-2.5 text-right font-bold ${!aWins ? "text-emerald-400" : "text-theme-text/80"}`}>{r.fmt(r.b)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerSelect({ label, value, options, onChange, exclude }: { label: string; value: string; options: ReturnType<typeof buildPlayerDuelOptions>; onChange: (value: string) => void; exclude?: string }) {
  const listId = `${label.toLowerCase().replace(/\W+/g, "-")}-players`;
  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-theme-muted">{label}</span>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-theme-muted" />
        <input
          list={listId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search account"
          className="w-full rounded-xl border border-theme-border bg-theme-surface-inset/80 px-9 py-2.5 text-xs font-bold text-theme-text outline-none transition-colors focus:border-theme-accent/55"
        />
      </span>
      <datalist id={listId}>
        {options.filter((option) => option.account !== exclude).map((option) => (
          <option key={option.account} value={option.account}>{option.professions.join(", ") || "Unknown"} · {option.reports} report{option.reports === 1 ? "" : "s"}</option>
        ))}
      </datalist>
    </label>
  );
}

function DuelMetricCard({ metric, titleA, titleB }: { metric: PlayerDuelMetric; titleA: string; titleB: string }) {
  const result = winner(metric);
  const max = Math.max(Math.abs(metric.a), Math.abs(metric.b), 1);
  const aWidth = Math.max(3, (Math.abs(metric.a) / max) * 100);
  const bWidth = Math.max(3, (Math.abs(metric.b) / max) * 100);
  const aClass = result === "a" ? "text-emerald-300" : result === "b" ? "text-rose-300" : "text-theme-text";
  const bClass = result === "b" ? "text-emerald-300" : result === "a" ? "text-rose-300" : "text-theme-text";
  return (
    <div className="rounded-xl border border-theme-border/70 bg-theme-surface-inset/65 p-3 shadow-[inset_2px_0_0_color-mix(in_srgb,var(--theme-accent)_30%,transparent)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black text-theme-text">{metric.label}</div>
          {metric.note && <div className="mt-1 text-[10px] leading-4 text-theme-muted">{metric.note}</div>}
        </div>
        <div className="rounded-full border border-theme-border/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-theme-muted">{deltaText(metric)}</div>
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="mb-1 flex justify-between gap-3 text-[10px]"><span className="truncate text-theme-muted">{titleA}</span><span className={`font-mono font-bold ${aClass}`}>{formatDuelValue(metric, metric.a)}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-theme-surface"><div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${aWidth}%`, opacity: result === "b" ? 0.42 : 1 }} /></div>
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-3 text-[10px]"><span className="truncate text-theme-muted">{titleB}</span><span className={`font-mono font-bold ${bClass}`}>{formatDuelValue(metric, metric.b)}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-theme-surface"><div className="h-full rounded-full bg-sky-400/80" style={{ width: `${bWidth}%`, opacity: result === "a" ? 0.42 : 1 }} /></div>
        </div>
      </div>
    </div>
  );
}

function DuelSourceTable({ title, rows, titleA, titleB, empty }: { title: string; rows: PlayerDuelSourceRow[]; titleA: string; titleB: string; empty: string }) {
  return (
    <div className="rounded-xl border border-theme-border/70 bg-theme-surface-inset/55">
      <div className="border-b border-theme-border/50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-muted">{title}</div>
      {rows.length ? (
        <div className="max-h-80 overflow-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-theme-surface-inset text-[9px] uppercase tracking-wider text-theme-muted">
              <tr>
                <th className="p-2">Source</th>
                <th className="p-2 text-right">{titleA}</th>
                <th className="p-2 text-right">{titleB}</th>
                <th className="p-2 text-right">Edge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border/30">
              {rows.slice(0, 16).map((row) => {
                const aWins = row.a >= row.b;
                const edge = Math.abs(row.a - row.b);
                return (
                  <tr key={row.key} className="hover:bg-theme-surface-elevated/45">
                    <td className="p-2">
                      <span className="flex min-w-0 items-center gap-2">
                        {row.icon && <img src={row.icon} alt="" className="h-5 w-5 rounded-sm object-cover" loading="lazy" />}
                        <span className="truncate text-theme-text">{row.name}</span>
                      </span>
                    </td>
                    <td className={`p-2 text-right font-mono font-bold ${aWins ? "text-emerald-300" : "text-rose-300"}`}>{fmtCompact(row.a)}{row.aHits > 0 && <span className="ml-1 text-[9px] text-theme-muted">{fmtNum(row.aHits)} hits</span>}</td>
                    <td className={`p-2 text-right font-mono font-bold ${!aWins ? "text-emerald-300" : "text-rose-300"}`}>{fmtCompact(row.b)}{row.bHits > 0 && <span className="ml-1 text-[9px] text-theme-muted">{fmtNum(row.bHits)} hits</span>}</td>
                    <td className="p-2 text-right font-mono text-theme-muted">{fmtCompact(edge)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 text-xs text-theme-muted">{empty}</div>
      )}
    </div>
  );
}

function PlayerDuelView({ entries }: { entries: [CompareMetrics, CompareMetrics] }) {
  const reports = useMemo(() => entries.map((entry) => entry.entry.report as WvWReport), [entries]);
  const options = useMemo(() => buildPlayerDuelOptions(reports), [reports]);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [category, setCategory] = useState<DuelCategory>("overall");

  useEffect(() => {
    setPlayerA((current) => current || options[0]?.account || "");
    setPlayerB((current) => current || options.find((option) => option.account !== options[0]?.account)?.account || "");
  }, [options]);

  const comparison = useMemo<PlayerDuelComparison | null>(() => {
    if (!playerA || !playerB || playerA === playerB) return null;
    if (!options.some((option) => option.account === playerA) || !options.some((option) => option.account === playerB)) return null;
    return buildPlayerDuelComparison(reports, playerA, playerB);
  }, [options, playerA, playerB, reports]);

  const titleA = comparison?.a.account ?? "Player A";
  const titleB = comparison?.b.account ?? "Player B";
  const categoryMetrics = comparison?.metrics.filter((metric) => metric.category === category) ?? [];
  const headlineMetrics = comparison?.metrics.filter((metric) => ["damage", "healing", "strips", "cleanses", "deaths", "dodges"].includes(metric.key)).slice(0, 6) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <PlayerSelect label="Player A" value={playerA} options={options} onChange={setPlayerA} exclude={playerB} />
        <PlayerSelect label="Player B" value={playerB} options={options} onChange={setPlayerB} exclude={playerA} />
        <div className="rounded-xl border border-theme-border/70 bg-theme-surface-inset/55 px-3 py-2 text-[10px] text-theme-muted">
          <div className="font-black uppercase tracking-[0.18em] text-theme-accent-strong">Scope</div>
          <div className="mt-1 leading-4">Selected archive reports: {entries.map((entry) => entry.entry.title).join(" + ")}</div>
        </div>
      </div>

      {!comparison ? (
        <div className="rounded-xl border border-dashed border-theme-border p-8 text-center text-sm text-theme-muted">Pick two different players from the selected reports.</div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {[comparison.a, comparison.b].map((profile, index) => (
              <div key={profile.account} className="rounded-xl border border-theme-border bg-theme-surface-inset/70 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-accent-strong">Player {index === 0 ? "A" : "B"}</div>
                <div className="mt-1 truncate text-lg font-black text-theme-text">{profile.account}</div>
                <div className="mt-1 text-xs text-theme-muted">{profile.professions.join(", ") || "Unknown profession"} · {profile.reportsPresent} report{profile.reportsPresent === 1 ? "" : "s"} · {fmtDur(profile.combatTimeMs)} combat</div>
              </div>
            ))}
          </div>

          {headlineMetrics.length > 0 && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{headlineMetrics.map((metric) => <DuelMetricCard key={metric.key} metric={metric} titleA={titleA} titleB={titleB} />)}</div>}

          <div className="flex flex-wrap gap-2">
            {DUEL_CATEGORIES.map((item) => {
              const Icon = item.icon;
              const count = comparison.metrics.filter((metric) => metric.category === item.key).length;
              if (count === 0 && item.key !== "conditions") return null;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCategory(item.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${category === item.key ? "border-theme-accent/55 bg-theme-accent/12 text-theme-accent-strong" : "border-theme-border bg-theme-surface-inset/60 text-theme-muted hover:border-theme-accent/30"}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {item.label} <span className="font-mono">{count}</span>
                </button>
              );
            })}
          </div>

          {category === "conditions" ? (
            <div className="grid gap-3 xl:grid-cols-2">
              <DuelSourceTable title="Outgoing condition pressure" rows={comparison.breakdown.outgoingConditions} titleA={titleA} titleB={titleB} empty="No per-player outgoing condition detail was found in these reports." />
              <DuelSourceTable title="Incoming condition pressure" rows={comparison.breakdown.incomingConditions} titleA={titleA} titleB={titleB} empty="No per-player incoming condition detail was found in these reports." />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{categoryMetrics.map((metric) => <DuelMetricCard key={metric.key} metric={metric} titleA={titleA} titleB={titleB} />)}</div>
          )}

          <div className="grid gap-3 xl:grid-cols-3">
            <DuelSourceTable title="Damage skills used" rows={comparison.breakdown.damageSkills} titleA={titleA} titleB={titleB} empty="No per-player damage skill breakdown exists in these reports." />
            <DuelSourceTable title="Healing skills used" rows={comparison.breakdown.healingSkills} titleA={titleA} titleB={titleB} empty="No per-player healing skill breakdown exists in these reports." />
            <DuelSourceTable title="Barrier skills used" rows={comparison.breakdown.barrierSkills} titleA={titleA} titleB={titleB} empty="No per-player barrier skill breakdown exists in these reports." />
          </div>
        </>
      )}
    </div>
  );
}

export default function CompareView() {
  const { compareIds } = useCompare();
  const { setActiveView } = useView();
  const [mode, setMode] = useState<CompareMode>("reports");
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
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Compare Reports"
          icon={<GitCompare className="w-4 h-4" />}
          empty={
            <div className="py-10 text-center text-sm text-theme-muted">
              Pick two reports from the Archive to compare reports or run a Player vs Player night audit.
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

  if (loading || !metricsA || !metricsB) {
    return <div className="flex items-center justify-center py-24 text-theme-muted text-sm">Loading comparison...</div>;
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title={mode === "players" ? "Player vs Player" : "Compare Reports"}
        subtitle={mode === "players" ? "Full-session head-to-head across overall output, skills used, healing sources, mitigation, dodges, support, defense, and condition pressure." : "Squad-wide totals side by side - green highlights the better value per row, which still needs fight context."}
        icon={<GitCompare className="w-4 h-4" />}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {(["reports", "players"] as CompareMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${mode === item ? "border-theme-accent/55 bg-theme-accent/12 text-theme-accent-strong" : "border-theme-border bg-theme-surface-inset/70 text-theme-muted hover:border-theme-accent/30"}`}
            >
              {item === "reports" ? "Report vs Report" : "Player vs Player"}
            </button>
          ))}
        </div>

        {mode === "players" ? (
          <PlayerDuelView entries={[metricsA, metricsB]} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
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
          </>
        )}
      </Panel>
    </div>
  );
}
