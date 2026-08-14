import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Panel from "../components/ui/Panel";
import { Users, Swords, Trophy, Sparkles, Flame } from "lucide-react";
import { getAllProfiles, topClass, computeBadges, currentWinStreak, type PlayerProfile } from "../lib/playerProfileStore";
import { fmtCompact, fmtFixedGrouped, fmtNum, profChip } from "../utils/format";
import ProfessionIcon from "../components/ui/ProfessionIcon";

type TableSortKey = "account" | "mainClass" | "totalFightsJoined" | "totalDamage" | "bestDps" | "totalHealing" | "totalDownContrib" | "mvpTotal";
type SortState = { key: TableSortKey; dir: "asc" | "desc" } | null;

export default function PlayerProfilesView() {
  const [profiles, setProfiles] = useState<PlayerProfile[] | null>(null);
  const [sort, setSort] = useState<SortState>(null);

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
    const base = [...profiles].sort((a, b) => a.account.localeCompare(b.account));
    if (!sort) return base;
    const dir = sort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      if (sort.key === "account") return a.account.localeCompare(b.account) * dir;
      if (sort.key === "mainClass") return (topClass(a) ?? "").localeCompare(topClass(b) ?? "") * dir || a.account.localeCompare(b.account);
      if (sort.key === "mvpTotal") {
        const av = a.offensiveMvpCount + a.defensiveMvpCount;
        const bv = b.offensiveMvpCount + b.defensiveMvpCount;
        return (av - bv) * dir || a.account.localeCompare(b.account);
      }
      return (a[sort.key] - b[sort.key]) * dir || a.account.localeCompare(b.account);
    });
  }, [profiles, sort]);

  const toggleSort = (key: TableSortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const sortLabel = (key: TableSortKey) => (!sort || sort.key !== key ? "SORT" : sort.dir === "desc" ? "DESC" : "ASC");

  const SortHeader = ({ label, k, align = "left" }: { label: string; k: TableSortKey; align?: "left" | "right" }) => (
    <th className={`p-2.5 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
          align === "right" ? "justify-end" : ""
        } ${sort?.key === k ? "text-theme-accent" : "text-theme-muted hover:text-theme-text"}`}
      >
        {label} <span className="text-[8px] opacity-70">{sortLabel(k)}</span>
      </button>
    </th>
  );

  if (profiles === null) {
    return <div className="flex items-center justify-center py-24 text-theme-muted text-sm">Loading career profiles...</div>;
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Player Profiles"
        subtitle="Career stats accumulated across every report you've loaded on this device"
        icon={<Users className="w-4 h-4" />}
        accent="text-theme-accent"
        action={<span className="text-[10px] text-theme-muted font-mono">{profiles.length} players tracked</span>}
      >
        {profiles.length === 0 ? (
          <div className="py-12 text-center text-sm text-theme-muted">
            No career data yet - it builds up automatically as you load reports.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] mb-3">
              <span className="text-theme-muted font-bold uppercase tracking-wider">Sort by:</span>
              {([
                { k: "totalDamage", l: "Damage" },
                { k: "totalFightsJoined", l: "Fights" },
                { k: "bestDps", l: "Best DPS" },
                { k: "totalHealing", l: "Healing" },
                { k: "mvpTotal", l: "MVPs" },
              ] as { k: TableSortKey; l: string }[]).map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setSort({ key: opt.k, dir: "desc" })}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                    sort?.key === opt.k ? "bg-theme-accent/15 text-theme-accent" : "text-theme-muted hover:text-theme-text"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="theme-data-table w-full text-left text-xs">
                <thead>
                  <tr className="theme-table-head text-[10px] uppercase font-bold tracking-wider">
                    <SortHeader label="Player" k="account" />
                    <SortHeader label="Main Class" k="mainClass" />
                    <SortHeader label="Fights" k="totalFightsJoined" align="right" />
                    <SortHeader label="Total Damage" k="totalDamage" align="right" />
                    <SortHeader label="Best DPS" k="bestDps" align="right" />
                    <SortHeader label="Total Healing" k="totalHealing" align="right" />
                    <SortHeader label="Down Contrib" k="totalDownContrib" align="right" />
                    <SortHeader label="MVPs" k="mvpTotal" align="right" />
                    <th className="p-2.5">Badges</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {sorted.slice(0, 100).map((p, i) => {
                    const main = topClass(p);
                    const mvpTotal = p.offensiveMvpCount + p.defensiveMvpCount;
                    return (
                      <motion.tr
                        key={p.account}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25, delay: Math.min(i, 20) * 0.015 }}
                        className="theme-table-row transition-colors"
                      >
                        <td className="p-2.5 text-theme-text font-semibold whitespace-nowrap">{p.account}</td>
                        <td className="p-2.5">
                          {main ? (
                            <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(main)}`}>
                              <ProfessionIcon profession={main} className="w-3.5 h-3.5" />
                              {main}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2.5 text-right text-theme-text/80">{fmtNum(p.totalFightsJoined)}</td>
                        <td className="p-2.5 text-right text-orange-400 font-bold">{fmtCompact(p.totalDamage)}</td>
                        <td className="p-2.5 text-right text-theme-text">{fmtFixedGrouped(p.bestDps, 0)}</td>
                        <td className="p-2.5 text-right text-emerald-400">{fmtCompact(p.totalHealing)}</td>
                        <td className="p-2.5 text-right text-sky-400">{fmtCompact(p.totalDownContrib)}</td>
                        <td className="p-2.5 text-right">
                          {mvpTotal > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                              <Trophy className="w-3 h-3" /> {mvpTotal}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                            {(() => {
                              const streak = currentWinStreak(p);
                              const badges = computeBadges(p);
                              if (streak < 3 && badges.length === 0) return <span className="text-slate-500">—</span>;
                              return (
                                <>
                                  {streak >= 3 && (
                                    <span
                                      title={`On a ${streak}-win streak`}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border border-orange-500/30 text-orange-400 bg-orange-500/10"
                                    >
                                      <Flame className="w-3 h-3" /> {streak}
                                    </span>
                                  )}
                                  {badges.map((b) => (
                                    <span
                                      key={b.id}
                                      title={b.detail}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-sky-500/30 text-sky-400 bg-sky-500/10"
                                    >
                                      {b.label}
                                    </span>
                                  ))}
                                </>
                              );
                            })()}
                          </div>
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

      <div className="flex items-center gap-2 text-[10px] text-theme-muted italic">
        <Sparkles className="w-3 h-3" />
        Career stats are stored locally in this browser and grow every time a new report is loaded here.
      </div>
    </div>
  );
}
