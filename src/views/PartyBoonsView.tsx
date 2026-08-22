import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { profChip } from "../utils/format";
import { getBoonMetricValue, BUFF_TAB_ORDER } from "../lib/bridge-metrics/boonGeneration";
import { Users, Sparkles } from "lucide-react";

// Groups each player's boon GENERATION (not uptime - what they produced, not
// what they had) by their in-game subgroup, so a commander/reviewer can see
// at a glance which party is covered on a given boon and which isn't.
//
// Uses the "groupBuffs" category from boonGeneration.ts, which Elite Insights
// already scopes to "this player's output onto their own party, excluding
// themselves" - exactly the subgroup-relevant number, as opposed to
// "squadBuffs" (whole squad) or "selfBuffs" (only themselves). Party
// assignment itself comes from attendanceData (the same source RosterView
// uses to build its party cards) since the buffGeneration tables don't carry
// a group field.
export default function PartyBoonsView() {
  const { report } = useReport();
  const tables = report?.stats.buffGeneration ?? [];
  const attendance = report?.stats.attendanceData ?? [];
  const [tab, setTab] = useState<string>("Boons");

  const tabs = useMemo(
    () => BUFF_TAB_ORDER.filter((t) => tables.some((table) => table.classification === t)),
    [tables],
  );
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const activeTables = useMemo(
    () => [...tables].filter((t) => t.classification === activeTab).sort((a, b) => a.name.localeCompare(b.name)),
    [tables, activeTab],
  );

  // account -> { group, profession, characterName }. Attendance is the only
  // place party/group is recorded, so it's the source of truth here even
  // though the boon tables are keyed by account too.
  const accountMeta = useMemo(() => {
    const map = new Map<string, { group: number; profession: string; characterName: string }>();
    attendance.forEach((row) => {
      const group = Number.isFinite(Number(row.group)) && Number(row.group) > 0 ? Number(row.group) : 0;
      const profession = row.classTimes?.[0]?.profession ?? "Unknown";
      map.set(row.account, { group, profession, characterName: row.characterNames?.[0] ?? row.account });
    });
    return map;
  }, [attendance]);

  // account -> boonId -> groupBuffs value, scoped to the active classification tab.
  const valuesByAccount = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    activeTables.forEach((table) => {
      table.rows.forEach((row) => {
        const value = getBoonMetricValue(row, "groupBuffs", table.stacking, "uptime");
        if (!map.has(row.account)) map.set(row.account, new Map());
        map.get(row.account)!.set(table.id, value);
      });
    });
    return map;
  }, [activeTables]);

  const partyGroups = useMemo(() => {
    const groups = new Map<number, string[]>();
    attendance.forEach((row) => {
      const group = accountMeta.get(row.account)?.group ?? 0;
      const list = groups.get(group) ?? [];
      list.push(row.account);
      groups.set(group, list);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
      .map(([group, accounts]) => ({
        group,
        accounts: [...accounts].sort((a, b) => {
          const profA = accountMeta.get(a)?.profession ?? "";
          const profB = accountMeta.get(b)?.profession ?? "";
          return profA.localeCompare(profB) || a.localeCompare(b);
        }),
      }));
  }, [attendance, accountMeta]);

  if (!report) return null;

  if (tables.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel title="Party Boons" icon={<Users className="w-3.5 h-3.5" />}>
          <div className="py-10 text-center text-sm text-slate-500">
            No boon generation data available for this report.
            <p className="text-[11px] text-slate-500 mt-1">
              Only populated for reports built from raw dps.report / .zevtc imports.
            </p>
          </div>
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
              onClick={() => setTab(t)}
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
        title={`${activeTab} by Subgroup`}
        subtitle="Each cell is how much of that boon a player generated to their own party, excluding themselves - not squad-wide output. Dashes mean no recorded generation for that player/boon."
        icon={<Users className="w-3.5 h-3.5" />}
        bodyClassName="p-0"
      >
        {activeTables.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No {activeTab.toLowerCase()} generation recorded for this report.</div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {partyGroups.map(({ group, accounts }) => (
              <div key={group || "unknown"} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                    {group > 0 ? `Party ${group}` : "Unassigned"}
                  </span>
                  <span className="rounded-md border border-slate-700/70 bg-slate-950/60 px-2 py-0.5 text-[10px] font-mono text-slate-500">
                    {accounts.length}
                  </span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="p-2 font-medium sticky left-0 bg-[#0a0e1f]">Player</th>
                        {activeTables.map((table) => (
                          <th key={table.id} className="p-2 font-medium text-center min-w-[64px]">
                            <div className="flex flex-col items-center gap-1">
                              {table.icon ? (
                                <img src={table.icon} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-sm" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                              <span className="max-w-[64px] truncate">{table.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {accounts.map((account) => {
                        const meta = accountMeta.get(account);
                        const values = valuesByAccount.get(account);
                        const rowValues = activeTables.map((table) => values?.get(table.id) ?? 0);
                        const maxInRow = Math.max(...rowValues, 0);
                        return (
                          <tr key={account} className="border-t border-slate-800/40 hover:bg-white/[0.02] transition-colors">
                            <td className="p-2 sticky left-0 bg-[#0a0e1f]/95">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center rounded border pt-0.5 pr-0.5 pb-0.5 pl-1 ${profChip(meta?.profession ?? "Unknown")}`}>
                                  <ProfessionIcon profession={meta?.profession ?? "Unknown"} className="h-3.5 w-3.5 shrink-0" />
                                </span>
                                <span className="truncate text-slate-200 font-semibold">{meta?.characterName ?? account}</span>
                              </div>
                            </td>
                            {activeTables.map((table, i) => {
                              const value = rowValues[i];
                              const isTop = value > 0 && value === maxInRow;
                              return (
                                <td key={table.id} className="p-2 text-center">
                                  <span className={value > 0 ? (isTop ? "text-emerald-300 font-bold" : "text-slate-300") : "text-slate-700"}>
                                   {value > 0 ? (table.stacking ? value.toFixed(2) : `${value.toFixed(0)}%`) : "-"}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
