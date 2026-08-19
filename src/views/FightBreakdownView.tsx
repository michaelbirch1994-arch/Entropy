import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";
import Panel from "../components/ui/Panel";
import { fmtCompact } from "../utils/format";
import { Activity, BrainCircuit, ExternalLink, GitCompare, Swords, Target } from "lucide-react";
import type { FightRow } from "../types/report";
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from "../utils/chartTheme";

type SortKey =
  | "fight"
  | "map"
  | "duration"
  | "outcome"
  | "squad"
  | "enemies"
  | "kills"
  | "deaths"
  | "outDamage"
  | "inDamage"
  | "strips"
  | "healing"
  | "sustain";
type SortState = { key: SortKey; dir: "desc" | "asc" } | null;
type OutcomeFilter = "all" | "wins" | "losses";

function parseDurationSeconds(duration: string) {
  const min = Number(duration.match(/(\d+)m/)?.[1] ?? 0);
  const sec = Number(duration.match(/(\d+)s/)?.[1] ?? 0);
  return min * 60 + sec;
}

function compareValues(a: string | number | boolean, b: string | number | boolean, dir: "desc" | "asc") {
  const direction = dir === "desc" ? -1 : 1;
  if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b)) * direction;
  return (Number(a) - Number(b)) * direction;
}

export default function FightBreakdownView() {
  const { report } = useReport();
  const { setActiveView } = useView();
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<SortState>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [selectedFightId, setSelectedFightId] = useState<string | null>(null);
  const [comparisonFightId, setComparisonFightId] = useState<string | null>(null);
  const s = report?.stats;
  const fights = s?.fightBreakdown ?? [];
  const sortedFights = useMemo(() => {
    const base = fights
      .map((fight, index) => ({ fight, index }))
      .filter(({ fight }) => outcomeFilter === "all" || (outcomeFilter === "wins" ? fight.isWin : !fight.isWin));
    if (!sort) return base;
    const valueFor = (row: { fight: FightRow; index: number }) => {
      const f = row.fight;
      switch (sort.key) {
        case "fight": return row.index + 1;
        case "map": return f.mapName;
        case "duration": return parseDurationSeconds(f.duration);
        case "outcome": return f.isWin;
        case "squad": return f.squadCount;
        case "enemies": return f.enemyCount;
        case "kills": return f.enemyDeaths;
        case "deaths": return f.alliesDead;
        case "outDamage": return f.totalOutgoingDamage;
        case "inDamage": return f.totalIncomingDamage;
        case "strips": return f.totalOutgoingStrips;
        case "healing": return f.totalOutgoingHealing ?? 0;
        case "sustain": return f.effectiveHealing ?? 0;
        default: return row.index;
      }
    };
    return [...base].sort((a, b) => compareValues(valueFor(a), valueFor(b), sort.dir) || a.index - b.index);
  }, [fights, outcomeFilter, sort]);
  const shown = showAll ? sortedFights : sortedFights.slice(0, 12);
  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "desc" };
      if (current.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };
  const SortHeader = ({ k, children, className = "" }: { k: SortKey; children: ReactNode; className?: string }) => {
    const active = sort?.key === k;
    const glyph = active ? (sort.dir === "desc" ? "▼" : "▲") : "↕";
    return (
      <th className={`p-2.5 font-medium ${className}`}>
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-slate-200 transition-colors">
          {children}
          <span className="text-[8px] opacity-70">{glyph}</span>
        </button>
      </th>
    );
  };

  const hasHealingData = fights.some((f) => f.totalOutgoingHealing !== undefined);
  const hasSustainData = fights.some((f) => f.effectiveHealing !== undefined);

  // Recharts data for the damage/sustain chart and the KDR trend line, built
  // from whatever's currently shown (respects the outcome filter and the
  // show-all toggle) so the chart never contradicts the table beneath it.
  const chartData = useMemo(
    () =>
      shown.map(({ fight: f, index }) => ({
        id: f.id,
        label: f.label,
        fightNo: index + 1,
        isWin: f.isWin,
        outDamage: f.totalOutgoingDamage,
        inDamage: f.totalIncomingDamage,
        healing: f.totalOutgoingHealing ?? 0,
        kdr: f.alliesDead > 0 ? f.enemyDeaths / f.alliesDead : f.enemyDeaths,
      })),
    [shown],
  );

  if (!s) return null;
  const selectedRow = fights.map((fight, index) => ({ fight, index })).find(({ fight }) => fight.id === selectedFightId) ?? null;
  const comparisonRow = fights.map((fight, index) => ({ fight, index })).find(({ fight }) => fight.id === comparisonFightId) ?? null;
  const openFightIn = (view: "squad-stats" | "intelligence") => {
    if (selectedRow) {
      localStorage.setItem("entropy.selectedFightIndex", String(selectedRow.index));
      localStorage.setItem("entropy.selectedFightId", selectedRow.fight.id);
    }
    setActiveView(view);
  };
  const pressureRatio = (fight: FightRow) => fight.totalIncomingDamage > 0 ? fight.totalOutgoingDamage / fight.totalIncomingDamage : 0;
  const kdr = (fight: FightRow) => fight.alliesDead > 0 ? fight.enemyDeaths / fight.alliesDead : fight.enemyDeaths;

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Fight Breakdown"
        icon={<Swords className="w-4 h-4" />}
        accent="text-blue-500"
        action={<span>{fights.length} FIGHTS</span>}
        bodyClassName="p-0"
      >
        <div className="theme-fight-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-theme-border/50 px-4 py-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter fights by outcome">
            {(["all", "wins", "losses"] as OutcomeFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={outcomeFilter === filter}
                onClick={() => setOutcomeFilter(filter)}
                className={`theme-filter-chip border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${outcomeFilter === filter ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-theme-border text-theme-muted"}`}
              >
                {filter}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Select a row to inspect · mark another to compare</span>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/40">
                <SortHeader k="fight">#</SortHeader>
                <th className="p-2.5 font-medium">Fight</th>
                <th className="p-2.5 font-medium">Compare</th>
                <SortHeader k="map">Map</SortHeader>
                <SortHeader k="duration">Duration</SortHeader>
                <SortHeader k="outcome">Outcome</SortHeader>
                <SortHeader k="squad" className="text-right">Squad</SortHeader>
                <SortHeader k="enemies" className="text-right">Enemies</SortHeader>
                <SortHeader k="kills" className="text-right">Kills</SortHeader>
                <SortHeader k="deaths" className="text-right">Deaths</SortHeader>
                <SortHeader k="outDamage" className="text-right">Out Dmg</SortHeader>
                <SortHeader k="inDamage" className="text-right">In Dmg</SortHeader>
                <SortHeader k="strips" className="text-right">Strips</SortHeader>
                {hasHealingData && <SortHeader k="healing" className="text-right">Healing</SortHeader>}
                {hasSustainData && <SortHeader k="sustain" className="text-right">Sustain</SortHeader>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {shown.map(({ fight: f, index }) => (
                <tr key={f.id} className={`transition-colors ${selectedFightId === f.id ? "bg-orange-500/[0.08]" : "hover:bg-orange-950/20"}`}>
                  <td className="p-2.5 text-slate-500">{index + 1}</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSelectedFightId(f.id)} className="font-semibold text-slate-300 hover:text-orange-200">{f.label}</button>
                      {f.permalink && (
                        <a
                          href={f.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:text-blue-400"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5">
                    <button
                      type="button"
                      aria-pressed={comparisonFightId === f.id}
                      disabled={selectedFightId === f.id}
                      onClick={() => setComparisonFightId((current) => current === f.id ? null : f.id)}
                      title="Use this fight as the comparison"
                      className={`inline-grid h-7 w-7 place-items-center border disabled:cursor-not-allowed disabled:opacity-30 ${comparisonFightId === f.id ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-200" : "border-slate-800 text-slate-500 hover:text-slate-200"}`}
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <td className="p-2.5 text-slate-400">{f.mapName}</td>
                  <td className="p-2.5 text-slate-400">{f.duration}</td>
                  <td className={`p-2.5 font-bold ${f.isWin ? "text-emerald-400" : "text-rose-400"}`}>
                    {f.isWin ? "Win" : "Loss"}
                  </td>
                  <td className="p-2.5 text-right text-slate-300">{f.squadCount}</td>
                  <td className="p-2.5 text-right text-slate-300">{f.enemyCount}</td>
                  <td className="p-2.5 text-right text-emerald-400">{f.enemyDeaths}</td>
                  <td className="p-2.5 text-right text-rose-400">{f.alliesDead}</td>
                  <td className="p-2.5 text-right text-slate-300">{fmtCompact(f.totalOutgoingDamage)}</td>
                  <td className="p-2.5 text-right text-slate-400">{fmtCompact(f.totalIncomingDamage)}</td>
                  <td className="p-2.5 text-right text-slate-400">{f.totalOutgoingStrips}</td>
                  {hasHealingData && (
                    <td className="p-2.5 text-right text-emerald-300">
                      {f.totalOutgoingHealing !== undefined ? fmtCompact(f.totalOutgoingHealing) : "-"}
                    </td>
                  )}
                  {hasSustainData && (
                    <td className={`p-2.5 text-right ${(f.effectiveHealing ?? 0) >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                      {f.effectiveHealing !== undefined ? fmtCompact(f.effectiveHealing) : "-"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fights.length > 12 && (
          <div className="p-3 border-t border-slate-800/40 text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
            >
              {showAll ? "Show less" : `Show all ${fights.length} fights`}
            </button>
          </div>
        )}
      </Panel>

      {selectedRow && (
        <section className="theme-fight-dossier grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="theme-selected-fight border border-orange-400/20 bg-black/45 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-300">Selected fight dossier</div>
                <h3 className="mt-1 text-xl font-black uppercase text-slate-100">Fight {selectedRow.index + 1} · {selectedRow.fight.fullLabel}</h3>
                <p className="mt-2 text-xs text-slate-500">Direct report totals. No scoring or methodology changes are applied in this dossier.</p>
              </div>
              <span className={`border px-3 py-1 text-xs font-black uppercase ${selectedRow.fight.isWin ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-rose-400/30 bg-rose-500/10 text-rose-300"}`}>
                {selectedRow.fight.isWin ? "Win" : "Loss"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <DossierMetric label="Squad vs enemy" value={`${selectedRow.fight.squadCount}v${selectedRow.fight.enemyCount}`} />
              <DossierMetric label="Kill / death ratio" value={kdr(selectedRow.fight).toFixed(2)} tone="text-amber-300" />
              <DossierMetric label="Outgoing / incoming" value={pressureRatio(selectedRow.fight).toFixed(2)} tone="text-orange-300" />
              <DossierMetric label="Down conversion" value={`${selectedRow.fight.enemyDowns} → ${selectedRow.fight.enemyDeaths}`} tone="text-emerald-300" />
              <DossierMetric label="Outgoing damage" value={fmtCompact(selectedRow.fight.totalOutgoingDamage)} />
              <DossierMetric label="Incoming damage" value={fmtCompact(selectedRow.fight.totalIncomingDamage)} tone="text-rose-300" />
              <DossierMetric label="Outgoing strips" value={String(selectedRow.fight.totalOutgoingStrips)} tone="text-cyan-300" />
              <DossierMetric label="Squad deaths" value={String(selectedRow.fight.alliesDead)} tone="text-rose-300" />
              {selectedRow.fight.totalOutgoingHealing !== undefined && (
                <DossierMetric label="Outgoing healing" value={fmtCompact(selectedRow.fight.totalOutgoingHealing)} tone="text-emerald-300" />
              )}
              {selectedRow.fight.effectiveHealing !== undefined && (
                <DossierMetric
                  label="Sustain (heal+barrier−dmg in)"
                  value={fmtCompact(selectedRow.fight.effectiveHealing)}
                  tone={selectedRow.fight.effectiveHealing >= 0 ? "text-emerald-300" : "text-rose-300"}
                />
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => openFightIn("squad-stats")} className="theme-command-button inline-flex items-center gap-2 border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-xs font-black uppercase text-orange-200">
                <Activity className="h-4 w-4" /> Open pressure and sustain
              </button>
              <button type="button" onClick={() => openFightIn("intelligence")} className="theme-command-button inline-flex items-center gap-2 border border-cyan-400/25 bg-cyan-500/[0.08] px-4 py-2 text-xs font-black uppercase text-cyan-200">
                <BrainCircuit className="h-4 w-4" /> Open intelligence
            </button>
            </div>
          </div>

          <div className="theme-comparison-slab border border-cyan-400/15 bg-black/35 p-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300"><GitCompare className="h-4 w-4" /> Comparison</div>
            {comparisonRow ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-sm font-black text-slate-100">Fight {comparisonRow.index + 1} · {comparisonRow.fight.mapName}</div>
                  <div className="mt-1 text-xs text-slate-500">Difference from selected fight</div>
                </div>
                <Delta label="Outgoing damage" value={comparisonRow.fight.totalOutgoingDamage - selectedRow.fight.totalOutgoingDamage} compact />
                <Delta label="Incoming damage" value={comparisonRow.fight.totalIncomingDamage - selectedRow.fight.totalIncomingDamage} compact inverse />
                <Delta label="Enemy downs" value={comparisonRow.fight.enemyDowns - selectedRow.fight.enemyDowns} />
                <Delta label="Squad deaths" value={comparisonRow.fight.alliesDead - selectedRow.fight.alliesDead} inverse />
              </div>
            ) : (
              <div className="mt-4 border-l-2 border-cyan-400/30 px-3 py-2 text-xs leading-5 text-slate-500">Use the comparison icon in another row to measure it against this fight.</div>
            )}
          </div>
        </section>
      )}

      {/* Damage per fight, plus a KDR trend line so a spike in pressure and a
          spike in kill efficiency can be read against the same fight axis at
          a glance instead of scrolling between the table and a bar list. */}
      <Panel
        title="Damage & KDR Per Fight"
        subtitle="Bars: outgoing vs incoming squad damage per fight. Line: kill/death ratio for that fight."
        icon={<Swords className="w-4 h-4" />}
        accent="text-orange-400"
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="fightNo" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" tickFormatter={(v) => `#${v}`} />
              <YAxis yAxisId="dmg" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" width={44} tickFormatter={(v) => fmtCompact(Number(v))} />
              <YAxis yAxisId="kdr" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" width={32} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(v, name) => [name === "KDR" ? Number(v).toFixed(2) : fmtCompact(Number(v)), name]}
                labelFormatter={(v, payload) => {
                  const row = payload?.[0]?.payload as { label?: string; isWin?: boolean } | undefined;
                  return `Fight #${v}${row?.label ? ` · ${row.label}` : ""}${row?.isWin != null ? ` · ${row.isWin ? "Win" : "Loss"}` : ""}`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: "#64748b" }} />
              <Bar yAxisId="dmg" dataKey="outDamage" name="Outgoing" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="dmg" dataKey="inDamage" name="Incoming" fill={CHART_COLORS.rose} radius={[3, 3, 0, 0]} />
              <Line yAxisId="kdr" type="monotone" dataKey="kdr" name="KDR" stroke={CHART_COLORS.cyan} strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

function DossierMetric({ label, value, tone = "text-slate-100" }: { label: string; value: string; tone?: string }) {
  return <div className="theme-dossier-metric border-l-2 border-orange-400/30 bg-black/25 px-3 py-2"><div className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</div><div className={`mt-1 font-mono text-lg font-black ${tone}`}>{value}</div></div>;
}

function Delta({ label, value, compact = false, inverse = false }: { label: string; value: number; compact?: boolean; inverse?: boolean }) {
  const beneficial = inverse ? value <= 0 : value >= 0;
  return <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs"><span className="text-slate-500">{label}</span><span className={`font-mono font-black ${beneficial ? "text-emerald-300" : "text-rose-300"}`}>{value >= 0 ? "+" : ""}{compact ? fmtCompact(value) : value}</span></div>;
}
