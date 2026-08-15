import { useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtFixed, fmtDur, profChip } from "../utils/format";
import { Activity, Clock, Crown, Gauge, Shield, Swords, Target, Skull, Users } from "lucide-react";
import type { CommanderRow } from "../types/report";

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : numerator;
}

export default function CommanderStatsView() {
  const { report } = useReport();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  if (!report) return null;
  const s = report.stats;
  const rows = s.commanderStats?.rows ?? [];

  if (rows.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel title="Commander Stats" icon={<Crown className="w-4 h-4" />} accent="text-orange-400">
          <div className="border-l-2 border-amber-400/30 bg-black/25 px-4 py-8 text-sm text-slate-400">
            No commander identity was recorded for this report.
            <p className="mt-2 text-[11px] text-slate-600">Entropy will not infer a tag from squad performance. Import logs containing commander metadata to populate this view.</p>
          </div>
        </Panel>
      </div>
    );
  }

  const commander = rows.find((row) => row.account === selectedAccount) ?? rows[0];
  const downConversion = ratio(commander.kills, commander.downs);
  const commanderSurvival = Math.max(0, 1 - ratio(commander.commanderDeaths, commander.fights));
  const forceRatio = ratio(commander.avgEnemySize, commander.avgSquadSize);
  const allyTrade = ratio(commander.alliesDead, commander.kills);
  const reviewCues = buildReviewCues(commander, downConversion, commanderSurvival, forceRatio);

  return (
    <div className="theme-view-layout space-y-5 animate-view pb-12">
      {rows.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar" role="group" aria-label="Select commander">
          {rows.map((row) => (
            <button key={row.account} type="button" aria-pressed={row.account === commander.account} onClick={() => setSelectedAccount(row.account)} className={`theme-filter-chip min-w-max border px-3 py-2 text-xs font-black ${row.account === commander.account ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-theme-border text-theme-muted"}`}>
              {row.characterNames[0] || row.account}
            </button>
          ))}
        </div>
      )}

      <section className="theme-commander-hero grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="theme-selected-fight border border-orange-400/25 bg-black/45 p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="theme-commander-emblem grid h-14 w-14 place-items-center border border-orange-400/35 bg-orange-500/10">
              <Crown className="h-7 w-7 text-orange-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.26em] text-orange-300">Command dossier</div>
              <h2 className="mt-1 truncate text-2xl font-black uppercase text-slate-100">{commander.characterNames.join(", ") || commander.account}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`border px-2 py-0.5 text-[10px] font-bold ${profChip(commander.profession)}`}>{commander.profession}</span>
                <span className="font-mono text-[11px] text-slate-500">{commander.account}</span>
              </div>
            </div>
            <div className="border-l-2 border-orange-400/40 pl-5 text-right">
              <div className="font-mono text-4xl font-black text-orange-300">{fmtFixed(commander.winRatePct, 0)}%</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">win rate</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Fights" value={fmtNum(commander.fights)} icon={<Swords className="h-3.5 w-3.5 text-orange-400" />} accent="text-orange-300" />
            <StatCard label="Wins" value={fmtNum(commander.wins)} icon={<Target className="h-3.5 w-3.5 text-emerald-400" />} accent="text-emerald-300" />
            <StatCard label="Losses" value={fmtNum(commander.losses)} icon={<Skull className="h-3.5 w-3.5 text-rose-400" />} accent="text-rose-300" />
            <StatCard label="KDR" value={fmtFixed(commander.kdr, 2)} icon={<Gauge className="h-3.5 w-3.5 text-amber-400" />} accent="text-amber-300" />
            <StatCard label="Kills" value={fmtNum(commander.kills)} icon={<Swords className="h-3.5 w-3.5 text-emerald-400" />} accent="text-emerald-300" />
            <StatCard label="Duration" value={fmtDur(commander.totalDurationMs)} icon={<Clock className="h-3.5 w-3.5 text-slate-400" />} accent="text-slate-300" />
          </div>
        </div>

        <div className="theme-command-readout border border-amber-400/15 bg-black/35 p-5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-300"><Activity className="h-4 w-4" /> Review cues</div>
          <div className="mt-4 grid gap-3">
            {reviewCues.map((cue) => <div key={cue.label} className="border-l-2 border-amber-400/30 bg-black/25 px-3 py-2"><div className="text-xs font-black text-slate-200">{cue.label}</div><div className="mt-1 text-[11px] leading-5 text-slate-500">{cue.detail}</div></div>)}
          </div>
        </div>
      </section>

      <section className="theme-commander-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CommandMetric icon={<Target className="h-4 w-4" />} label="Down conversion" value={`${fmtFixed(downConversion * 100, 0)}%`} detail={`${commander.kills} kills from ${commander.downs} downs`} tone="text-emerald-300" />
        <CommandMetric icon={<Shield className="h-4 w-4" />} label="Tag survival" value={`${fmtFixed(commanderSurvival * 100, 0)}%`} detail={`${commander.commanderDeaths} commander deaths across ${commander.fights} fights`} tone="text-cyan-300" />
        <CommandMetric icon={<Users className="h-4 w-4" />} label="Enemy force ratio" value={`${fmtFixed(forceRatio, 2)}x`} detail={`${fmtFixed(commander.avgSquadSize, 1)} squad vs ${fmtFixed(commander.avgEnemySize, 1)} enemy average`} tone="text-orange-300" />
        <CommandMetric icon={<Skull className="h-4 w-4" />} label="Ally deaths per kill" value={fmtFixed(allyTrade, 2)} detail={`${commander.alliesDead} allied deaths against ${commander.kills} kills`} tone="text-rose-300" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel title="Engagement Record" icon={<Swords className="h-4 w-4" />} accent="text-orange-400">
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Average squad" value={fmtFixed(commander.avgSquadSize, 1)} />
            <Detail label="Average enemy" value={fmtFixed(commander.avgEnemySize, 1)} />
            <Detail label="Enemy downs" value={fmtNum(commander.downs)} color="text-amber-300" />
            <Detail label="Enemy kills" value={fmtNum(commander.kills)} color="text-emerald-300" />
            <Detail label="Allies down" value={fmtNum(commander.alliesDown)} color="text-orange-300" />
            <Detail label="Allies dead" value={fmtNum(commander.alliesDead)} color="text-rose-300" />
          </div>
        </Panel>

        <Panel title="Survivability Evidence" icon={<Shield className="h-4 w-4" />} accent="text-cyan-400">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Detail label="Damage taken" value={fmtNum(commander.damageTaken)} color="text-rose-300" />
            <Detail label="Damage / minute" value={fmtNum(commander.damageTakenPerMinute)} color="text-orange-300" />
            <Detail label="Barrier absorbed" value={fmtNum(commander.incomingBarrierAbsorbed)} color="text-teal-300" />
            <Detail label="Barrier / minute" value={fmtNum(commander.incomingBarrierAbsorbedPerMinute ?? 0)} color="text-cyan-300" />
          </div>
          <div className="mt-4 border-l-2 border-slate-700 px-3 py-2 text-xs leading-5 text-slate-500">Push timing, tag movement, and squad response after a tag death require timestamped commander-position evidence that is not yet stored in the report contract. Entropy leaves those panels unavailable instead of estimating them.</div>
        </Panel>
      </section>
    </div>
  );
}

function buildReviewCues(commander: CommanderRow, conversion: number, survival: number, forceRatio: number) {
  return [
    { label: conversion >= 0.65 ? "Strong down conversion" : "Conversion review", detail: `${fmtFixed(conversion * 100, 0)}% of recorded enemy downs converted into kills.` },
    { label: survival >= 0.85 ? "Tag remained available" : "Tag survival review", detail: `${fmtFixed(survival * 100, 0)}% fight-level survival based on recorded commander deaths.` },
    { label: forceRatio > 1.15 ? "Frequent numerical pressure" : "Comparable force sizes", detail: `Average enemy-to-squad force ratio was ${fmtFixed(forceRatio, 2)}x.` },
    { label: "Evidence boundary", detail: `${commander.fights} fights contribute to this commander aggregate; no unrecorded movement behavior is inferred.` },
  ];
}

function CommandMetric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="theme-dossier-metric border-l-2 border-orange-400/25 bg-black/35 p-4"><div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-wider text-slate-500"><span>{label}</span>{icon}</div><div className={`mt-3 font-mono text-2xl font-black ${tone}`}>{value}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</div></div>;
}

function Detail({ label, value, color = "text-slate-200" }: { label: string; value: string; color?: string }) {
  return <div className="theme-dossier-metric border-l-2 border-slate-700 bg-black/25 px-3 py-2"><div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className={`font-mono text-sm font-black ${color}`}>{value}</div></div>;
}
