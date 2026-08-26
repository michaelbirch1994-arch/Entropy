import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, Layers, Scale, Users } from "lucide-react";
import BoundedDataRegion from "../components/ui/BoundedDataRegion";
import ClassIcon from "../components/ui/ClassIcon";
import Panel from "../components/ui/Panel";
import { buildCompositionComparison } from "../lib/compositionInsights";
import { useReport } from "../store/ReportContext";
import { fmtNum } from "../utils/format";

export default function CompositionView() {
  const { report } = useReport();
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const squadData = report?.stats.squadClassData ?? [];
  const enemyData = report?.stats.enemyClassData ?? [];
  const comparisonRows = useMemo(() => buildCompositionComparison(squadData, enemyData), [enemyData, squadData]);

  if (!report) return null;

  const squadTotal = squadData.reduce((sum, row) => sum + row.value, 0);
  const enemyTotal = enemyData.reduce((sum, row) => sum + row.value, 0);
  const selected = comparisonRows.find((row) => row.name === selectedProfession) ?? comparisonRows[0] ?? null;
  const squadCore = [...comparisonRows].sort((a, b) => b.squadPct - a.squadPct).slice(0, 3);
  const enemyHeavy = comparisonRows.filter((row) => row.deltaPct >= 2).slice(0, 3);
  const squadHeavy = comparisonRows.filter((row) => row.deltaPct <= -2).slice(0, 3);

  return (
    <div className="space-y-5 animate-view pb-10">
      <section className="theme-role-coverage grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReadoutMetric icon={<Users className="h-4 w-4" />} label="Squad profiles" value={fmtNum(squadTotal)} detail="tracked roster" />
        <ReadoutMetric icon={<Eye className="h-4 w-4" />} label="Enemy observations" value={fmtNum(enemyTotal)} detail={`${report.stats.total} fights`} />
        <ReadoutMetric icon={<ArrowUpRight className="h-4 w-4" />} label="Enemy lean" value={enemyHeavy[0]?.name ?? "None"} detail={enemyHeavy[0] ? `${enemyHeavy[0].deltaPct.toFixed(1)} share pts` : "within 2 points"} tone="text-rose-300" />
        <ReadoutMetric icon={<ArrowDownLeft className="h-4 w-4" />} label="Squad lean" value={squadHeavy[0]?.name ?? "None"} detail={squadHeavy[0] ? `${Math.abs(squadHeavy[0].deltaPct).toFixed(1)} share pts` : "within 2 points"} tone="text-amber-300" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel
          title="Composition Comparison"
          subtitle="Shares are normalized within each side. Squad values are tracked roster profiles; enemy values are target observations accumulated across fights."
          icon={<Scale className="h-4 w-4" />}
          action={`${comparisonRows.length} professions`}
          bodyClassName="p-0"
        >
          <div className="hidden grid-cols-[minmax(7rem,1fr)_4.5rem_4.5rem_3.5rem] gap-2 border-b border-theme-border/50 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-theme-muted sm:grid lg:grid-cols-[minmax(8rem,1fr)_minmax(8rem,1.2fr)_minmax(8rem,1.2fr)_5.5rem] lg:gap-3">
            <span>Profession</span><span>Squad share</span><span>Enemy share</span><span className="text-right">Difference</span>
          </div>
          <BoundedDataRegion label={`Composition comparison, ${comparisonRows.length} professions`} itemCount={comparisonRows.length} maxHeightClass="max-h-[31rem]" className="divide-y divide-theme-border/30">
            {comparisonRows.map((row) => {
              const active = selected?.name === row.name;
              const deltaTone = row.deltaPct >= 2 ? "text-rose-300" : row.deltaPct <= -2 ? "text-amber-300" : "text-theme-muted";
              return (
                <button
                  key={row.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedProfession(row.name)}
                  className={`block w-full px-4 py-2.5 text-left transition-colors sm:grid sm:grid-cols-[minmax(7rem,1fr)_4.5rem_4.5rem_3.5rem] sm:items-center sm:gap-2 lg:grid-cols-[minmax(8rem,1fr)_minmax(8rem,1.2fr)_minmax(8rem,1.2fr)_5.5rem] lg:gap-3 ${active ? "bg-theme-accent/[0.07] shadow-[inset_2px_0_0_var(--theme-accent)]" : "hover:bg-theme-surface-elevated/55"}`}
                >
                  <span className="flex min-w-0 items-center justify-between gap-2 text-xs font-bold text-theme-text sm:justify-start">
                    <span className="flex min-w-0 items-center gap-2"><ClassIcon name={row.name} size="sm" /><span className="truncate">{row.name}</span></span>
                    <span className={`shrink-0 font-mono text-[10px] font-black sm:hidden ${deltaTone}`}>{mobileDifference(row.deltaPct)}</span>
                  </span>
                  <span className="mt-2 grid grid-cols-2 gap-4 sm:contents">
                    <ShareBar label="Squad" value={row.squadPct} count={row.squadCount} color={row.color} />
                    <ShareBar label="Enemy" value={row.enemyPct} count={row.enemyCount} color={row.color} />
                  </span>
                  <span className={`hidden text-right font-mono text-xs font-black sm:block ${deltaTone}`}>{row.deltaPct > 0 ? "+" : ""}{row.deltaPct.toFixed(1)}</span>
                </button>
              );
            })}
          </BoundedDataRegion>
        </Panel>

        <div className="space-y-5">
          <Panel title={selected?.name ?? "Profession Readout"} icon={<Layers className="h-4 w-4" />}>
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-theme-border/50 pb-4">
                  <div className="grid h-11 w-11 place-items-center overflow-visible"><ClassIcon name={selected.name} size="lg" /></div>
                  <div><div className="text-lg font-black uppercase text-theme-text">{selected.name}</div><div className="text-[10px] uppercase text-theme-muted">selected profession</div></div>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  <CompactValue label="Squad" value={`${selected.squadPct.toFixed(1)}%`} detail={`${selected.squadCount} profiles`} />
                  <CompactValue label="Enemy" value={`${selected.enemyPct.toFixed(1)}%`} detail={`${selected.enemyCount} observations`} />
                </div>
                <div className={`border-l-2 px-3 py-2 ${selected.deltaPct >= 2 ? "border-rose-400/50 bg-rose-500/[0.06]" : selected.deltaPct <= -2 ? "border-amber-400/50 bg-amber-500/[0.06]" : "border-theme-border bg-theme-surface-inset/50"}`}>
                  <div className="text-[10px] font-black uppercase text-theme-muted">Field read</div>
                  <div className="mt-1 text-sm font-bold text-theme-text">{compositionRead(selected.deltaPct)}</div>
                </div>
              </div>
            ) : <p className="text-xs text-theme-muted">No profession data is available.</p>}
          </Panel>

          <Panel title="Session Shape" icon={<Layers className="h-4 w-4" />}>
            <ReadoutGroup label="Squad core" rows={squadCore} mode="squad" />
            <ReadoutGroup label="Enemy-heavy" rows={enemyHeavy} mode="enemy" className="mt-4 border-t border-theme-border/50 pt-4" />
            <ReadoutGroup label="Squad-heavy" rows={squadHeavy} mode="squadDelta" className="mt-4 border-t border-theme-border/50 pt-4" />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function ShareBar({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  return <span className="flex items-center justify-between gap-2 sm:grid sm:grid-cols-1 lg:grid-cols-[1fr_4.5rem]"><span className="text-[9px] font-black uppercase text-theme-muted sm:hidden">{label}</span><span className="hidden h-2 bg-theme-surface-inset lg:block"><span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }} /></span><span className="whitespace-nowrap text-right font-mono text-[10px] text-theme-muted">{value.toFixed(1)}% · {fmtNum(count)}</span></span>;
}

function ReadoutMetric({ icon, label, value, detail, tone = "text-theme-accent-strong" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <div className="theme-dossier-metric flex min-h-20 items-center justify-between gap-3 border-l-2 border-theme-accent/30 bg-theme-surface-inset/55 px-4 py-3"><div className="min-w-0"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-theme-muted">{icon}{label}</div><div className={`mt-1 truncate text-lg font-black ${tone}`}>{value}</div></div><span className="max-w-24 text-right text-[9px] uppercase leading-4 text-theme-muted">{detail}</span></div>;
}

function CompactValue({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div><div className="text-[9px] font-black uppercase text-theme-muted">{label}</div><div className="mt-1 font-mono text-xl font-black text-theme-text">{value}</div><div className="text-[9px] text-theme-muted">{detail}</div></div>;
}

function compositionRead(deltaPct: number) {
  if (deltaPct >= 2) return `Enemy fielded this ${deltaPct.toFixed(1)} share points more often.`;
  if (deltaPct <= -2) return `Squad fielded this ${Math.abs(deltaPct).toFixed(1)} share points more often.`;
  return "Squad and enemy shares were broadly similar.";
}

function mobileDifference(deltaPct: number) {
  if (deltaPct >= 2) return `Enemy +${deltaPct.toFixed(1)}`;
  if (deltaPct <= -2) return `Squad +${Math.abs(deltaPct).toFixed(1)}`;
  return "Even";
}

function ReadoutGroup({ label, rows, mode, className = "" }: { label: string; rows: ReturnType<typeof buildCompositionComparison>; mode: "squad" | "enemy" | "squadDelta"; className?: string }) {
  return <div className={className}><div className="text-[9px] font-black uppercase tracking-wider text-theme-muted">{label}</div><div className="mt-2 space-y-2">{rows.length ? rows.map((row) => <div key={row.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 font-bold text-theme-text/85"><ClassIcon name={row.name} size="sm" /><span className="truncate">{row.name}</span></span><span className="font-mono text-[10px] text-theme-muted">{mode === "squad" ? `${row.squadPct.toFixed(1)}%` : mode === "enemy" ? `+${row.deltaPct.toFixed(1)} pts` : `${Math.abs(row.deltaPct).toFixed(1)} pts`}</span></div>) : <div className="text-xs text-theme-muted">No material difference.</div>}</div></div>;
}
