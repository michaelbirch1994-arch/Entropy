import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Panel from "../components/ui/Panel";
import { Users, Trophy, Sparkles, Flame, X } from "lucide-react";
import {
  getAllProfiles,
  topClass,
  computeBadges,
  currentWinStreak,
  longestWinStreak,
  currentMvpStreak,
  type PlayerProfile,
} from "../lib/playerProfileStore";
import { fmtCompact, fmtFixedGrouped, fmtNum, profChip } from "../utils/format";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from "../utils/chartTheme";

type TableSortKey = "account" | "mainClass" | "totalFightsJoined" | "totalDamage" | "bestDps" | "totalHealing" | "totalDownContrib" | "mvpTotal";
type SortState = { key: TableSortKey; dir: "asc" | "desc" } | null;

export default function PlayerProfilesView() {
  const [profiles, setProfiles] = useState<PlayerProfile[] | null>(null);
  const [sort, setSort] = useState<SortState>(null);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllProfiles().then((p) => {
      if (!cancelled) setProfiles(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const classOptions = useMemo(() => {
    if (!profiles) return [];
    const counts = new Map<string, number>();
    for (const p of profiles) {
      const c = topClass(p);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [profiles]);

  const filtered = useMemo(() => {
    if (!profiles) return [];
    if (classFilter === "all") return profiles;
    return profiles.filter((p) => topClass(p) === classFilter);
  }, [profiles, classFilter]);

  const sorted = useMemo(() => {
    const base = [...filtered].sort((a, b) => a.account.localeCompare(b.account));
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
  }, [filtered, sort]);

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

  // Top-12 chart of the currently filtered/sorted player pool by total
  // damage, so the visual leaderboard always matches whatever the table is
  // showing (respects the class filter) rather than a fixed global slice.
  const chartData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.totalDamage - a.totalDamage)
        .slice(0, 12)
        .map((p) => ({ account: p.account, totalDamage: p.totalDamage, mainClass: topClass(p) ?? "" })),
    [filtered],
  );

  const selectedProfile = profiles?.find((p) => p.account === selectedAccount) ?? null;

  if (profiles === null) {
    return <div className="flex items-center justify-center py-24 text-theme-muted text-sm">Loading career profiles...</div>;
  }

  return (
    <div className="theme-view-layout space-y-5 animate-view pb-12">
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
            <div className="flex flex-wrap items-center gap-2 text-[11px] mb-3">
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

            {classOptions.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] mb-4" role="group" aria-label="Filter by main class">
                <span className="text-theme-muted font-bold uppercase tracking-wider">Class:</span>
                <button
                  onClick={() => setClassFilter("all")}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                    classFilter === "all" ? "bg-theme-accent/15 text-theme-accent" : "text-theme-muted hover:text-theme-text"
                  }`}
                >
                  All
                </button>
                {classOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => setClassFilter(c)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                      classFilter === c ? "bg-theme-accent/15 text-theme-accent" : "text-theme-muted hover:text-theme-text"
                    }`}
                  >
                    <ProfessionIcon profession={c} className="w-3.5 h-3.5" />
                    {c}
                  </button>
                ))}
              </div>
            )}

            <div className="theme-table-shell overflow-x-auto custom-scrollbar">
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
                        onClick={() => setSelectedAccount((cur) => (cur === p.account ? null : p.account))}
                        className={`theme-table-row transition-colors cursor-pointer ${selectedAccount === p.account ? "bg-theme-accent/[0.08]" : ""}`}
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

      {profiles.length > 0 && chartData.length > 0 && (
        <Panel
          title="Damage Leaderboard"
          subtitle="Top career damage totals for the currently filtered player pool. Click a bar to open that player's profile."
          icon={<Trophy className="w-4 h-4" />}
          accent="text-orange-400"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="account" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" width={44} tickFormatter={(v) => fmtCompact(Number(v))} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  formatter={(v) => [fmtCompact(Number(v)), "Total damage"]}
                />
                <Bar
                  dataKey="totalDamage"
                  radius={[3, 3, 0, 0]}
                  onClick={(d: any) => setSelectedAccount(d?.payload?.account ?? d?.account ?? null)}
                  cursor="pointer"
                >
                  {chartData.map((d) => (
                    <Cell key={d.account} fill={d.account === selectedAccount ? CHART_COLORS.orange : CHART_COLORS.amber} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {selectedProfile && (
        <Panel
          title={`${selectedProfile.account} · Career Dossier`}
          icon={<Users className="w-4 h-4" />}
          accent="text-theme-accent"
          action={
            <button
              type="button"
              onClick={() => setSelectedAccount(null)}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-theme-muted hover:text-theme-text"
            >
              <X className="w-3 h-3" /> Close
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ProfileMetric label="Reports seen" value={fmtNum(selectedProfile.reportsSeen)} />
            <ProfileMetric label="Fights joined" value={fmtNum(selectedProfile.totalFightsJoined)} />
            <ProfileMetric label="Total damage" value={fmtCompact(selectedProfile.totalDamage)} tone="text-orange-400" />
            <ProfileMetric label="Best DPS" value={fmtFixedGrouped(selectedProfile.bestDps, 0)} />
            <ProfileMetric label="Total healing" value={fmtCompact(selectedProfile.totalHealing)} tone="text-emerald-400" />
            <ProfileMetric label="Total barrier" value={fmtCompact(selectedProfile.totalBarrier)} tone="text-emerald-300" />
            <ProfileMetric label="Down contribution" value={fmtCompact(selectedProfile.totalDownContrib)} tone="text-sky-400" />
            <ProfileMetric label="Boon strips" value={fmtCompact(selectedProfile.totalStrips)} tone="text-cyan-300" />
            <ProfileMetric label="Condi cleanses" value={fmtCompact(selectedProfile.totalCleanses)} tone="text-cyan-300" />
            <ProfileMetric label="MVP awards" value={String(selectedProfile.offensiveMvpCount + selectedProfile.defensiveMvpCount)} tone="text-amber-400" />
            <ProfileMetric label="Current win streak" value={String(currentWinStreak(selectedProfile))} tone="text-orange-300" />
            <ProfileMetric label="Longest win streak" value={String(longestWinStreak(selectedProfile))} tone="text-orange-300" />
            <ProfileMetric label="Current MVP streak" value={String(currentMvpStreak(selectedProfile))} tone="text-amber-300" />
          </div>

          <div className="mt-5">
            <div className="text-[10px] font-black uppercase tracking-wider text-theme-muted mb-2">Classes played</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedProfile.classCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([cls, count]) => (
                  <span
                    key={cls}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border ${profChip(cls)}`}
                  >
                    <ProfessionIcon profession={cls} className="w-3.5 h-3.5" />
                    {cls} <span className="opacity-70">×{count}</span>
                  </span>
                ))}
            </div>
          </div>

          {computeBadges(selectedProfile).length > 0 && (
            <div className="mt-5">
              <div className="text-[10px] font-black uppercase tracking-wider text-theme-muted mb-2">Badges</div>
              <div className="flex flex-wrap gap-2">
                {computeBadges(selectedProfile).map((b) => (
                  <span
                    key={b.id}
                    title={b.detail}
                    className="px-2 py-1 rounded text-[10px] font-bold border border-sky-500/30 text-sky-400 bg-sky-500/10"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      <div className="flex items-center gap-2 text-[10px] text-theme-muted italic">
        <Sparkles className="w-3 h-3" />
        Career stats are stored locally in this browser and grow every time a new report is loaded here.
      </div>
    </div>
  );
}

function ProfileMetric({ label, value, tone = "text-theme-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border-l-2 border-theme-accent/30 bg-black/25 px-3 py-2">
      <div className="text-[9px] font-black uppercase tracking-wider text-theme-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${tone}`}>{value}</div>
    </div>
  );
}
