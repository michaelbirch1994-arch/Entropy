import { useReport } from "../store/ReportContext";
import { profChip, fmtNum } from "../utils/format";
import Panel from "../components/ui/Panel";
import { Percent } from "lucide-react";

export default function DamageModifiersView() {
  const { report } = useReport();
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
              <p className="text-[11px] text-slate-600 mt-1">
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

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Damage Modifiers"
        subtitle="Bonus damage each player gained from traits, sigils, runes and skill-based modifiers - summed across every fight"
        icon={<Percent className="w-3.5 h-3.5" />}
        action={`${rows.length} players`}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-amber-500/10 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-bold px-4 py-3 sticky left-0 bg-[#0a0e1f]/95">Player</th>
                <th className="text-left font-bold px-2 py-3">Class</th>
                {columns.map((c) => (
                  <th key={c.id} className="text-center font-bold px-2 py-3 min-w-[72px]" title={c.name}>
                    <div className="flex flex-col items-center gap-1">
                      {c.icon ? (
                        <img src={c.icon} alt={c.name} className="w-4 h-4 rounded-sm" loading="lazy" />
                      ) : (
                        <span className="w-4 h-4" />
                      )}
                      <span className="normal-case font-semibold text-slate-400 text-center leading-tight">{c.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.account}
                  className={`border-b border-slate-800/40 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-200 sticky left-0 bg-[#0a0e1f]/95 whitespace-nowrap">
                    {row.account}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${profChip(row.profession)}`}>
                      {row.profession}
                    </span>
                  </td>
                  {columns.map((c) => {
                    const v = row.values[c.id];
                    return (
                      <td key={c.id} className="text-center px-2 py-2.5 font-mono">
                        {v ? (
                          <span className="font-bold text-amber-400">{fmtNum(v.damage)}</span>
                        ) : (
                          <span className="text-slate-700">-</span>
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
