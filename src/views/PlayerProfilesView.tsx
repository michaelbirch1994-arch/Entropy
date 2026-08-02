import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Panel from "../components/ui/Panel";
import { Users, Swords, Trophy, Sparkles } from "lucide-react";
import { getAllProfiles, topClass, type PlayerProfile } from "../lib/playerProfileStore";
import { fmtCompact, fmtFixedGrouped, fmtNum, profChip, profIcon } from "../utils/format";

type SortKey = "totalDamage" | "totalFightsJoined" | "bestDps" | "totalHealing" | "offensiveMvpCount";

export default function PlayerProfilesView() {
  const [profiles, setProfiles] = useState<PlayerProfile[] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("totalDamage");

  useEffect(() => {
    let cancelled = false;
    getAllProfiles().then((p) => {
      if (!cancelled) setProfiles(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    if (!profiles) return [];
    return [...profiles].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [profiles, sortKey]);

  if (profiles === null) {
    return <div className="flex items-center justify-center py-24 text-slate-500 text-sm">Loading career profiles...</div>;
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Player Profiles"
        subtitle="Career stats accumulated across every report you've loaded on this device"
        icon={<Users className="w-4 h-4" />}
        accent="text-sky-400"
        action={<span className="text-[10px] text-slate-500 font-mono">{profiles.length} players tracked</span>}
      >
        {profiles.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No career data yet - it builds up automatically as you load reports.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] mb-3">
              <span className="text-slate-500 font-bold uppercase tracking-wider">Sort by:</span>
              {([
                { k: "totalDamage", l: "Damage" },
                { k: "totalFightsJoined", l: "Fights" },
                { k: "bestDps", l: "Best DPS" },
                { k: "totalHealing", l: "Healing" },
                { k: "offensiveMvpCount", l: "MVPs" },
              ] as { k: SortKey; l: string }[]).map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setSortKey(opt.k)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                    sortKey === opt.k ? "bg-sky-500/15 text-sky-400" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                    <th className="p-2.5">Player</th>
                    <th className="p-2.5">Main Class</th>
                    <th className="p-2.5 text-right">Fights</th>
                    <th className="p-2.5 text-right">Total Damage</th>
                    <th className="p-2.5 text-right">Best DPS</th>
                    <th className="p-2.5 text-right">Total Healing</th>
                    <th className="p-2.5 text-right">Down Contrib</th>
                    <th className="p-2.5 text-right">MVPs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 font-mono">
                  {sorted.slice(0, 100).map((p, i) => {
                    const main = topClass(p);
                    const mvpTotal = p.offensiveMvpCount + p.defensiveMvpCount;
                    return (
                      <motion.tr
                        key={p.account}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25, delay: Math.min(i, 20) * 0.015 }}
                        className="hover:bg-blue-950/20 transition-colors"
                      >
                        <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                        <td className="p-2.5">
                          {main ? (
                            <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(main)}`}>
                              {profIcon(main) && <img src={profIcon(main)} alt={main} className="w-3.5 h-3.5 rounded-sm" />}
                              {main}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2.5 text-right text-slate-300">{fmtNum(p.totalFightsJoined)}</td>
                        <td className="p-2.5 text-right text-orange-400 font-bold">{fmtCompact(p.totalDamage)}</td>
                        <td className="p-2.5 text-right text-slate-200">{fmtFixedGrouped(p.bestDps, 0)}</td>
                        <td className="p-2.5 text-right text-emerald-400">{fmtCompact(p.totalHealing)}</td>
                        <td className="p-2.5 text-right text-sky-400">{fmtCompact(p.totalDownContrib)}</td>
                        <td className="p-2.5 text-right">
                          {mvpTotal > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                              <Trophy className="w-3 h-3" /> {mvpTotal}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <div className="flex items-center gap-2 text-[10px] text-slate-600 italic">
        <Sparkles className="w-3 h-3" />
        Career stats are stored locally in this browser and grow every time a new report is loaded here.
      </div>
    </div>
  );
}
