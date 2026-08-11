import { useMemo, useState } from "react";
import { X, Swords, Users, Shield, Crosshair, ExternalLink } from "lucide-react";
import { extractFightPlayers, type RawFightLog, type RawFightSummary } from "../../types/rawFight";
import { fmtCompact, profChip } from "../../utils/format";
import StatCard from "./StatCard";
import Panel from "./Panel";
import ClassIcon from "./ClassIcon";

type SortKey = "dps" | "damage" | "damageTaken" | "downCount" | "deadCount" | "cleanses" | "strips" | "resurrects";

interface RawFightViewerProps {
  summary: RawFightSummary;
  log: RawFightLog;
  onClose: () => void;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "dps", label: "DPS" },
  { key: "damage", label: "Damage" },
  { key: "damageTaken", label: "Dmg Taken" },
  { key: "downCount", label: "Downs" },
  { key: "deadCount", label: "Deaths" },
  { key: "cleanses", label: "Cleanses" },
  { key: "strips", label: "Strips" },
  { key: "resurrects", label: "Rezzes" },
];

export default function RawFightViewer({ summary, log, onClose }: RawFightViewerProps) {
  const players = useMemo(() => extractFightPlayers(log), [log]);
  const [sortKey, setSortKey] = useState<SortKey>("dps");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const squad = useMemo(() => players.filter((p) => !p.notInSquad), [players]);

  const sorted = useMemo(() => {
    const arr = [...squad];
    arr.sort((a, b) => (sortDir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return arr;
  }, [squad, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const totalDamage = squad.reduce((s, p) => s + p.damage, 0);
  const totalDownsTaken = squad.reduce((s, p) => s + p.downCount, 0);
  const avgDps = squad.length ? Math.round(squad.reduce((s, p) => s + p.dps, 0) / squad.length) : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-5xl bg-[#070a1c] border border-amber-500/15 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-amber-500/10 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-400/70">
              <Swords className="w-3.5 h-3.5" /> Raw Fight &middot; Viewed in Entropy
            </div>
            <h2 className="text-xl font-black text-slate-100 mt-1">{summary.fightName}</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {summary.timeStart ? `${summary.timeStart} - ` : ""}
              {summary.duration}
              {" - "}
              <span className={summary.success ? "text-emerald-400" : "text-rose-400"}>
                {summary.success ? "Success" : "Failed"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {summary.permalink && (
              <a
                href={`https://dps.report/${summary.permalink}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-amber-400 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-amber-500/30 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3 h-3" /> dps.report
              </a>
            )}
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6">
          <StatCard label="Squad Size" value={squad.length} icon={<Users className="w-3.5 h-3.5" />} />
          <StatCard
            label="Squad Damage"
            value={fmtCompact(totalDamage)}
            icon={<Crosshair className="w-3.5 h-3.5" />}
            accent="text-amber-400"
          />
          <StatCard label="Avg DPS" value={fmtCompact(avgDps)} icon={<Swords className="w-3.5 h-3.5" />} />
          <StatCard
            label="Downs Taken"
            value={totalDownsTaken}
            icon={<Shield className="w-3.5 h-3.5" />}
            accent="text-rose-400"
          />
        </div>

        {/* Player table */}
        <div className="px-6 pb-6">
          <Panel
            title="Squad Breakdown"
            subtitle={`${squad.length} squad player${squad.length === 1 ? "" : "s"} parsed from this fight`}
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                    <th className="px-3 py-2.5 font-medium">Player</th>
                    <th className="px-3 py-2.5 font-medium">Class</th>
                    <th className="px-3 py-2.5 font-medium text-center">Grp</th>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        onClick={() => toggleSort(c.key)}
                        className={`px-3 py-2.5 font-medium text-right cursor-pointer select-none hover:text-amber-400 transition-colors ${
                          sortKey === c.key ? "text-amber-400" : ""
                        }`}
                      >
                        {c.label}
                        {sortKey === c.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 font-mono">
                  {sorted.map((p) => (
                    <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                      <td className="px-3 py-2 text-slate-200 font-semibold whitespace-nowrap">
                        {p.name}
                        {p.hasCommanderTag && (
                          <span className="ml-1.5 text-amber-400" title="Commander">
                            &#9733;
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(p.profession)}`}>
                          <ClassIcon name={p.profession} size="xs" />
                          {p.profession}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-500">{p.group || "-"}</td>
                      <td className="px-3 py-2 text-right text-slate-100 font-bold">{fmtCompact(p.dps)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{fmtCompact(p.damage)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{fmtCompact(p.damageTaken)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{p.downCount}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{p.deadCount}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{p.cleanses}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{p.strips}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{p.resurrects}</td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                        No squad player stats found in this log.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="text-[10px] text-slate-500 mt-3 text-center">
            Parsed directly from Elite Insights via dps.report &mdash; not yet combined with other fights into a full raid report.
          </p>
        </div>
      </div>
    </div>
  );
}
