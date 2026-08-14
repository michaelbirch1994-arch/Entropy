import { useState } from "react";
import { useReport } from "../store/ReportContext";
import { profChip, fmtNum } from "../utils/format";
import Panel from "../components/ui/Panel";
import { Percent, CircleCheck } from "lucide-react";
import type { DamageModifierColumn } from "../types/report";

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
  underEffect: "text-sky-400",
  counter: "text-slate-400",
};

const KIND_DOT: Record<string, string> = {
  gain: "bg-amber-500",
  underEffect: "bg-sky-500",
  counter: "bg-slate-500",
};

type SortKey = "player" | "class" | number;
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export default function DamageModifiersView() {
  const { report } = useReport();
  const [sort, setSort] = useState<SortState>(null);
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
  const sortedRows = (() => {
    const base = [...rows].sort((a, b) => a.account.localeCompare(b.account) || a.profession.localeCompare(b.profession));
    if (!sort) return base;
    const dir = sort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      if (sort.key === "player") return a.account.localeCompare(b.account) * dir || a.profession.localeCompare(b.profession);
      if (sort.key === "class") return a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account);
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
        title="Damage Modifiers"
        subtitle="Which traits/sigils/runes fired for each player, and how much damage each one contributed - summed across every fight"
        icon={<Percent className="w-3.5 h-3.5" />}
        action={`${sortedRows.length} players`}
        bodyClassName="p-0"
      >
        <div className="px-4 pt-4 pb-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] text-slate-500">
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
          <p className="text-[10px] text-slate-500 leading-relaxed max-w-3xl">
            A number in a cell means that player measurably triggered that modifier at least once - a fair proxy for
            "has this trait/sigil active." A dash means it never fired for them this session; the raw combat log
            doesn't include full gear/trait loadouts, so a dash usually means they don't run it, but could also mean
            the condition just never came up in these fights. Hover a column header for its full description and how
            many of the tracked players triggered it. If someone played more than one class across the combined
            fights, they get one row per class - so their traits/relics/sigils never mix between builds.
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
                {columns.map((c) => {
                  const kind = kindOf(c);
                  const tooltip = [c.name, c.description, `${KIND_LABEL[kind]}`, `${c.playersWithIt} player${c.playersWithIt === 1 ? "" : "s"} triggered this`]
                    .filter(Boolean)
                    .join(" — ");
                  return (
                    <th key={c.id} className="text-center font-bold px-2 py-3 min-w-[76px]" title={tooltip}>
                      <button type="button" onClick={() => toggleSort(c.id)} className={sortButtonClass(c.id, "flex w-full flex-col items-center")}>
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
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(row.profession)}`}>
                      {row.profession}
                    </span>
                  </td>
                  {columns.map((c) => {
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
