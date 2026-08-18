import { useMemo, useState, type ReactNode } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { fmtCompact, profChip, relativeStackColor } from "../utils/format";
import { getBoonMetricValue, getBoonWastedValue, getBoonOverstackValue, BUFF_TAB_ORDER, type BoonTable } from "../lib/bridge-metrics/boonGeneration";
import { Sparkles } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from "../utils/chartTheme";
import PlayerSampleCell from "../components/ui/PlayerSampleCell";
import { resolvePlayerSampleContext } from "../lib/playerSampleContext";

const CATEGORY_LABELS = {
  selfBuffs: "Self",
  groupBuffs: "Group",
  squadBuffs: "Squad",
} as const;

type SortDirection = "desc" | "asc";
type SortKey = "player" | "class" | "sample" | keyof typeof CATEGORY_LABELS | "wasted" | "overstack";
type SortState = { key: SortKey; direction: SortDirection } | null;

const BAR_COLORS = [CHART_COLORS.amber, CHART_COLORS.sky, CHART_COLORS.rose, CHART_COLORS.emerald, CHART_COLORS.teal, CHART_COLORS.orange, CHART_COLORS.cyan, CHART_COLORS.blue, CHART_COLORS.red];

// Custom XAxis tick that draws the boon's own icon instead of/alongside its
// name, so the summary chart reads at a glance.
function BoonIconTick(props: any) {
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

function ClassCell({ profession }: { profession: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(profession)}`}>
      <ProfessionIcon profession={profession} className="w-3.5 h-3.5 shrink-0" />
      {profession}
    </span>
  );
}

function getTableScore(table: BoonTable) {
  const contributors = table.rows.filter((r) => getBoonMetricValue(r, "squadBuffs", table.stacking, "uptime") > 0);
  if (contributors.length === 0) return 0;
  const avg = contributors.reduce((sum, r) => sum + getBoonMetricValue(r, "squadBuffs", table.stacking, "uptime"), 0) / contributors.length;
  return Math.round(avg * 100) / 100;
}

export default function BuffGenerationView() {
  const { report } = useReport();
  const tables = report?.stats.buffGeneration ?? [];
  // Default tab matches what this page showed before it gained other categories,
  // so existing users see no change until they explore further.
  const [tab, setTab] = useState<string>("Boons");
  const [selectedBoonId, setSelectedBoonId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(null);

  // Which classification tabs actually have data this report, in the same
  // curated order as the Buffs page (BUFF_TAB_ORDER) so the two line up.
  const tabs = useMemo(
    () => BUFF_TAB_ORDER.filter((t) => tables.some((table) => table.classification === t)),
    [tables],
  );
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const activeTables = useMemo(
    () => tables.filter((t) => t.classification === activeTab),
    [tables, activeTab],
  );

  // One bar per buff in the active category: squad-average output (avg stacks
  // for stacking buffs, avg uptime% for pulse buffs) across everyone who
  // generated any of it. Scoped to the active tab so stacks and percentages
  // never share one chart's y-axis.
  const chartData = useMemo(() => {
    return activeTables
      .map((t) => {
        const value = getTableScore(t);
        if (value <= 0) return null;
        return { id: t.id, name: t.name, icon: t.icon, stacking: t.stacking, value };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => b.value - a.value);
  }, [activeTables]);

  const scoreById = useMemo(() => new Map(chartData.map((d) => [d.id, d.value])), [chartData]);
  const sortedTables = useMemo(() => [...activeTables].sort((a, b) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0)), [activeTables, scoreById]);

  const selectedTable = sortedTables.find((t) => t.id === selectedBoonId) ?? sortedTables[0];
  const selectedBreakdown = useMemo(() => {
    if (!selectedTable) return null;
    const table = selectedTable;
    const defaultRows = table.rows
      .map((row) => ({
        ...row,
        sample: resolvePlayerSampleContext(report?.stats.generalPlayers, report?.stats.total ?? 0, row.account, {
          fights: row.numFights,
          activeMs: row.activeTimeMs,
        }),
      }))
      .sort((a, b) => a.account.localeCompare(b.account));
    const rows = sort
      ? [...defaultRows].sort((a, b) => {
          const direction = sort.direction === "desc" ? -1 : 1;
          if (sort.key === "player") return a.account.localeCompare(b.account) * direction;
          if (sort.key === "class") return a.profession.localeCompare(b.profession) * direction || a.account.localeCompare(b.account);
          if (sort.key === "sample") return (a.sample.fights - b.sample.fights) * direction || a.account.localeCompare(b.account);
          const valueA =
            sort.key === "wasted"
              ? getBoonWastedValue(a, "squadBuffs", table.stacking)
              : sort.key === "overstack"
                ? getBoonOverstackValue(a, "squadBuffs", table.stacking)
                : getBoonMetricValue(a, sort.key, table.stacking, "uptime");
          const valueB =
            sort.key === "wasted"
              ? getBoonWastedValue(b, "squadBuffs", table.stacking)
              : sort.key === "overstack"
                ? getBoonOverstackValue(b, "squadBuffs", table.stacking)
                : getBoonMetricValue(b, sort.key, table.stacking, "uptime");
          return (valueA === valueB ? a.account.localeCompare(b.account) : valueA - valueB) * direction;
        })
      : defaultRows;
    const unit = table.stacking ? "avg stacks" : "%";
    const totalSquadOutput = rows.reduce((sum, row) => sum + getBoonMetricValue(row, "squadBuffs", table.stacking, "uptime"), 0);
    const totalWasted = rows.reduce((sum, row) => sum + getBoonWastedValue(row, "squadBuffs", table.stacking), 0);
    const totalOverstack = rows.reduce((sum, row) => sum + getBoonOverstackValue(row, "squadBuffs", table.stacking), 0);

    // Relative color per category column: stacking buffs don't share a
    // 0-100% scale (Might caps at 25, Stability is usually 0-3), so "good"
    // means "better than your squadmates on this specific buff" rather than
    // a fixed threshold. Precomputed per category so each cell doesn't
    // rescan every row. See relativeStackColor in utils/format.ts.
    const columnValuesByCategory = table.stacking
      ? Object.fromEntries(
          (Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => [
            cat,
            rows.map((r) => getBoonMetricValue(r, cat, table.stacking, "uptime")),
          ]),
        )
      : null;

    return { table, rows, unit, totalSquadOutput, totalWasted, totalOverstack, columnValuesByCategory };
  }, [selectedTable, sort, report]);
  const iconsByName = useMemo(() => Object.fromEntries(chartData.map((d) => [d.name, d.icon])), [chartData]);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  }

  function SortHeader({
    sortKey,
    children,
    className = "",
    title,
  }: {
    sortKey: SortKey;
    children: ReactNode;
    className?: string;
    title?: string;
  }) {
    const active = sort?.key === sortKey;
    return (
      <th className={className} title={title}>
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={`inline-flex items-center justify-center gap-1 rounded-md px-1.5 py-1 font-bold transition-colors ${
            active ? "text-amber-300" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {children}
          <span className="w-3 text-[9px]">{active ? (sort.direction === "desc" ? "▼" : "▲") : "↕"}</span>
        </button>
      </th>
    );
  }

  if (!report) return null;

  if (tables.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Buff Generation"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No boon generation data available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports. This shows who is actually
                generating a boon versus who is just standing near someone who is - distinct from the plain uptime
                tables under Buffs, which show what each player had, not what they produced.
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
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setSelectedBoonId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                activeTab === t
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <Panel
        title={`Squad ${activeTab} Output`}
        subtitle="Average squad-facing output per boon. Select a boon below to inspect only that breakdown instead of scrolling every player table."
        icon={<Sparkles className="w-3.5 h-3.5" />}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                height={40}
                tick={(props) => <BoonIconTick {...props} icons={iconsByName} />}
                stroke="#334155"
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" width={40} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(v, _n, item) => [
                  item?.payload?.stacking ? `${v} avg stacks` : `${v}%`,
                  item?.payload?.name,
                ]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={d.id} fill={selectedTable?.id === d.id ? CHART_COLORS.amber : BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedTables.map((table) => {
            const value = scoreById.get(table.id) ?? 0;
            const selected = selectedTable?.id === table.id;
            const unit = table.stacking ? "avg stacks" : "%";
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => setSelectedBoonId(table.id)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                  selected
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-slate-800/70 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {table.icon ? <img src={table.icon} alt="" referrerPolicy="no-referrer" className="h-5 w-5 shrink-0 rounded-sm" /> : <Sparkles className="h-4 w-4 shrink-0" />}
                  <span className="truncate text-xs font-semibold">{table.name}</span>
                </span>
                <span className="shrink-0 text-right font-mono text-[11px]">
                  <span className="block font-bold">{value.toFixed(table.stacking ? 2 : 0)}{table.stacking ? "" : "%"}</span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500">{table.rows.length} players</span>
                  <span className="sr-only"> {unit}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {selectedBreakdown && (() => {
        const { table, rows, unit, totalSquadOutput, totalWasted, totalOverstack, columnValuesByCategory } = selectedBreakdown;

        return (
          <Panel
            title={`${table.name} Generation`}
            subtitle={`Only the selected ${activeTab.toLowerCase()} metric is shown. Self, group, and squad values are ${unit}.`}
            icon={
              table.icon ? (
                <img src={table.icon} alt="" referrerPolicy="no-referrer" className="w-4 h-4 rounded-sm" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )
            }
            action={`${rows.length} players`}
            bodyClassName="p-0"
          >
            <div className="grid grid-cols-3 gap-2 border-b border-slate-800/50 p-3 text-center text-[10px] uppercase tracking-wider text-slate-500">
              <div className="rounded-lg bg-slate-950/50 p-2">
                <div>Squad Output</div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-400">{fmtCompact(totalSquadOutput)}</div>
              </div>
              <div className="rounded-lg bg-slate-950/50 p-2">
                <div>Reapplied</div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-400">{fmtCompact(totalWasted)}</div>
              </div>
              <div className="rounded-lg bg-slate-950/50 p-2">
                <div>Overcapped</div>
                <div className="mt-1 font-mono text-sm font-bold text-rose-400">{fmtCompact(totalOverstack)}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-amber-500/10 text-[10px] uppercase tracking-wider text-slate-500">
                    <SortHeader sortKey="player" className="text-left px-4 py-3 sticky left-0 bg-[#0a0e1f]/95">
                      Player
                    </SortHeader>
                    <SortHeader sortKey="class" className="text-left px-2 py-3">
                      Class
                    </SortHeader>
                    <SortHeader sortKey="sample" className="text-right px-2 py-3" title="Fights joined, session coverage, active combat time, and sample reliability">
                      Sample
                    </SortHeader>
                    {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => (
                      <SortHeader key={cat} sortKey={cat} className="text-center px-3 py-3">
                        {CATEGORY_LABELS[cat]}
                      </SortHeader>
                    ))}
                    <SortHeader sortKey="wasted" className="text-center px-3 py-3 text-amber-500/70" title="Squad-facing generation that was reapplied before the buff needed refreshing - redundant, but not necessarily harmful">
                      Reapplied
                    </SortHeader>
                    <SortHeader sortKey="overstack" className="text-center px-3 py-3 text-rose-500/70" title="Squad-facing generation that was discarded because the target was already past this buff's stack/effect cap">
                      Overcapped
                    </SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const wasted = getBoonWastedValue(row, "squadBuffs", table.stacking);
                    const overstack = getBoonOverstackValue(row, "squadBuffs", table.stacking);
                    return (
                      <tr
                        key={row.account}
                        className={`border-b border-slate-800/40 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-semibold text-slate-200 sticky left-0 bg-[#0a0e1f]/95 whitespace-nowrap">
                          {row.account}
                        </td>
                        <td className="px-2 py-2.5">
                          <ClassCell profession={row.profession} />
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <PlayerSampleCell sample={row.sample} />
                        </td>
                        {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => {
                          const value = getBoonMetricValue(row, cat, table.stacking, "uptime");
                          // Duration buffs (%) keep the simple has-any-output
                          // green/gray split. Stacking buffs get a relative
                          // gradient instead of flat green for any nonzero value,
                          // which previously made 0.1 avg stacks look identical
                          // to 20 avg stacks.
                          const color = table.stacking
                            ? relativeStackColor(value, columnValuesByCategory![cat])
                            : value > 0
                              ? "text-emerald-400"
                              : "text-slate-600";
                          return (
                            <td key={cat} className="text-center px-3 py-2.5 font-mono">
                              <span className={`font-bold ${color}`}>
                                {table.stacking ? value.toFixed(2) : `${value.toFixed(0)}%`}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2.5 font-mono">
                          <span className={wasted > 0 ? "text-amber-400/80" : "text-slate-700"}>
                            {table.stacking ? wasted.toFixed(2) : `${wasted.toFixed(0)}%`}
                          </span>
                        </td>
                        <td className="text-center px-3 py-2.5 font-mono">
                          <span className={overstack > 0 ? "text-rose-400/80" : "text-slate-700"}>
                            {table.stacking ? overstack.toFixed(2) : `${overstack.toFixed(0)}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })()}
    </div>
  );
}
