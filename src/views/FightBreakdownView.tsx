import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { fmtCompact } from "../utils/format";
import { Swords, ExternalLink } from "lucide-react";
import type { FightRow } from "../types/report";

type SortKey = "fight" | "map" | "duration" | "outcome" | "squad" | "enemies" | "kills" | "deaths" | "outDamage" | "inDamage" | "strips";
type SortState = { key: SortKey; dir: "desc" | "asc" } | null;

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
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<SortState>(null);
  const s = report?.stats;
  const fights = s?.fightBreakdown ?? [];
  const sortedFights = useMemo(() => {
    const base = fights.map((fight, index) => ({ fight, index }));
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
        default: return row.index;
      }
    };
    return [...base].sort((a, b) => compareValues(valueFor(a), valueFor(b), sort.dir) || a.index - b.index);
  }, [fights, sort]);
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

  if (!s) return null;

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Fight Breakdown"
        icon={<Swords className="w-4 h-4" />}
        accent="text-blue-500"
        action={<span>{fights.length} FIGHTS</span>}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/40">
                <SortHeader k="fight">#</SortHeader>
                <th className="p-2.5 font-medium">Fight</th>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {shown.map(({ fight: f, index }) => (
                <tr key={f.id} className="hover:bg-blue-950/20 transition-colors">
                  <td className="p-2.5 text-slate-500">{index + 1}</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-semibold">{f.label}</span>
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

      {/* Damage per fight chart */}
      <Panel title="Damage Per Fight" icon={<Swords className="w-4 h-4" />} accent="text-orange-400">
        <div className="space-y-2">
          {(() => {
            const maxDmg = fights.reduce((m, x) => Math.max(m, x.totalOutgoingDamage), 1);
            return shown.map(({ fight: f }) => {
            const pct = (f.totalOutgoingDamage / maxDmg) * 100;
            return (
              <div key={f.id} className="flex items-center gap-3 text-[11px] font-mono">
                <span className="w-16 text-slate-500 flex-shrink-0">{f.label}</span>
                <div className="flex-1 h-5 bg-slate-800/40 rounded overflow-hidden relative">
                  <div
                    className={`h-full rounded transition-all duration-500 ${f.isWin ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-orange-600 to-orange-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-slate-300 flex-shrink-0">{fmtCompact(f.totalOutgoingDamage)}</span>
              </div>
            );
          });
          })()}
        </div>
      </Panel>
    </div>
  );
}
