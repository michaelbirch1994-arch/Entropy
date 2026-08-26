import { useMemo, useState, type ReactNode } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import ProfessionIdentity from "../components/ui/ProfessionIdentity";
import { fmtCompact } from "../utils/format";
import {
  getBoonOverstackValue,
  BUFF_TAB_ORDER,
  type BoonTable,
} from "../lib/bridge-metrics/boonGeneration";
import {
  formatGeneratedEffect,
  generatedUnitLabel,
  getGeneratedSeconds,
  getWastedSeconds,
} from "../lib/buffGenerationDuration";
import { Sparkles } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from "../utils/chartTheme";
import PlayerSampleCell from "../components/ui/PlayerSampleCell";
import { resolvePlayerSampleContext } from "../lib/playerSampleContext";

const CATEGORY_LABELS = {
  selfBuffs: "Self",
  groupBuffs: "Group",
  squadBuffs: "Squad",
} as const;

type GenerationCategory = keyof typeof CATEGORY_LABELS;
type SortDirection = "desc" | "asc";
type SortKey = "player" | "class" | "sample" | GenerationCategory | "wasted" | "overstack";
type SortState = { key: SortKey; direction: SortDirection } | null;

const BAR_COLORS = [
  CHART_COLORS.amber,
  CHART_COLORS.sky,
  CHART_COLORS.rose,
  CHART_COLORS.emerald,
  CHART_COLORS.teal,
  CHART_COLORS.orange,
  CHART_COLORS.cyan,
  CHART_COLORS.blue,
  CHART_COLORS.red,
];

function BoonIconTick(props: any) {
  const { x, y, payload, icons } = props;
  const icon = icons?.[payload.value];
  return (
    <g transform={`translate(${x},${y})`}>
      {icon ? (
        <image href={icon} x={-10} y={6} width={20} height={20} />
      ) : (
        <text x={0} y={16} textAnchor="middle" fill="var(--entropy-text-muted)" fontSize={9}>
          {String(payload.value).slice(0, 4)}
        </text>
      )}
    </g>
  );
}

function ClassCell({ profession }: { profession: string }) {
  return <ProfessionIdentity profession={profession} />;
}

function getTableGeneratedSeconds(table: BoonTable) {
  return table.rows.reduce(
    (sum, row) => sum + getGeneratedSeconds(row, "squadBuffs", table.stacking),
    0,
  );
}

export default function BuffGenerationView() {
  const { report } = useReport();
  const tables = report?.stats.buffGeneration ?? [];
  const [tab, setTab] = useState<string>("Boons");
  const [selectedBoonId, setSelectedBoonId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(null);

  const tabs = useMemo(
    () => BUFF_TAB_ORDER.filter((t) => tables.some((table) => table.classification === t)),
    [tables],
  );
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const activeTables = useMemo(
    () => tables.filter((t) => t.classification === activeTab),
    [tables, activeTab],
  );

  const chartData = useMemo(() => {
    return activeTables
      .map((table) => {
        const value = getTableGeneratedSeconds(table);
        if (value <= 0) return null;
        return { id: table.id, name: table.name, icon: table.icon, value, stacking: table.stacking };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.value - a.value);
  }, [activeTables]);

  const generatedById = useMemo(
    () => new Map(chartData.map((entry) => [entry.id, entry.value])),
    [chartData],
  );
  const sortedTables = useMemo(
    () => [...activeTables].sort(
      (a, b) => (generatedById.get(b.id) ?? 0) - (generatedById.get(a.id) ?? 0),
    ),
    [activeTables, generatedById],
  );

  const selectedTable = sortedTables.find((table) => table.id === selectedBoonId) ?? sortedTables[0];

  const selectedBreakdown = useMemo(() => {
    if (!selectedTable) return null;
    const table = selectedTable;
    const defaultRows = table.rows
      .map((row) => ({
        ...row,
        sample: resolvePlayerSampleContext(
          report?.stats.generalPlayers,
          report?.stats.total ?? 0,
          row.account,
          { fights: row.numFights, activeMs: row.activeTimeMs },
        ),
      }))
      .sort((a, b) => a.account.localeCompare(b.account));

    const rows = sort
      ? [...defaultRows].sort((a, b) => {
          const direction = sort.direction === "desc" ? -1 : 1;
          if (sort.key === "player") return a.account.localeCompare(b.account) * direction;
          if (sort.key === "class") {
            return a.profession.localeCompare(b.profession) * direction || a.account.localeCompare(b.account);
          }
          if (sort.key === "sample") {
            return (a.sample.fights - b.sample.fights) * direction || a.account.localeCompare(b.account);
          }

          const valueA =
            sort.key === "wasted"
              ? getWastedSeconds(a, "squadBuffs", table.stacking)
              : sort.key === "overstack"
                ? getBoonOverstackValue(a, "squadBuffs", table.stacking)
                : getGeneratedSeconds(a, sort.key, table.stacking);
          const valueB =
            sort.key === "wasted"
              ? getWastedSeconds(b, "squadBuffs", table.stacking)
              : sort.key === "overstack"
                ? getBoonOverstackValue(b, "squadBuffs", table.stacking)
                : getGeneratedSeconds(b, sort.key, table.stacking);

          return (valueA === valueB ? a.account.localeCompare(b.account) : valueA - valueB) * direction;
        })
      : defaultRows;

    const totalSquadGeneratedSeconds = rows.reduce(
      (sum, row) => sum + getGeneratedSeconds(row, "squadBuffs", table.stacking),
      0,
    );
    const totalWastedSeconds = rows.reduce(
      (sum, row) => sum + getWastedSeconds(row, "squadBuffs", table.stacking),
      0,
    );
    const totalOverstack = rows.reduce(
      (sum, row) => sum + getBoonOverstackValue(row, "squadBuffs", table.stacking),
      0,
    );

    return { table, rows, totalSquadGeneratedSeconds, totalWastedSeconds, totalOverstack };
  }, [selectedTable, sort, report]);

  const iconsByName = useMemo(
    () => Object.fromEntries(chartData.map((entry) => [entry.name, entry.icon])),
    [chartData],
  );

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
            active ? "text-theme-accent-strong" : "text-theme-muted hover:text-theme-text"
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
            <div className="py-10 text-center text-sm text-theme-muted">
              No boon generation data available for this report.
              <p className="text-[11px] text-theme-muted mt-1">
                Buff Generation shows how much effect-time each player actually created. Buff uptime remains under Buffs and Party Boons.
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
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTab(item);
                setSelectedBoonId(null);
                setSort(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                activeTab === item
                  ? "bg-theme-accent/10 border-theme-accent/40 text-theme-accent-strong"
                  : "bg-theme-surface border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-accent/20"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      <Panel
        title={`Squad ${activeTab} Generated Effect-Time`}
        subtitle="Duration buffs are ordinary boon-seconds; intensity buffs such as Might and Stability are stack-seconds. Buffs and Party Boons remain the uptime views."
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
                stroke="rgba(255,255,255,0.10)"
              />
              <YAxis
                tick={{ fill: "var(--entropy-text-muted)", fontSize: 10 }}
                stroke="rgba(255,255,255,0.10)"
                width={58}
                tickFormatter={(value) => `${Math.round(Number(value))} e-s`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value, _name, item) => {
                  const stacking = Boolean(item?.payload?.stacking);
                  return [
                    `${formatGeneratedEffect(Number(value), stacking)} (${generatedUnitLabel(stacking)})`,
                    item?.payload?.name,
                  ];
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.id}
                    fill={selectedTable?.id === entry.id ? "var(--entropy-gold)" : BAR_COLORS[index % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 text-[10px] leading-4 text-theme-muted">
          The chart uses a shared effect-second scale for ranking. Duration seconds and intensity stack-seconds are different physical meanings, so compare individual values with their unit labels rather than treating them as identical wall-clock time.
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedTables.map((table) => {
            const seconds = generatedById.get(table.id) ?? 0;
            const selected = selectedTable?.id === table.id;
            const unit = generatedUnitLabel(table.stacking);
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => setSelectedBoonId(table.id)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                  selected
                    ? "border-theme-accent/40 bg-theme-accent/10 text-theme-accent-strong"
                    : "border-theme-border bg-theme-surface-inset/55 text-theme-muted hover:border-theme-accent/20 hover:text-theme-text"
                }`}
                title={`${seconds.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit} generated`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {table.icon ? (
                    <img src={table.icon} alt="" referrerPolicy="no-referrer" className="h-5 w-5 shrink-0 rounded-sm" />
                  ) : (
                    <Sparkles className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate text-xs font-semibold">{table.name}</span>
                </span>
                <span className="shrink-0 text-right font-mono text-[11px]">
                  <span className="block font-bold">{formatGeneratedEffect(seconds, table.stacking)}</span>
                  <span className="text-[9px] uppercase tracking-wider text-theme-faint">{table.rows.length} players</span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {selectedBreakdown && (() => {
        const { table, rows, totalSquadGeneratedSeconds, totalWastedSeconds, totalOverstack } = selectedBreakdown;
        const unit = generatedUnitLabel(table.stacking);
        return (
          <Panel
            title={`${table.name} Generation`}
            subtitle={table.stacking
              ? "Self, group, squad, and reapplied values are stack-seconds: one stack maintained for one second equals one stack-second. EI Overstack remains separate and unverified as a pure waste measure."
              : "Self, group, squad, and reapplied values are total boon-duration seconds. EI Overstack remains separate and unverified as a pure waste measure."}
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
            <div className="grid grid-cols-3 gap-2 border-b border-theme-border/60 p-3 text-center text-[10px] uppercase tracking-wider text-theme-muted">
              <div className="rounded-lg bg-theme-surface-inset/65 p-2">
                <div>Squad Generated</div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-400">
                  {formatGeneratedEffect(totalSquadGeneratedSeconds, table.stacking)}
                </div>
              </div>
              <div className="rounded-lg bg-theme-surface-inset/65 p-2">
                <div>Reapplied / Wasted</div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-400">
                  {formatGeneratedEffect(totalWastedSeconds, table.stacking)}
                </div>
              </div>
              <div className="rounded-lg bg-theme-surface-inset/65 p-2">
                <div>EI Overstack</div>
                <div className="mt-1 font-mono text-sm font-bold text-rose-400">{fmtCompact(totalOverstack)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-theme-border/60 text-[10px] uppercase tracking-wider text-theme-muted">
                    <SortHeader sortKey="player" className="text-left px-4 py-3 sticky left-0 bg-theme-surface/95">
                      Player
                    </SortHeader>
                    <SortHeader sortKey="class" className="text-left px-2 py-3">Class</SortHeader>
                    <SortHeader sortKey="sample" className="text-right px-2 py-3" title="Fights joined, session coverage, active combat time, and sample reliability">
                      Sample
                    </SortHeader>
                    {(Object.keys(CATEGORY_LABELS) as GenerationCategory[]).map((category) => (
                      <SortHeader
                        key={category}
                        sortKey={category}
                        className="text-center px-3 py-3"
                        title={`Total ${CATEGORY_LABELS[category].toLowerCase()} generated ${unit}`}
                      >
                        {CATEGORY_LABELS[category]}
                      </SortHeader>
                    ))}
                    <SortHeader sortKey="wasted" className="text-center px-3 py-3 text-amber-500/70" title={`Total EI wasted/reapplied generation converted back to ${unit}`}>
                      Reapplied
                    </SortHeader>
                    <SortHeader sortKey="overstack" className="text-center px-3 py-3 text-rose-500/70" title="Raw EI-normalized Overstack representation; not relabeled as time because EI includes generation in this exported value">
                      EI Overstack
                    </SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const wastedSeconds = getWastedSeconds(row, "squadBuffs", table.stacking);
                    const overstack = getBoonOverstackValue(row, "squadBuffs", table.stacking);
                    return (
                      <tr
                        key={row.account}
                        className={`border-b border-theme-border/40 hover:bg-theme-surface-elevated/55 transition-colors ${index % 2 === 0 ? "bg-theme-surface-inset/20" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-semibold text-theme-text sticky left-0 bg-theme-surface/95 whitespace-nowrap">{row.account}</td>
                        <td className="px-2 py-2.5"><ClassCell profession={row.profession} /></td>
                        <td className="px-2 py-2.5 text-right"><PlayerSampleCell sample={row.sample} /></td>
                        {(Object.keys(CATEGORY_LABELS) as GenerationCategory[]).map((category) => {
                          const seconds = getGeneratedSeconds(row, category, table.stacking);
                          return (
                            <td key={category} className="text-center px-3 py-2.5 font-mono">
                              <span
                                className={seconds > 0 ? "font-bold text-emerald-400" : "font-bold text-theme-faint"}
                                title={`${seconds.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit} generated`}
                              >
                                {formatGeneratedEffect(seconds, table.stacking)}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2.5 font-mono">
                          <span
                            className={wastedSeconds > 0 ? "text-amber-400/80" : "text-theme-faint"}
                            title={`${wastedSeconds.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit} wasted/reapplied`}
                          >
                            {formatGeneratedEffect(wastedSeconds, table.stacking)}
                          </span>
                        </td>
                        <td className="text-center px-3 py-2.5 font-mono">
                          <span className={overstack > 0 ? "text-rose-400/80" : "text-theme-faint"}>
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
