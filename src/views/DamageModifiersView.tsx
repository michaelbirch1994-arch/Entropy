import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { fmtNum, fmtCompact } from "../utils/format";
import Panel from "../components/ui/Panel";
import ProfessionIdentity from "../components/ui/ProfessionIdentity";
import { Percent, CircleCheck, Sparkles } from "lucide-react";
import type { DamageModifierColumn } from "../types/report";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from "../utils/chartTheme";
import PlayerSampleCell from "../components/ui/PlayerSampleCell";
import type { PlayerSampleContextData } from "../lib/playerSampleContext";

function kindOf(c: DamageModifierColumn): "gain" | "underEffect" | "counter" {
  if (c.isCounter) return "counter";
  if (c.nonMultiplier) return "underEffect";
  return "gain";
}

const KIND_LABEL: Record<string, string> = {
  gain: "Damage gained",
  underEffect: "Damage under effect",
  counter: "Damage while condition met",
};

const KIND_COLOR: Record<string, string> = {
  gain: "text-amber-400",
  underEffect: "text-amber-400",
  counter: "text-slate-400",
};

const KIND_DOT: Record<string, string> = {
  gain: "bg-amber-500",
  underEffect: "bg-amber-500",
  counter: "bg-slate-500",
};

const KIND_BAR: Record<string, string> = {
  gain: CHART_COLORS.amber,
  underEffect: CHART_COLORS.sky,
  counter: CHART_COLORS.teal,
};

const KIND_FILTERS = [
  { key: "all", label: "All" },
  { key: "gain", label: "Damage Gained" },
  { key: "underEffect", label: "Under Effect" },
  { key: "counter", label: "Counters" },
] as const;

type KindFilter = (typeof KIND_FILTERS)[number]["key"];

type SortKey = "player" | "class" | "sample" | number;
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

// Custom XAxis tick that draws the modifier's own icon instead of a wrapped
// name label, matching the treatment used on the Buff Generation chart.
function ModIconTick(props: any) {
  const { x, y, payload, icons } = props;
  const icon = icons?.[payload.value];
  return (
    <g transform={`translate(${x},${y})`}>
      {icon ? (
        <image href={icon} x={-10} y={6} width={20} height={20} />
      ) : (
        <text x={0} y={16} textAnchor="middle" fill="#64748b" fontSize={9}>
          {String(payload.value).slice(0, 4)}
        </text>
      )}
    </g>
  );
}

export default function DamageModifiersView() {
  const { report } = useReport();
  const [sort, setSort] = useState<SortState>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedModId, setSelectedModId] = useState<number | null>(null);
  if (!report) return null;
  const data = report.stats.damageModifiers;

  if (!data || data.columns.length === 0 || data.rows.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Damage Modifiers"
          icon={<Percent className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No damage modifier data available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports.
              </p>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  const { columns, rows } = data;
  const sampleFor = (row: (typeof rows)[number]): PlayerSampleContextData => ({
    fights: Math.max(0, Number(row.fightsJoined) || 0),
    totalFights: Math.max(Number(row.fightsJoined) || 0, Number(data.totalFights) || 0),
    activeMs: Math.max(0, Number(row.activeMs) || 0),
    known: Number.isFinite(row.fightsJoined) && Number.isFinite(data.totalFights),
  });

  // Squad-wide total per modifier, driving both the summary chart and the
  // column sort order used for the chart's bars. Table column order itself
  // stays as computeDamageModifiers ranked it (already total-damage desc).
  const totalByModId = useMemo(() => {
    const totals = new Map<number, number>();
    for (const c of columns) {
      let sum = 0;
      for (const row of rows) sum += row.values[c.id]?.damage ?? 0;
      totals.set(c.id, sum);
    }
    return totals;
  }, [columns, rows]);

  const chartData = useMemo(
    () =>
      columns
        .map((c) => ({ id: c.id, name: c.name, icon: c.icon, kind: kindOf(c), value: totalByModId.get(c.id) ?? 0 }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 12),
    [columns, totalByModId],
  );
  const iconsByName = useMemo(() => Object.fromEntries(chartData.map((d) => [d.name, d.icon])), [chartData]);

  const filteredColumns = useMemo(
    () => (kindFilter === "all" ? columns : columns.filter((c) => kindOf(c) === kindFilter)),
    [columns, kindFilter],
  );

  const selectedColumn = columns.find((c) => c.id === selectedModId) ?? null;
  const topContributors = useMemo(() => {
    if (!selectedColumn) return [];
    return rows
      .filter((r) => (r.values[selectedColumn.id]?.damage ?? 0) > 0)
      .sort((a, b) => (b.values[selectedColumn.id]?.damage ?? 0) - (a.values[selectedColumn.id]?.damage ?? 0))
      .slice(0, 8);
  }, [rows, selectedColumn]);

  const sortedRows = (() => {
    const base = [...rows].sort((a, b) => a.account.localeCompare(b.account) || a.profession.localeCompare(b.profession));
    if (!sort) return base;
    const dir = sort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      if (sort.key === "player") return a.account.localeCompare(b.account) * dir || a.profession.localeCompare(b.profession);
      if (sort.key === "class") return a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account);
      if (sort.key === "sample") {
        const av = data.totalFights ? (a.fightsJoined ?? 0) / data.totalFights : 0;
        const bv = data.totalFights ? (b.fightsJoined ?? 0) / data.totalFights : 0;
        return (av - bv) * dir || ((a.activeMs ?? 0) - (b.activeMs ?? 0)) * dir || a.account.localeCompare(b.account);
      }
      if (typeof sort.key !== "number") return 0;
      const av = a.values[sort.key]?.damage ?? 0;
      const bv = b.values[sort.key]?.damage ?? 0;
      const ah = a.values[sort.key]?.hits ?? 0;
      const bh = b.values[sort.key]?.hits ?? 0;
      return (av - bv) * dir || (ah - bh) * dir || a.account.localeCompare(b.account) || a.profession.localeCompare(b.profession);
    });
  })();

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const sortLabel = (key: SortKey) => (!sort || sort.key !== key ? "SORT" : sort.dir === "desc" ? "DESC" : "ASC");
  const sortButtonClass = (key: SortKey, extra = "") =>
    `inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
      sort?.key === key ? "text-amber-300" : "text-slate-500 hover:text-slate-300"
    } ${extra}`;

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Squad Damage Modifier Output"
        subtitle="Total realized damage each modifier contributed across the whole squad, summed over every fight joined. Click a bar (or a column header below) to see who drove it."
        icon={<Sparkles className="w-3.5 h-3.5" />}
      >
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                height={40}
                tick={(props) => <ModIconTick {...props} icons={iconsByName} />}
                stroke="#334155"
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" width={48} tickFormatter={(v) => fmtCompact(Number(v))} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(v, _n, item) => [fmtNum(Number(v)), item?.payload?.name]}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                onClick={(d: any) => setSelectedModId(d?.payload?.id ?? d?.id ?? null)}
                cursor="pointer"
              >
                {chartData.map((d) => (
                  <Cell key={d.id} fill={selectedModId === d.id ? CHART_COLORS.rose : KIND_BAR[d.kind]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] text-slate-500">
          {(["gain", "underEffect", "counter"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${KIND_DOT[k]}`} />
              <span className={KIND_COLOR[k]}>{KIND_LABEL[k]}</span>
              <span className="text-slate-500">
                {k === "gain" && "- real, already-realized extra damage from this modifier"}
                {k === "underEffect" && "- total damage while active, not the gain itself (multiplier not in the log)"}
                {k === "counter" && "- informational, not a damage gain"}
              </span>
            </span>
          ))}
        </div>
      </Panel>

      {selectedColumn && (
        <Panel
          title={`${selectedColumn.name} - Top Contributors`}
          subtitle={selectedColumn.description || KIND_LABEL[kindOf(selectedColumn)]}
          icon={
            selectedColumn.icon ? (
              <img src={selectedColumn.icon} alt="" referrerPolicy="no-referrer" className="w-4 h-4 rounded-sm" />
            ) : (
              <Percent className="w-3.5 h-3.5" />
            )
          }
          action={
            <button
              type="button"
              onClick={() => setSelectedModId(null)}
              className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          }
        >
          {topContributors.length === 0 ? (
            <p className="text-xs text-slate-500">No player triggered this modifier for measurable damage.</p>
          ) : (
            <div className="space-y-1.5">
              {topContributors.map((row) => {
                const v = row.values[selectedColumn.id]!;
                const total = totalByModId.get(selectedColumn.id) || 1;
                const pct = Math.round((v.damage / total) * 100);
                return (
                  <div key={`${row.account}-${row.profession}`} className="flex items-center gap-3">
                    <ProfessionIdentity profession={row.profession} className="shrink-0" />
                    <span className="text-xs font-semibold text-slate-200 w-32 truncate shrink-0">{row.account}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800/60 overflow-hidden">
                      <div className="h-full bg-amber-500/70" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 w-24 text-right shrink-0">
                      {fmtNum(v.damage)} <span className="text-slate-600">({pct}%)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 w-16 text-right shrink-0">{fmtNum(v.hits)} hits</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      <Panel
        title="Damage Modifiers"
        subtitle="Which traits/sigils/runes fired for each player, and how much damage each one contributed - summed across every fight"
        icon={<Percent className="w-3.5 h-3.5" />}
        action={`${sortedRows.length} players`}
        bodyClassName="p-0"
      >
        <div className="px-4 pt-4 pb-1 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setKindFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                  kindFilter === f.key
                    ? "text-amber-300 border-amber-500/30 bg-amber-500/5"
                    : "text-slate-500 border-slate-800 bg-black/30 hover:text-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed max-w-3xl">
            A number in a cell means that player measurably triggered that modifier at least once - a fair proxy for
            "has this trait/sigil active." A dash means it never fired for them this session; the raw combat log
            doesn't include full gear/trait loadouts, so a dash usually means they don't run it, but could also mean
            the condition just never came up in these fights. Click a column header to open its top-contributors
            breakdown above. If someone played more than one class across the combined fights, they get one row per
            class - so their traits/relics/sigils never mix between builds.
          </p>
        </div>

        <div className="overflow-x-auto mt-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-amber-500/10 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-bold px-4 py-3 sticky left-0 bg-[#0a0e1f]/95">
                  <button type="button" onClick={() => toggleSort("player")} className={sortButtonClass("player")}>
                    Player <span className="text-[8px] opacity-70">{sortLabel("player")}</span>
                  </button>
                </th>
                <th className="text-left font-bold px-2 py-3">
                  <button type="button" onClick={() => toggleSort("class")} className={sortButtonClass("class")}>
                    Class <span className="text-[8px] opacity-70">{sortLabel("class")}</span>
                  </button>
                </th>
                <th className="text-right font-bold px-2 py-3 min-w-[164px]">
                  <button type="button" onClick={() => toggleSort("sample")} className={sortButtonClass("sample", "ml-auto")}>
                    Build sample <span className="text-[8px] opacity-70">{sortLabel("sample")}</span>
                  </button>
                </th>
                {filteredColumns.map((c) => {
                  const kind = kindOf(c);
                  const tooltip = [c.name, c.description, `${KIND_LABEL[kind]}`, `${c.playersWithIt} player${c.playersWithIt === 1 ? "" : "s"} triggered this`]
                    .filter(Boolean)
                    .join(" — ");
                  return (
                    <th key={c.id} className="text-center font-bold px-2 py-3 min-w-[76px]" title={tooltip}>
                      <button
                        type="button"
                        onClick={() => {
                          toggleSort(c.id);
                          setSelectedModId(c.id);
                        }}
                        className={sortButtonClass(c.id, "flex w-full flex-col items-center")}
                      >
                        {c.icon ? (
                          <img src={c.icon} alt={c.name} className="w-4 h-4 rounded-sm" loading="lazy" />
                        ) : (
                          <span className="w-4 h-4" />
                        )}
                        <span className="normal-case font-semibold text-slate-400 text-center leading-tight">{c.name}</span>
                        <span className="flex items-center gap-1">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${KIND_DOT[kind]}`} />
                          <span className="text-[10px] text-slate-500 normal-case">
                            {c.playersWithIt}p <span className="text-[8px] opacity-70">{sortLabel(c.id)}</span>
                          </span>
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr
                  key={`${row.account}-${row.profession}`}
                  className={`border-b border-slate-800/40 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-200 sticky left-0 bg-[#0a0e1f]/95 whitespace-nowrap">
                    {row.account}
                  </td>
                  <td className="px-2 py-2.5">
                    <ProfessionIdentity profession={row.profession} />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <PlayerSampleCell sample={sampleFor(row)} />
                  </td>
                  {filteredColumns.map((c) => {
                    const v = row.values[c.id];
                    const kind = kindOf(c);
                    return (
                      <td key={c.id} className="text-center px-2 py-2.5 font-mono">
                        {v ? (
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${KIND_COLOR[kind]}`}
                            title={`${fmtNum(v.hits)} hit${v.hits === 1 ? "" : "s"} under this modifier`}
                          >
                            <CircleCheck className="w-2.5 h-2.5 flex-shrink-0" />
                            {fmtNum(v.damage)}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
