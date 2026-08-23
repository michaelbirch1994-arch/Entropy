import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { fmtCompact, fmtNum, profChip } from "../utils/format";
import { NON_DAMAGING_CONDITIONS, getDefaultConditionIcon } from "../lib/bridge-metrics/conditionsMetrics";
import { Skull } from "lucide-react";
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
import type { ConditionPlayer } from "../types/report";

const TABS = ["Damage", "Control"] as const;
type Tab = (typeof TABS)[number];

const BAR_COLORS = [
  CHART_COLORS.rose,
  CHART_COLORS.amber,
  CHART_COLORS.orange,
  CHART_COLORS.red,
  CHART_COLORS.sky,
  CHART_COLORS.emerald,
  CHART_COLORS.teal,
  CHART_COLORS.cyan,
  CHART_COLORS.blue,
];

type SortKey = "player" | "class" | "sample" | "applications" | "damage" | "uptime";
type SortState = { key: SortKey; direction: "desc" | "asc" } | null;

type ConditionSummary = { name: string; icon?: string; applications: number; damage: number; players: number };

function metricForTab(entry: { applications: number; damage: number }, tab: Tab) {
  return tab === "Control" ? entry.applications : entry.damage;
}

function ClassCell({ profession }: { profession: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(profession)}`}>
      <ProfessionIcon profession={profession} className="w-3.5 h-3.5 shrink-0" />
      {profession}
    </span>
  );
}

function ConditionIconTick(props: any) {
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

export default function ConditionsView() {
  const { report } = useReport();
  const [tab, setTab] = useState<Tab>("Damage");
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(null);

  const conditionPlayers: ConditionPlayer[] = report?.stats.conditionPlayers ?? [];

  const summaryByName = useMemo(() => {
    const map = new Map<string, ConditionSummary>();
    conditionPlayers.forEach((p) => {
      Object.entries((direction === "outgoing" ? p.outgoingConditions : p.incomingConditions) || {}).forEach(([name, v]) => {
        const existing = map.get(name) || {
          name,
          icon: v.icon || getDefaultConditionIcon(name),
          applications: 0,
          damage: 0,
          players: 0,
        };
        existing.applications += Number(v.applications || 0);
        existing.damage += Number(v.damage || 0);
        if ((v.applications || 0) > 0 || (v.damage || 0) > 0) existing.players += 1;
        if (!existing.icon && v.icon) existing.icon = v.icon;
        map.set(name, existing);
      });
    });
    return map;
  }, [conditionPlayers, direction]);

  const namesForTab = useMemo(() => {
    return Array.from(summaryByName.keys()).filter((name) =>
      tab === "Control" ? NON_DAMAGING_CONDITIONS.has(name) : !NON_DAMAGING_CONDITIONS.has(name),
    );
  }, [summaryByName, tab]);

  const chartData = useMemo(() => {
    return namesForTab
      .map((name) => {
        const entry = summaryByName.get(name);
        if (!entry) return null;
        const value = metricForTab(entry, tab);
        if (value <= 0) return null;
        return { name, icon: entry.icon, value };
      })
      .filter((e): e is { name: string; icon?: string; value: number } => e !== null)
      .sort((a, b) => b.value - a.value);
  }, [namesForTab, summaryByName, tab]);

  const sortedNames = useMemo(() => {
    return [...namesForTab].sort((a, b) => {
      const ea = summaryByName.get(a) ?? { applications: 0, damage: 0 };
      const eb = summaryByName.get(b) ?? { applications: 0, damage: 0 };
      return metricForTab(eb, tab) - metricForTab(ea, tab);
    });
  }, [namesForTab, summaryByName, tab]);

  const selectedCondition = selectedName && sortedNames.includes(selectedName) ? selectedName : sortedNames[0];
  const selectedSummary = selectedCondition ? summaryByName.get(selectedCondition) : undefined;

  const iconsByName = useMemo(() => Object.fromEntries(chartData.map((e) => [e.name, e.icon])), [chartData]);

  const detailRows = useMemo(() => {
    if (!selectedCondition) return [];
    const rows = conditionPlayers
      .map((p) => {
        const entry = (direction === "outgoing" ? p.outgoingConditions : p.incomingConditions)?.[selectedCondition];
        if (!entry) return null;
        if ((entry.applications || 0) <= 0 && (entry.damage || 0) <= 0) return null;
        return {
          account: p.account,
          profession: p.profession,
          applications: entry.applications || 0,
          damage: entry.damage || 0,
          uptimeMs: entry.uptimeMs,
          totalFightMs: p.totalFightMs,
          sample: resolvePlayerSampleContext(report?.stats.generalPlayers, report?.stats.total ?? 0, p.account, {
            fights: p.logsJoined,
            activeMs: p.squadActiveMs,
          }),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (!sort) return rows.sort((a, b) => b.damage - a.damage || b.applications - a.applications);
    const dir = sort.direction === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (sort.key === "player") return a.account.localeCompare(b.account) * dir;
      if (sort.key === "class") return a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account);
      if (sort.key === "sample") return (a.sample.fights - b.sample.fights) * dir || a.account.localeCompare(b.account);
      if (sort.key === "applications") return (a.applications - b.applications) * dir || a.account.localeCompare(b.account);
      if (sort.key === "damage") return (a.damage - b.damage) * dir || a.account.localeCompare(b.account);
      if (sort.key === "uptime") return ((a.uptimeMs ?? -1) - (b.uptimeMs ?? -1)) * dir || a.account.localeCompare(b.account);
      return 0;
    });
  }, [selectedCondition, conditionPlayers, sort, report, direction]);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  }

  function sortLabel(key: SortKey) {
    return !sort || sort.key !== key ? "↕" : sort.direction === "desc" ? "▼" : "▲";
  }

  if (!report) return null;

  if (conditionPlayers.length === 0 || namesForTab.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Conditions"
          icon={<Skull className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-theme-muted">
              {direction === "outgoing" ? "No outgoing condition data available for this report." : "No incoming condition data available for this report."}
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  const unit = tab === "Control" ? "applications" : "damage";

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setSelectedName(null);
              setSort(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
              tab === t
                ? "bg-theme-accent/10 border-theme-accent/40 text-theme-accent-strong"
                : "bg-theme-surface border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-accent/20"
            }`}
          >
            {t === "Damage" ? "Damage Conditions" : "Control Effects"}
          </button>
        ))}
      </div>

<div className="flex flex-wrap gap-1.5">
        {(["outgoing", "incoming"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDirection(d);
              setSelectedName(null);
              setSort(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
              direction === d
                ? "bg-theme-accent/10 border-theme-accent/40 text-theme-accent-strong"
                : "bg-theme-surface border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-accent/20"
            }`}
          >
            {d === "outgoing" ? "Outgoing (to enemies)" : "Incoming (from enemies)"}
          </button>
        ))}
</div>

      <Panel
        title={
          direction === "outgoing"
            ? (tab === "Damage" ? "Squad Outgoing Condition Damage" : "Squad Outgoing Control Applications")
            : (tab === "Damage" ? "Squad Incoming Condition Damage" : "Squad Incoming Control Applications")
        }
        subtitle={
          tab === "Damage"
            direction === "outgoing"
              ? (tab === "Damage"
                  ? "Total damage dealt by each damaging condition (bleeding, burning, confusion, poison, torment) across all fights joined."
                  : "Total applications of each control condition (weakness, cripple, chill, immobilize, fear, taunt, slow, blind, vulnerability) landed on enemies.")
              : (tab === "Damage"
                  ? "Total damage received from each damaging condition (bleeding, burning, confusion, poison, torment) across all fights joined."
                  : "Total applications of each control condition (weakness, cripple, chill, immobilize, fear, taunt, slow, blind, vulnerability) received from enemies.")
        }
        icon={<Skull className="w-3.5 h-3.5" />}
      >
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={40}
                  tick={(props) => <ConditionIconTick {...props} icons={iconsByName} />}
                  stroke="rgba(255,255,255,0.10)"
                />
                <YAxis
                  tick={{ fill: "var(--entropy-text-muted)", fontSize: 10 }}
                  stroke="rgba(255,255,255,0.10)"
                  width={58}
                  tickFormatter={(value) => fmtCompact(Number(value))}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  formatter={(value, _name, item) => [`${fmtNum(Number(value))} ${unit}`, item?.payload?.name]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={selectedCondition === entry.name ? "var(--entropy-gold)" : BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-theme-muted">No {tab.toLowerCase()} condition data for this report.</div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedNames.map((name) => {
            const entry = summaryByName.get(name);
            if (!entry) return null;
            const selected = selectedCondition === name;
            const value = metricForTab(entry, tab);
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedName(name)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                  selected
                    ? "border-theme-accent/40 bg-theme-accent/10 text-theme-accent-strong"
                    : "border-theme-border bg-theme-surface-inset/55 text-theme-muted hover:border-theme-accent/20 hover:text-theme-text"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {entry.icon ? (
                    <img src={entry.icon} alt="" referrerPolicy="no-referrer" className="h-5 w-5 shrink-0 rounded-sm" />
                  ) : (
                    <Skull className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate text-xs font-semibold">{name}</span>
                </span>
                <span className="shrink-0 text-right font-mono text-[11px]">
                  <span className="block font-bold">{tab === "Control" ? fmtNum(value) : fmtCompact(value)}</span>
                  <span className="text-[9px] uppercase tracking-wider text-theme-faint">{entry.players} players</span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {selectedCondition && selectedSummary && (
        <Panel
          title={`${selectedCondition} Breakdown`}
          subtitle={
            tab === "Damage"
              ? "Per-player applications and damage dealt by this condition."
              : "Per-player application counts for this control effect."
          }
          icon={
            selectedSummary.icon ? (
              <img src={selectedSummary.icon} alt="" referrerPolicy="no-referrer" className="w-4 h-4 rounded-sm" />
            ) : (
              <Skull className="w-3.5 h-3.5" />
            )
          }
          action={`${detailRows.length} players`}
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-theme-border/60 text-[10px] uppercase tracking-wider text-theme-muted">
                  <th className="text-left font-bold px-4 py-3 sticky left-0 bg-theme-surface/95">
                    <button type="button" onClick={() => toggleSort("player")} className="inline-flex items-center gap-1">
                      Player <span className="text-[8px] opacity-70">{sortLabel("player")}</span>
                    </button>
                  </th>
                  <th className="text-left font-bold px-2 py-3">
                    <button type="button" onClick={() => toggleSort("class")} className="inline-flex items-center gap-1">
                      Class <span className="text-[8px] opacity-70">{sortLabel("class")}</span>
                    </button>
                  </th>
                  <th className="text-right font-bold px-2 py-3">
                    <button type="button" onClick={() => toggleSort("sample")} className="inline-flex items-center gap-1 justify-end w-full">
                      Sample <span className="text-[8px] opacity-70">{sortLabel("sample")}</span>
                    </button>
                  </th>
                  <th className="text-center font-bold px-3 py-3">
                    <button type="button" onClick={() => toggleSort("applications")} className="inline-flex items-center gap-1 justify-center w-full">
                      Applications <span className="text-[8px] opacity-70">{sortLabel("applications")}</span>
                    </button>
                  </th>
                  {tab === "Damage" && (
                    <th className="text-center font-bold px-3 py-3">
                      <button type="button" onClick={() => toggleSort("damage")} className="inline-flex items-center gap-1 justify-center w-full">
                        Damage <span className="text-[8px] opacity-70">{sortLabel("damage")}</span>
                      </button>
                    </th>
                  )}
                  <th
                    className="text-center font-bold px-3 py-3"
                    title="Estimated uptime on enemies, when target buff-state data is available"
                  >
                    <button type="button" onClick={() => toggleSort("uptime")} className="inline-flex items-center gap-1 justify-center w-full">
                      Uptime <span className="text-[8px] opacity-70">{sortLabel("uptime")}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((row, index) => (
                  <tr
                    key={row.account}
                    className={`border-b border-theme-border/40 hover:bg-theme-surface-elevated/55 transition-colors ${
                      index % 2 === 0 ? "bg-theme-surface-inset/20" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-semibold text-theme-text sticky left-0 bg-theme-surface/95 whitespace-nowrap">
                      {row.account}
                    </td>
                    <td className="px-2 py-2.5">
                      <ClassCell profession={row.profession} />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <PlayerSampleCell sample={row.sample} />
                    </td>
                    <td className="text-center px-3 py-2.5 font-mono font-bold text-theme-text">{fmtNum(row.applications)}</td>
                    {tab === "Damage" && (
                      <td className="text-center px-3 py-2.5 font-mono font-bold text-rose-400">{fmtCompact(row.damage)}</td>
                    )}
                    <td className="text-center px-3 py-2.5 font-mono text-theme-muted">
                      {row.uptimeMs !== undefined && row.totalFightMs
                        ? `${((row.uptimeMs / (row.totalFightMs || 1)) * 100).toFixed(0)}%`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
