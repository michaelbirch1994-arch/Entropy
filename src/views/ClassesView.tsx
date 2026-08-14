import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { profStyle } from "../utils/format";
import type { ClassSlice } from "../types/report";
import { Layers, Users } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE } from "../utils/chartTheme";
import ClassIcon from "../components/ui/ClassIcon";

type RoleSortKey = "account" | "profession" | "role" | "supportScore" | "confidenceScore";
type RoleSortState = { key: RoleSortKey; dir: "asc" | "desc" } | null;

function ClassList({ data, total }: { data: ClassSlice[]; total: number }) {
  return (
    <div className="space-y-2">
      {data.map((c) => {
        const pct = total > 0 ? (c.value / total) * 100 : 0;
        const s = profStyle(c.name);
        return (
          <div key={c.name} className="flex items-center gap-3">
            <div className={`h-6 w-6 rounded-md border ${s.border} ${s.bg} flex flex-shrink-0 items-center justify-center`}>
              <ClassIcon name={c.name} size="sm" />
            </div>
            <span className="text-xs font-semibold text-slate-300 w-28 flex-shrink-0">{c.name}</span>
            <div className="flex-1 h-5 bg-slate-800/40 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: c.color }}
              >
                {pct > 10 && <span className="text-[10px] font-bold text-black/70">{c.value}</span>}
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400 w-10 text-right">{c.value}</span>
            <span className="text-[10px] font-mono text-slate-500 w-12 text-right">{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ClassesView() {
  const { report } = useReport();
  const [roleSort, setRoleSort] = useState<RoleSortState>(null);
  const s = report?.stats;
  const roleRows = useMemo(() => {
    const base = [...(s?.roleClassifications ?? [])].sort((a, b) => a.account.localeCompare(b.account));
    if (!roleSort) return base;
    const dir = roleSort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      if (roleSort.key === "account") return a.account.localeCompare(b.account) * dir;
      if (roleSort.key === "profession") return a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account);
      if (roleSort.key === "role") return a.role.localeCompare(b.role) * dir || a.account.localeCompare(b.account);
      return (a[roleSort.key] - b[roleSort.key]) * dir || a.account.localeCompare(b.account);
    });
  }, [s?.roleClassifications, roleSort]);

  const toggleRoleSort = (key: RoleSortKey) => {
    setRoleSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const roleSortLabel = (key: RoleSortKey) => (!roleSort || roleSort.key !== key ? "SORT" : roleSort.dir === "desc" ? "DESC" : "ASC");

  const RoleSortHeader = ({ label, k, align = "left" }: { label: string; k: RoleSortKey; align?: "left" | "right" }) => (
    <th className={`px-2 py-2 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => toggleRoleSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
          align === "right" ? "justify-end" : ""
        } ${roleSort?.key === k ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"}`}
      >
        {label} <span className="text-[8px] opacity-70">{roleSortLabel(k)}</span>
      </button>
    </th>
  );

  if (!report || !s) return null;
  const squadTotal = s.squadClassData.reduce((a, c) => a + c.value, 0);
  const enemyTotal = s.enemyClassData.reduce((a, c) => a + c.value, 0);

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Squad composition */}
        <Panel title="Squad Composition" icon={<Users className="w-4 h-4" />} accent="text-sky-400" action={`${squadTotal} slots`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.squadClassData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {s.squadClassData.map((c) => (
                      <Cell key={c.name} fill={c.color} stroke="#0a101f" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2">
              <ClassList data={s.squadClassData} total={squadTotal} />
            </div>
          </div>
        </Panel>

        {/* Enemy composition */}
        <Panel title="Enemy Composition" icon={<Layers className="w-4 h-4" />} accent="text-rose-400" action={`${enemyTotal} slots`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.enemyClassData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {s.enemyClassData.map((c) => (
                      <Cell key={c.name} fill={c.color} stroke="#0a101f" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2">
              <ClassList data={s.enemyClassData} total={enemyTotal} />
            </div>
          </div>
        </Panel>
      </div>

      {/* Role classifications */}
      <Panel title="Role Classifications" icon={<Users className="w-4 h-4" />} accent="text-emerald-400">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                <RoleSortHeader label="Player" k="account" />
                <RoleSortHeader label="Class" k="profession" />
                <RoleSortHeader label="Role" k="role" />
                <RoleSortHeader label="Score" k="supportScore" align="right" />
                <RoleSortHeader label="Confidence" k="confidenceScore" align="right" />
                <th className="px-2 py-2">Key Factors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {roleRows.slice(0, 20).map((r) => {
                const roleColor =
                  r.role === "support" ? "text-emerald-400 bg-emerald-950/40 border-emerald-500/30"
                  : r.role === "damage" ? "text-orange-400 bg-orange-950/40 border-orange-500/30"
                  : "text-slate-400 bg-slate-800/40 border-slate-600/30";
                return (
                  <tr key={r.account} className="hover:bg-blue-950/20 transition-colors">
                    <td className="px-2 py-2 text-slate-200 font-semibold">{r.account}</td>
                    <td className="px-2 py-2 text-slate-400">{r.profession}</td>
                    <td className="px-2 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleColor} uppercase`}>
                        {r.role}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-slate-300">{r.supportScore.toFixed(1)}</td>
                    <td className="px-2 py-2 text-right text-slate-500">{(r.confidenceScore * 100).toFixed(0)}%</td>
                    <td className="px-2 py-2 text-[10px] text-slate-500">
                      {r.factors.slice(0, 2).map((f) => f.metric).join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
