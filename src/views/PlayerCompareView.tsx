import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, GitCompare, HeartPulse, Shield, Swords, Zap } from "lucide-react";
import Panel from "../components/ui/Panel";
import {
  buildPlayerDuelComparison,
  buildPlayerDuelOptions,
  type PlayerDuelComparison,
  type PlayerDuelMetric,
  type PlayerDuelSourceRow,
} from "../lib/playerDuelCompare";
import { useReport } from "../store/ReportContext";
import { fmtCompact, fmtDur, fmtFixed, fmtNum } from "../utils/format";

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
  return `${delta > 0 ? "+" : "-"}${formatted} - ${fmtFixed(pct, 0)}%`;
}

function PlayerSelect({ label, value, options, onChange, exclude }: { label: string; value: string; options: ReturnType<typeof buildPlayerDuelOptions>; onChange: (value: string) => void; exclude?: string }) {
  const availableOptions = options.filter((option) => option.account !== exclude);
  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-theme-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-theme-border bg-theme-surface-inset/80 px-3 py-2.5 text-xs font-bold text-theme-text outline-none transition-colors focus:border-theme-accent/55"
      >
        {!value && <option value="">Choose player</option>}
        {availableOptions.map((option) => (
          <option key={option.account} value={option.account}>
            {option.account} - {option.professions.join(", ") || "Unknown"} - {option.reports} report{option.reports === 1 ? "" : "s"}
          </option>
        ))}
      </select>
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

export default function PlayerCompareView() {
  const { report } = useReport();
  const options = useMemo(() => (report ? buildPlayerDuelOptions([report]) : []), [report]);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [category, setCategory] = useState<DuelCategory>("overall");

  useEffect(() => {
    setPlayerA((current) => current || options[0]?.account || "");
    setPlayerB((current) => current || options.find((option) => option.account !== options[0]?.account)?.account || "");
  }, [options]);

  const comparison = useMemo<PlayerDuelComparison | null>(() => {
    if (!report || !playerA || !playerB || playerA === playerB) return null;
    if (!options.some((option) => option.account === playerA) || !options.some((option) => option.account === playerB)) return null;
    return buildPlayerDuelComparison([report], playerA, playerB);
  }, [options, playerA, playerB, report]);

  const titleA = comparison?.a.account ?? "Player A";
  const titleB = comparison?.b.account ?? "Player B";
  const categoryMetrics = comparison?.metrics.filter((metric) => metric.category === category) ?? [];
  const headlineMetrics = comparison?.metrics.filter((metric) => ["damage", "healing", "strips", "cleanses", "deaths", "dodges"].includes(metric.key)).slice(0, 6) ?? [];

  if (!report) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel title="Player Compare" icon={<GitCompare className="w-4 h-4" />} empty={<div className="py-10 text-center text-sm text-theme-muted">Load a report first, then compare players from that night.</div>}>
          {null}
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Player Compare"
        subtitle="Current-night head-to-head across overall output, skills used, healing sources, mitigation, dodges, support, defense, and condition pressure."
        icon={<GitCompare className="w-4 h-4" />}
      >
        <div className="mb-4 rounded-xl border border-theme-accent/25 bg-theme-accent/10 px-4 py-3 text-xs text-theme-muted">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-accent-strong">Current loaded log</div>
          <div className="mt-1">
            Comparing players from <span className="font-bold text-theme-text">{report.meta.title}</span>
            {report.meta.dateLabel ? <span> - {report.meta.dateLabel}</span> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <PlayerSelect label="Player A" value={playerA} options={options} onChange={setPlayerA} exclude={playerB} />
            <PlayerSelect label="Player B" value={playerB} options={options} onChange={setPlayerB} exclude={playerA} />
            <div className="rounded-xl border border-theme-border/70 bg-theme-surface-inset/55 px-3 py-2 text-[10px] text-theme-muted">
              <div className="font-black uppercase tracking-[0.18em] text-theme-accent-strong">Scope</div>
              <div className="mt-1 leading-4">Loaded log only</div>
            </div>
          </div>

          {!comparison ? (
            <div className="rounded-xl border border-dashed border-theme-border p-8 text-center text-sm text-theme-muted">Pick two different players from the loaded report.</div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-2">
                {[comparison.a, comparison.b].map((profile, index) => (
                  <div key={profile.account} className="rounded-xl border border-theme-border bg-theme-surface-inset/70 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-accent-strong">Player {index === 0 ? "A" : "B"}</div>
                    <div className="mt-1 truncate text-lg font-black text-theme-text">{profile.account}</div>
                    <div className="mt-1 text-xs text-theme-muted">{profile.professions.join(", ") || "Unknown profession"} - {fmtDur(profile.combatTimeMs)} combat</div>
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
                      aria-pressed={category === item.key}
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
                  <DuelSourceTable title="Outgoing condition pressure" rows={comparison.breakdown.outgoingConditions} titleA={titleA} titleB={titleB} empty="No per-player outgoing condition detail was found in this report." />
                  <DuelSourceTable title="Incoming condition pressure" rows={comparison.breakdown.incomingConditions} titleA={titleA} titleB={titleB} empty="No per-player incoming condition detail was found in this report." />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{categoryMetrics.map((metric) => <DuelMetricCard key={metric.key} metric={metric} titleA={titleA} titleB={titleB} />)}</div>
              )}

              <div className="grid gap-3 xl:grid-cols-3">
                <DuelSourceTable title="Damage skills used" rows={comparison.breakdown.damageSkills} titleA={titleA} titleB={titleB} empty="No per-player damage skill breakdown exists in this report." />
                <DuelSourceTable title="Healing skills used" rows={comparison.breakdown.healingSkills} titleA={titleA} titleB={titleB} empty="No per-player healing skill breakdown exists in this report." />
                <DuelSourceTable title="Barrier skills used" rows={comparison.breakdown.barrierSkills} titleA={titleA} titleB={titleB} empty="No per-player barrier skill breakdown exists in this report." />
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
