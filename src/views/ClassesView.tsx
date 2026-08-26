import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Layers, Search, ShieldCheck, Swords, Users } from "lucide-react";
import BoundedDataRegion from "../components/ui/BoundedDataRegion";
import ClassIcon from "../components/ui/ClassIcon";
import Panel from "../components/ui/Panel";
import { buildCompositionComparison, summarizeProfessionPresence } from "../lib/compositionInsights";
import { useReport } from "../store/ReportContext";
import { profStyle } from "../utils/format";

type RoleFilter = "all" | "support" | "damage" | "review";

export default function ClassesView() {
  const { report } = useReport();
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [roleQuery, setRoleQuery] = useState("");
  const stats = report?.stats;
  const squadData = stats?.squadClassData ?? [];
  const enemyData = stats?.enemyClassData ?? [];
  const comparisonRows = useMemo(() => buildCompositionComparison(squadData, enemyData), [enemyData, squadData]);
  const allRoleRows = useMemo(
    () => [...(stats?.roleClassifications ?? [])].sort((a, b) => a.confidenceScore - b.confidenceScore || a.account.localeCompare(b.account)),
    [stats?.roleClassifications],
  );

  if (!report || !stats) return null;

  const selectedName = selectedProfession ?? squadData[0]?.name ?? comparisonRows[0]?.name ?? null;
  const selected = comparisonRows.find((row) => row.name === selectedName) ?? null;
  const selectedPlayers = selectedName
    ? allRoleRows.filter((row) => row.profession === selectedName || row.professionList?.includes(selectedName))
    : [];
  const presence = summarizeProfessionPresence(stats.fightBreakdown, selectedName);
  const fightPresence = selectedName ? stats.fightBreakdown.map((fight, index) => ({
    label: fight.label || `F${index + 1}`,
    count: fight.squadClassCountsFight?.[selectedName] ?? 0,
  })) : [];
  const maxFightPresence = Math.max(1, ...fightPresence.map((fight) => fight.count));
  const supportCount = allRoleRows.filter((row) => row.role === "support").length;
  const damageCount = allRoleRows.filter((row) => row.role === "damage").length;
  const highConfidenceCount = allRoleRows.filter((row) => row.confidenceScore >= 0.75).length;
  const reviewCount = allRoleRows.filter((row) => row.confidenceScore < 0.5).length;
  const supportRatio = allRoleRows.length > 0 ? (supportCount / allRoleRows.length) * 100 : 0;
  const normalizedQuery = roleQuery.trim().toLowerCase();
  const filteredRoleRows = allRoleRows.filter((row) => {
    const matchesFilter = roleFilter === "all" || row.role === roleFilter || (roleFilter === "review" && row.confidenceScore < 0.5);
    const matchesQuery = !normalizedQuery || row.account.toLowerCase().includes(normalizedQuery) || row.profession.toLowerCase().includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
  const professionIndex = [...comparisonRows].sort((a, b) => b.squadCount - a.squadCount || b.enemyCount - a.enemyCount || a.name.localeCompare(b.name));

  return (
    <div className="space-y-5 animate-view pb-10">
      <section className="theme-role-coverage grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RoleMetric icon={<ShieldCheck className="h-4 w-4" />} label="Support" value={String(supportCount)} detail={`${supportRatio.toFixed(0)}% of roster`} tone="text-emerald-300" />
        <RoleMetric icon={<Swords className="h-4 w-4" />} label="Damage" value={String(damageCount)} detail={`${Math.max(0, 100 - supportRatio).toFixed(0)}% of roster`} tone="text-orange-300" />
        <RoleMetric icon={<Users className="h-4 w-4" />} label="High confidence" value={String(highConfidenceCount)} detail="75% or higher" />
        <RoleMetric icon={<AlertTriangle className="h-4 w-4" />} label="Needs review" value={String(reviewCount)} detail="below 50% confidence" tone={reviewCount > 0 ? "text-amber-300" : "text-emerald-300"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel title="Profession Index" icon={<Layers className="h-4 w-4" />} action={`${professionIndex.length} professions`} bodyClassName="p-0">
          <div className="grid grid-cols-[1fr_3rem_4rem] gap-2 border-b border-theme-border/50 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-theme-muted"><span>Profession</span><span className="text-right">Squad</span><span className="text-right">Enemy obs.</span></div>
          <BoundedDataRegion label={`Profession index, ${professionIndex.length} professions`} itemCount={professionIndex.length} maxHeightClass="max-h-[31rem]" className="divide-y divide-theme-border/30">
            {professionIndex.map((row) => {
              const active = selectedName === row.name;
              return <button key={row.name} type="button" aria-pressed={active} onClick={() => setSelectedProfession(row.name)} className={`grid w-full grid-cols-[1fr_3rem_4rem] items-center gap-2 px-4 py-2.5 text-left transition-colors ${active ? "bg-theme-accent/[0.07] shadow-[inset_2px_0_0_var(--theme-accent)]" : "hover:bg-theme-surface-elevated/55"}`}>
                <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-theme-text"><ClassIcon name={row.name} size="sm" /><span className="truncate">{row.name}</span></span>
                <span className="text-right font-mono text-xs text-amber-300">{row.squadCount}</span>
                <span className="text-right font-mono text-xs text-rose-300">{row.enemyCount}</span>
              </button>;
            })}
          </BoundedDataRegion>
        </Panel>

        <Panel title={selectedName ?? "Profession Coverage"} icon={<Activity className="h-4 w-4" />} action={selected ? `${selected.squadCount} squad · ${selected.enemyCount} enemy obs.` : undefined}>
          {selectedName ? <div className="space-y-5">
            <div className="grid items-center gap-4 border-b border-theme-border/50 pb-4 md:grid-cols-[auto_1fr_auto]">
              <div className={`grid h-12 w-12 place-items-center border ${profStyle(selectedName).border} ${profStyle(selectedName).bg}`}><ClassIcon name={selectedName} /></div>
              <div><div className="text-xl font-black uppercase text-theme-text">{selectedName}</div><div className="mt-1 text-xs text-theme-muted">Present in {presence.fightsPresent} of {presence.totalFights} fights; absent from {presence.fightsAbsent}.</div></div>
              <div className="grid grid-cols-2 gap-5 text-right"><CompactValue label="Average" value={presence.averagePerFight.toFixed(1)} /><CompactValue label="Peak" value={String(presence.peakCount)} /></div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-theme-muted"><span>Tracked roster</span><span>{selectedPlayers.length} classified</span></div>
                <BoundedDataRegion label={`${selectedName} classified roster, ${selectedPlayers.length} players`} itemCount={selectedPlayers.length} maxHeightClass="max-h-64" className="divide-y divide-theme-border/30 border-y border-theme-border/40">
                  {selectedPlayers.length ? selectedPlayers.map((player) => <div key={player.account} className="grid grid-cols-[1fr_auto] gap-3 px-2 py-2.5">
                    <div className="min-w-0"><div className="truncate text-xs font-bold text-theme-text">{player.account}</div><div className="mt-1 truncate text-[9px] uppercase text-theme-muted">{player.role} · {player.factors.slice(0, 2).map((factor) => factor.metric).join(", ") || "limited evidence"}</div></div>
                    <span className={`font-mono text-xs font-black ${player.confidenceScore < 0.5 ? "text-amber-300" : "text-theme-accent-strong"}`}>{Math.round(player.confidenceScore * 100)}%</span>
                  </div>) : <div className="px-2 py-4 text-xs text-theme-muted">No classified squad player is attached to this profession.</div>}
                </BoundedDataRegion>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-theme-muted"><span>Fight coverage</span><span>{presence.coveragePct.toFixed(0)}%</span></div>
                <BoundedDataRegion label={`${selectedName} fight coverage, ${fightPresence.length} fights`} itemCount={fightPresence.length} maxHeightClass="max-h-64" className="divide-y divide-theme-border/30 border-y border-theme-border/40">
                  {fightPresence.map((fight) => <div key={fight.label} className="grid grid-cols-[2.75rem_1fr_1.5rem] items-center gap-2 px-2 py-2 text-[10px]">
                    <span className="font-mono text-theme-muted">{fight.label}</span>
                    <span className="h-2 bg-theme-surface-inset"><span className="block h-full bg-theme-accent" style={{ width: `${(fight.count / maxFightPresence) * 100}%` }} /></span>
                    <span className="text-right font-mono font-black text-theme-text/80">{fight.count}</span>
                  </div>)}
                </BoundedDataRegion>
              </div>
            </div>
          </div> : <p className="text-xs text-theme-muted">No profession data is available.</p>}
        </Panel>
      </section>

      <Panel title="Role Confidence Review" subtitle={reviewCount > 0 ? `${reviewCount} classifications are below 50% confidence and are surfaced first for review.` : "Every role classification is at least 50% confidence."} icon={<Users className="h-4 w-4" />} action={`${filteredRoleRows.length} shown`} bodyClassName="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-border/50 px-4 py-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter role classifications">
            {(["all", "support", "damage", "review"] as RoleFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={roleFilter === filter} onClick={() => setRoleFilter(filter)} className={`border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${roleFilter === filter ? "border-theme-accent/40 bg-theme-accent/10 text-theme-accent-strong" : "border-theme-border text-theme-muted hover:border-theme-accent/25 hover:text-theme-text"}`}>{filter}</button>)}
          </div>
          <label className="flex h-8 min-w-56 items-center gap-2 border border-theme-border bg-theme-surface-inset px-3 text-theme-muted focus-within:border-theme-accent/40"><Search className="h-3.5 w-3.5" /><input value={roleQuery} onChange={(event) => setRoleQuery(event.target.value)} placeholder="Player or profession" className="min-w-0 flex-1 bg-transparent text-xs text-theme-text outline-none placeholder:text-theme-muted" /></label>
        </div>
        <div className="grid grid-cols-[1fr_4rem] gap-3 border-b border-theme-border/50 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-theme-muted lg:grid-cols-[minmax(10rem,1.4fr)_minmax(7rem,0.8fr)_5rem_5rem_minmax(10rem,1fr)]"><span>Player</span><span className="hidden lg:block">Profession</span><span className="hidden lg:block">Role</span><span className="text-right">Confidence</span><span className="hidden lg:block">Evidence</span></div>
        <BoundedDataRegion label={`Role confidence review, ${filteredRoleRows.length} players`} itemCount={filteredRoleRows.length} maxHeightClass="max-h-[26rem]" className="divide-y divide-theme-border/30">
          {filteredRoleRows.map((row) => <button key={row.account} type="button" onClick={() => setSelectedProfession(row.profession)} className="grid w-full grid-cols-[1fr_4rem] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-theme-surface-elevated/55 lg:grid-cols-[minmax(10rem,1.4fr)_minmax(7rem,0.8fr)_5rem_5rem_minmax(10rem,1fr)]">
            <span className="min-w-0"><span className="block truncate text-xs font-bold text-theme-text">{row.account}</span><span className="mt-1 block truncate text-[9px] uppercase text-theme-muted lg:hidden">{row.profession} · {row.role}</span></span>
            <span className="hidden min-w-0 items-center gap-2 text-xs text-theme-muted lg:flex"><ClassIcon name={row.profession} size="sm" /><span className="truncate">{row.profession}</span></span>
            <span className={`hidden text-[9px] font-black uppercase lg:block ${row.role === "support" ? "text-emerald-300" : "text-orange-300"}`}>{row.role}</span>
            <span className={`text-right font-mono text-xs font-black ${row.confidenceScore < 0.5 ? "text-amber-300" : "text-theme-text/80"}`}>{Math.round(row.confidenceScore * 100)}%</span>
            <span className="hidden truncate text-[10px] text-theme-muted lg:block">{row.factors.slice(0, 2).map((factor) => factor.metric).join(", ") || "Limited evidence"}</span>
          </button>)}
          {filteredRoleRows.length === 0 && <div className="px-4 py-8 text-center text-xs text-theme-muted">No role classifications match this filter.</div>}
        </BoundedDataRegion>
      </Panel>
    </div>
  );
}

function RoleMetric({ icon, label, value, detail, tone = "text-theme-accent-strong" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <div className="theme-dossier-metric flex min-h-20 items-center justify-between gap-3 border-l-2 border-theme-accent/30 bg-theme-surface-inset/55 px-4 py-3"><div><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-theme-muted">{icon}{label}</div><div className={`mt-1 font-mono text-2xl font-black ${tone}`}>{value}</div></div><span className="max-w-24 text-right text-[9px] uppercase leading-4 text-theme-muted">{detail}</span></div>;
}

function CompactValue({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[9px] font-black uppercase text-theme-muted">{label}</div><div className="mt-1 font-mono text-xl font-black text-theme-text">{value}</div></div>;
}
