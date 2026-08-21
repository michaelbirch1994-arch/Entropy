import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { profChip, relativeStackColor } from "../utils/format";
import Panel from "../components/ui/Panel";
import { Sparkles } from "lucide-react";
import type { BoonUptimeData } from "../types/report";
import { BUFF_TAB_ORDER } from "../lib/bridge-metrics/boonGeneration";
import PlayerSampleCell from "../components/ui/PlayerSampleCell";
import { resolvePlayerSampleContext } from "../lib/playerSampleContext";

function uptimeColor(pct: number): string {
  if (pct >= 90) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  if (pct > 0) return "text-orange-400/80";
  return "text-theme-muted";
}

// Tab order mirrors dps.report's Buffs sub-tabs. Shared with Buff Generation
// (BUFF_TAB_ORDER) so the two pages can never present these categories in a
// different order from each other.
const TAB_ORDER = BUFF_TAB_ORDER;
type SortKey = "player" | "class" | "sample" | number;
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export default function BuffsView() {
  const { report } = useReport();
  const [tab, setTab] = useState<string>("Boons");
  const [sort, setSort] = useState<SortState>(null);
  if (!report) return null;
  const s = report.stats;

  const categories = s.buffCategoryUptimes ?? (s.boonUptimes ? { Boons: s.boonUptimes } : {});
  const tabs = useMemo(
    () => TAB_ORDER.filter((t) => categories[t] && categories[t].columns.length > 0 && categories[t].rows.length > 0),
    [categories],
  );
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const data: BoonUptimeData | undefined = activeTab ? categories[activeTab] : undefined;

  if (!data || data.columns.length === 0 || data.rows.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Buffs"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-theme-muted">
              No buff uptime data available for this report.
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  const { columns, rows } = data;
  const sortedRows = (() => {
    const base = Array.from(new Map(rows.map((r) => [r.account, r])).values())
      .map((row) => ({
        ...row,
        sample: resolvePlayerSampleContext(s.generalPlayers, s.total, row.account, { fights: row.logsJoined }),
      }))
      .sort((a, b) => a.account.localeCompare(b.account));
    if (!sort) return base;
    const dir = sort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      if (sort.key === "player") return a.account.localeCompare(b.account) * dir;
      if (sort.key === "class") return a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account);
      if (sort.key === "sample") return (a.sample.fights - b.sample.fights) * dir || a.account.localeCompare(b.account);
      if (typeof sort.key !== "number") return 0;
      const av = a.uptimes[sort.key];
      const bv = b.uptimes[sort.key];
      const an = Number.isFinite(av) ? Number(av) : -Infinity;
      const bn = Number.isFinite(bv) ? Number(bv) : -Infinity;
      return (an - bn) * dir || a.account.localeCompare(b.account);
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
      sort?.key === key ? "text-theme-accent-strong" : "text-theme-muted hover:text-theme-text"
    } ${extra}`;

  // Precompute each stacking column's values once so relativeStackColor doesn't
  // rescan every row for every cell (O(players * columns) instead of squared).
  // Plain computation, not useMemo: this sits after the "no buff data" early
  // return above, so a hook here would change hook order between renders.
  const columnValuesById: Record<string, Array<number | undefined>> = {};
  for (const c of columns) {
    if (!c.stacking) continue;
    columnValuesById[c.id] = sortedRows.map((r) => r.uptimes[c.id]);
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
                setSort(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                activeTab === t
                  ? "bg-theme-accent/10 border-theme-accent/40 text-theme-accent-strong"
                  : "bg-theme-surface border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-accent/20"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <Panel
        title={activeTab}
        subtitle="Duration buffs show % of the fight held; intensity-stacking buffs like Might and Stability show average stacks across every fight joined"
        icon={<Sparkles className="w-3.5 h-3.5" />}
        action={`${sortedRows.length} players`}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-theme-border/60 text-[10px] uppercase tracking-wider text-theme-muted">
                <th className="text-left font-bold px-4 py-3 sticky left-0 bg-theme-surface/95">
                  <button type="button" onClick={() => toggleSort("player")} className={sortButtonClass("player")}>
                    Player <span className="text-[8px] opacity-70">{sortLabel("player")}</span>
                  </button>
                </th>
                <th className="text-left font-bold px-2 py-3">
                  <button type="button" onClick={() => toggleSort("class")} className={sortButtonClass("class")}>
                    Class <span className="text-[8px] opacity-70">{sortLabel("class")}</span>
                  </button>
                </th>
                <th className="text-right font-bold px-2 py-3">
                  <button type="button" onClick={() => toggleSort("sample")} className={sortButtonClass("sample", "justify-end w-full")}>
                    Sample <span className="text-[8px] opacity-70">{sortLabel("sample")}</span>
                  </button>
                </th>
                {columns.map((c) => (
                  <th key={c.id} className="text-center font-bold px-2 py-3 min-w-[64px]" title={c.name}>
                    <button type="button" onClick={() => toggleSort(c.id)} className={sortButtonClass(c.id, "flex w-full flex-col items-center")}>
                      {c.icon ? (
                        <img src={c.icon} alt={c.name} className="w-4 h-4 rounded-sm" loading="lazy" />
                      ) : (
                        <span className="w-4 h-4" />
                      )}
                      <span className="normal-case font-semibold">{c.name} <span className="text-[8px] opacity-70">{sortLabel(c.id)}</span></span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr
                  key={row.account}
                  className={`border-b border-theme-border/40 hover:bg-theme-surface-elevated/55 transition-colors ${i % 2 === 0 ? "bg-theme-surface-inset/20" : ""}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-theme-text sticky left-0 bg-theme-surface/95 whitespace-nowrap">
                    {row.account}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(row.profession)}`}>
                      {row.profession}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <PlayerSampleCell sample={row.sample} />
                  </td>
                  {columns.map((c) => {
                    const val = row.uptimes[c.id];
                    // Stacking buffs don't share a 0-100% scale (Might and Stability cap at 25,
                    // most conditions have no practical
                    // cap), so they're colored relative to this column's own
                    // values rather than against the duration-buff thresholds.
                    const color = c.stacking
                      ? relativeStackColor(val, columnValuesById[c.id])
                      : uptimeColor(val ?? 0);
                    return (
                      <td key={c.id} className="text-center px-2 py-2.5 font-mono">
                        <span className={`font-bold ${color}`}>
                          {val === undefined ? "-" : c.stacking ? val.toFixed(1) : `${val.toFixed(0)}%`}
                        </span>
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
