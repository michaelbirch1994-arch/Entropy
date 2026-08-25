import Panel from "../components/ui/Panel";
import { fmtDur, fmtFixed, fmtNum, profChip } from "../utils/format";
import type { CommanderRow, FightRow } from "../types/report";
import {
  Activity,
  ArrowUpRight,
  Clock,
  Crown,
  Gauge,
  Shield,
  Swords,
  Target,
  Users,
} from "lucide-react";
import { useView } from "../store/ViewContext";

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function metricValue(value: number | null, digits = 2, suffix = "") {
  return value === null ? "—" : `${fmtFixed(value, digits)}${suffix}`;
}

interface CommanderStatsViewProps {
  commander: CommanderRow;
  fightBreakdown: FightRow[];
}

export default function CommanderStatsView({ commander, fightBreakdown }: CommanderStatsViewProps) {
  const { setActiveView } = useView();
  const hasSquadOutcomes = typeof commander.squadKills === "number" && typeof commander.squadDowns === "number";
  const squadKills = commander.squadKills ?? 0;
  const squadDowns = commander.squadDowns ?? 0;
  const squadKdr = hasSquadOutcomes ? ratio(squadKills, commander.alliesDead) : null;
  const downConversion = hasSquadOutcomes ? ratio(squadKills, squadKills + squadDowns) * 100 : null;
  const forceRatio = commander.avgSquadSize > 0 ? commander.avgEnemySize / commander.avgSquadSize : null;
  const tagDeathsPerFight = ratio(commander.commanderDeaths, commander.fights);
  const classifiedFights = commander.wins + commander.losses;
  const unclassifiedFights = commander.unclassified ?? Math.max(0, commander.fights - classifiedFights);
  const ledFights = (commander.fightIndices ?? [])
    .map((fightIndex) => ({ fightIndex, fight: fightBreakdown[fightIndex] }))
    .filter((entry): entry is { fightIndex: number; fight: FightRow } => Boolean(entry.fight));

  function openFight(fightIndex: number) {
    const fight = fightBreakdown[fightIndex];
    localStorage.setItem("entropy.selectedFightIndex", String(fightIndex));
    if (fight?.id) localStorage.setItem("entropy.selectedFightId", fight.id);
    setActiveView("squad-stats");
  }

  return (
    <div className="theme-view-layout space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="theme-selected-fight border border-theme-focus bg-black/45 p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="theme-commander-emblem grid h-12 w-12 shrink-0 place-items-center border border-theme-focus bg-theme-accentDim">
              <Crown className="h-6 w-6 text-theme-accentStrong" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-theme-accentStrong">Commander</div>
              <h2 className="mt-1 text-xl font-black uppercase text-slate-100 md:text-2xl">
                {commander.characterNames.join(", ") || commander.account}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`border px-2 py-0.5 text-[10px] font-bold ${profChip(commander.profession)}`}>{commander.profession}</span>
                <span className="break-all font-mono text-[11px] text-slate-500">{commander.account}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 border-y border-theme-border md:grid-cols-4">
            <SummaryCell icon={<Swords className="h-3.5 w-3.5" />} label="Led fights" value={fmtNum(commander.fights)} />
            <SummaryCell icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={fmtDur(commander.totalDurationMs)} />
            <SummaryCell icon={<Users className="h-3.5 w-3.5" />} label="Avg squad" value={fmtFixed(commander.avgSquadSize, 1)} />
            <SummaryCell icon={<Target className="h-3.5 w-3.5" />} label="Avg enemy" value={fmtFixed(commander.avgEnemySize, 1)} />
          </div>
        </div>

        <div className="border border-theme-border bg-black/30 p-5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-theme-accentStrong">
            <Activity className="h-4 w-4" /> Outcome coverage
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <OutcomeStat label="Wins" value={commander.wins} tone="text-emerald-300" />
            <OutcomeStat label="Losses" value={commander.losses} tone="text-rose-300" />
            <OutcomeStat label="Unclassified" value={unclassifiedFights} tone="text-slate-200" />
          </div>
          <div className="mt-4 border-l-2 border-theme-focus pl-3">
            <div className="font-mono text-2xl font-black text-theme-accentStrong">
              {classifiedFights > 0 ? `${fmtFixed(commander.winRatePct, 0)}%` : "—"}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase text-theme-muted">Classified win rate</div>
            {classifiedFights === 0 && <p className="mt-2 text-[10px] leading-4 text-theme-muted">No fight outcome was inferred.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CommandMetric
          icon={<Gauge className="h-4 w-4" />}
          label="Squad KDR"
          value={metricValue(squadKdr)}
          detail={hasSquadOutcomes ? `${squadKills} enemy kills / ${commander.alliesDead} allied deaths` : "Unavailable in this older report"}
        />
        <CommandMetric
          icon={<Target className="h-4 w-4" />}
          label="Down conversion"
          value={metricValue(downConversion, 0, "%")}
          detail={hasSquadOutcomes ? `${squadKills} kills from ${squadKills + squadDowns} recorded enemy down states` : "Unavailable in this older report"}
        />
        <CommandMetric
          icon={<Shield className="h-4 w-4" />}
          label="Tag deaths / fight"
          value={fmtFixed(tagDeathsPerFight, 2)}
          detail={`${commander.commanderDeaths} recorded tag deaths across ${commander.fights} fights`}
        />
        <CommandMetric
          icon={<Users className="h-4 w-4" />}
          label="Enemy force ratio"
          value={metricValue(forceRatio, 2, "x")}
          detail={`${fmtFixed(commander.avgSquadSize, 1)} squad vs ${fmtFixed(commander.avgEnemySize, 1)} enemy average`}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Engagement Totals" icon={<Swords className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail label="Enemy kills" value={hasSquadOutcomes ? fmtNum(squadKills) : "—"} color="text-emerald-300" />
            <Detail label="Enemy downs" value={hasSquadOutcomes ? fmtNum(squadDowns) : "—"} color="text-amber-300" />
            <Detail label="Allied downs" value={fmtNum(commander.alliesDown)} color="text-orange-300" />
            <Detail label="Allied deaths" value={fmtNum(commander.alliesDead)} color="text-rose-300" />
          </div>
        </Panel>

        <Panel title="Tag Survivability" icon={<Shield className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail label="Tag downs" value={fmtNum(commander.commanderDowns)} />
            <Detail label="Tag deaths" value={fmtNum(commander.commanderDeaths)} color="text-rose-300" />
            <Detail label="Damage / min" value={fmtNum(commander.damageTakenPerMinute)} color="text-orange-300" />
            <Detail label="Barrier / min" value={fmtNum(commander.incomingBarrierAbsorbedPerMinute ?? 0)} color="text-amber-300" />
          </div>
        </Panel>
      </section>

      {ledFights.length > 0 && (
        <Panel title="Led Fight Ledger" icon={<Activity className="h-4 w-4" />}>
          <div className="divide-y divide-theme-border">
            {ledFights.map(({ fightIndex, fight }) => (
              <button
                key={`${fight.id}:${fightIndex}`}
                type="button"
                onClick={() => openFight(fightIndex)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1.4fr)_7rem_8rem_5rem_auto] sm:px-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black text-theme-text">{fight.label} · {fight.fullLabel}</span>
                  <span className="mt-1 block text-[10px] text-theme-muted">{fight.mapName}</span>
                </span>
                <LedgerValue label="Force" value={`${fight.squadCount}v${fight.enemyCount}`} />
                <LedgerValue label="Enemy D / K" value={`${fight.enemyDowns} / ${fight.enemyDeaths}`} className="hidden sm:block" />
                <LedgerValue label="Duration" value={fight.duration} className="hidden sm:block" />
                <span className="inline-flex h-8 w-8 items-center justify-center border border-theme-border text-theme-muted transition-colors hover:text-theme-accentStrong">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function SummaryCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 border-theme-border px-2 py-3 first:pl-0 md:border-r md:px-4 md:last:border-r-0">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-theme-muted">{icon}{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-black text-theme-text">{value}</div>
    </div>
  );
}

function OutcomeStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><div className={`font-mono text-xl font-black ${tone}`}>{fmtNum(value)}</div><div className="mt-1 text-[9px] font-bold uppercase text-theme-muted">{label}</div></div>;
}

function CommandMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="theme-dossier-metric min-h-32 border-l-2 border-theme-focus bg-black/35 p-4">
      <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase text-theme-muted"><span>{label}</span>{icon}</div>
      <div className="mt-3 font-mono text-2xl font-black text-theme-accentStrong">{value}</div>
      <div className="mt-1 text-[10px] leading-4 text-theme-muted">{detail}</div>
    </div>
  );
}

function Detail({ label, value, color = "text-slate-200" }: { label: string; value: string; color?: string }) {
  return <div className="theme-dossier-metric border-l-2 border-theme-border bg-black/25 px-3 py-2"><div className="mb-0.5 text-[10px] font-bold uppercase text-theme-muted">{label}</div><div className={`font-mono text-sm font-black ${color}`}>{value}</div></div>;
}

function LedgerValue({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <span className={className}><span className="block text-[9px] font-bold uppercase text-theme-muted sm:hidden">{label}</span><span className="font-mono text-[11px] font-black text-theme-text">{value}</span></span>;
}
