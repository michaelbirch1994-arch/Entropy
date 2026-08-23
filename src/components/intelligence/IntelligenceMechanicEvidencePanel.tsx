import { Activity, ArrowRight, Clock3, Radar, Users } from "lucide-react";
import { useMemo } from "react";
import { useReport } from "../../store/ReportContext";
import { useView } from "../../store/ViewContext";
import { buildEventMechanicEvidence, type EventMechanicEvidence } from "../../lib/intelligence/eventMechanicEvidence";
import { buildEventReplaySnapshotEvidence } from "../../lib/intelligence/eventReplayEvidence";
import type { IntelligenceEventWindow } from "../../lib/intelligence/eventInspection";

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatOffset(ms: number): string {
  if (ms === 0) return "anchor";
  const seconds = Math.abs(ms / 1000).toFixed(1);
  return ms < 0 ? `-${seconds}s` : `+${seconds}s`;
}

function formatDistance(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "unknown" : Math.round(value).toLocaleString();
}

const RELATION_STYLE: Record<EventMechanicEvidence["relation"], string> = {
  before: "border-white/10 bg-white/[0.03] text-slate-300",
  anchor: "border-theme-focus bg-theme-accentDim text-theme-accentStrong",
  after: "border-white/10 bg-white/[0.03] text-slate-300",
};

function MechanicCard({ mechanic, onOpenReplay }: { mechanic: EventMechanicEvidence; onOpenReplay: () => void }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-black text-slate-200">{formatTime(mechanic.timestampMs)}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{formatOffset(mechanic.offsetMs)}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${RELATION_STYLE[mechanic.relation]}`}>{mechanic.relation}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-300">{mechanic.severity}</span>
        {mechanic.linkedPlayer && <span className="rounded-full border border-theme-focus bg-theme-accentDim px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-theme-accentStrong">linked player</span>}
      </div>
      <div className="mt-2 text-xs font-black text-slate-100">{mechanic.name}</div>
      <div className="mt-1 text-[11px] text-slate-500">Actor: <span className="text-slate-300">{mechanic.actor || "unknown"}</span>{mechanic.account ? <> · Account: <span className="text-slate-300">{mechanic.account}</span></> : null}</div>
      <button
        type="button"
        onClick={onOpenReplay}
        className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-theme-focus bg-theme-accentDim px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-theme-accentStrong transition hover:bg-theme-accentDim"
      >
        Open exact replay moment <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function IntelligenceMechanicEvidencePanel({ fightId, window, relatedPlayerKeys }: { fightId: string; window: IntelligenceEventWindow; relatedPlayerKeys: string[] }) {
  const { report } = useReport();
  const { navigateToView } = useView();
  const replayFights = report?.stats.replayFights;
  const fightIndex = replayFights?.findIndex((fight) => fight.fightId === fightId) ?? -1;
  const mechanics = useMemo(
    () => replayFights ? buildEventMechanicEvidence({ replayFights, fightId, window, relatedPlayerKeys }) : [],
    [replayFights, fightId, window, relatedPlayerKeys],
  );
  const replaySnapshot = useMemo(
    () => replayFights ? buildEventReplaySnapshotEvidence({
      replayFights,
      fightId,
      timestampMs: window.anchorTimestampMs,
      relatedPlayerKeys,
    }) : null,
    [replayFights, fightId, window.anchorTimestampMs, relatedPlayerKeys],
  );

  const linkedPlayers = replaySnapshot?.linkedPlayers ?? [];
  if (mechanics.length === 0 && linkedPlayers.length === 0) return null;

  const before = mechanics.filter((mechanic) => mechanic.relation === "before");
  const anchor = mechanics.filter((mechanic) => mechanic.relation === "anchor");
  const after = mechanics.filter((mechanic) => mechanic.relation === "after");
  const openReplay = (mechanic: EventMechanicEvidence) => navigateToView("fight-replay", {
    source: "intelligence",
    fightId,
    fightIndex,
    timestampMs: mechanic.timestampMs,
    account: mechanic.account,
    metric: mechanic.name,
  });
  const openPlayerReplay = (account: string) => navigateToView("fight-replay", {
    source: "intelligence",
    fightId,
    fightIndex,
    timestampMs: window.anchorTimestampMs,
    account,
    metric: "Player event context",
  });

  return (
    <>
      {linkedPlayers.length > 0 && (
        <section className="mt-4 rounded-2xl border border-theme-border bg-black/20 p-4" aria-label="Linked player local replay context">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-theme-accentStrong"><Radar className="h-4 w-4" /> Local player situation</div>
            <span className="text-[10px] font-bold uppercase text-slate-500">exact replay timestamp · descriptive evidence</span>
          </div>
          <p className="mt-2 max-w-5xl text-[11px] leading-5 text-slate-500">This reconstructs the linked player&apos;s immediate local situation from the same replay tracks already used by Fight Replay. Range counts are only shown when the player&apos;s position is supported. Tracked enemy counts are not a claim about the entire enemy squad.</p>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {linkedPlayers.map((player) => (
              <div key={player.account} className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-100">{player.account}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{player.name} · {player.profession}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {player.isCommander && <span className="rounded-full border border-amber-400/20 bg-amber-500/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200">tag</span>}
                    {player.isDown && <span className="rounded-full border border-rose-400/20 bg-rose-500/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-200">down</span>}
                    {player.isDead && <span className="rounded-full border border-rose-400/30 bg-rose-500/[0.08] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-100">dead</span>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-2.5"><div className="text-[9px] font-bold uppercase text-slate-600">Dist. to tag</div><div className="mt-1 font-mono text-sm font-black text-slate-100">{formatDistance(player.distanceToCommander)}</div></div>
                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-2.5"><div className="text-[9px] font-bold uppercase text-slate-600">Allies ≤240</div><div className="mt-1 font-mono text-sm font-black text-slate-100">{player.nearbySquadWithin240 ?? "unknown"}</div></div>
                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-2.5"><div className="text-[9px] font-bold uppercase text-slate-600">Allies ≤600</div><div className="mt-1 font-mono text-sm font-black text-slate-100">{player.nearbySquadWithin600 ?? "unknown"}</div></div>
                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-2.5"><div className="text-[9px] font-bold uppercase text-slate-600">Tracked enemies ≤600</div><div className="mt-1 font-mono text-sm font-black text-rose-100">{player.trackedEnemiesWithin600 ?? "unknown"}</div></div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500"><Users className="h-3.5 w-3.5" /> Nearest squadmates</div>
                    {player.nearestSquadmates.length > 0 ? (
                      <div className="mt-2 grid gap-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                        {player.nearestSquadmates.map((nearby) => (
                          <div key={nearby.account} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2 text-[10px]">
                            <div className="min-w-0"><div className="truncate font-bold text-slate-300">{nearby.account}</div><div className="truncate text-slate-600">{nearby.name} · {nearby.profession}{nearby.isDown ? " · down" : ""}</div></div>
                            <span className="shrink-0 font-mono font-bold text-slate-300">{Math.round(nearby.distance)}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="mt-2 text-[10px] leading-5 text-slate-600">No supported nearby squad positions at this timestamp.</div>}
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Damaging casts ±2.5s</div>
                    {player.recentCasts.length > 0 ? (
                      <div className="mt-2 grid gap-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                        {player.recentCasts.map((cast, index) => (
                          <div key={`${cast.timestampMs}-${cast.skillId}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2 text-[10px]">
                            <div className="min-w-0 truncate font-bold text-slate-300">{cast.skillName}</div>
                            <span className="shrink-0 font-mono font-bold text-slate-300">{formatOffset(cast.offsetMs)}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="mt-2 text-[10px] leading-5 text-slate-600">No replay-backed damaging casts were recorded inside the ±2.5 second window.</div>}
                  </div>
                </div>

                <div className="mt-3 flex justify-end border-t border-white/[0.05] pt-3">
                  <button type="button" onClick={() => openPlayerReplay(player.account)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-theme-focus bg-theme-accentDim px-3 py-2 text-[9px] font-black uppercase tracking-wider text-theme-accentStrong transition hover:bg-theme-accentDim">Open player at anchor <ArrowRight className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {mechanics.length > 0 && (
        <section className="mt-4 rounded-2xl border border-theme-border bg-black/20 p-4" aria-label="Replay mechanics in selected Intelligence window">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-theme-accentStrong"><Activity className="h-4 w-4" /> Mechanics nervous-system trace</div>
            <span className="text-[10px] font-bold uppercase text-slate-500">{mechanics.length} recorded mechanic{mechanics.length === 1 ? "" : "s"}</span>
          </div>
          <p className="mt-2 max-w-5xl text-[11px] leading-5 text-slate-500">These are the existing Fight Replay mechanic markers inside this Intelligence window. Entropy keeps their exact timing and actor identity, but does not claim that a nearby mechanic caused the selected event.</p>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Before</span><span className="font-mono text-[10px] text-slate-600">{before.length}</span></div><div className="mt-2 grid gap-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">{before.length ? before.map((mechanic, index) => <MechanicCard key={`${mechanic.timestampMs}-${mechanic.name}-${index}`} mechanic={mechanic} onOpenReplay={() => openReplay(mechanic)} />) : <p className="text-[11px] leading-5 text-slate-600">No replay mechanic markers before the anchor inside this window.</p>}</div></div>
            <div className="rounded-2xl border border-theme-focus bg-theme-accentDim p-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-theme-accentStrong"><Clock3 className="h-3 w-3" /> At anchor</span><span className="font-mono text-[10px] text-slate-600">{anchor.length}</span></div><div className="mt-2 grid gap-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">{anchor.length ? anchor.map((mechanic, index) => <MechanicCard key={`${mechanic.timestampMs}-${mechanic.name}-${index}`} mechanic={mechanic} onOpenReplay={() => openReplay(mechanic)} />) : <p className="text-[11px] leading-5 text-slate-600">No mechanic marker occurred at the exact Intelligence anchor timestamp.</p>}</div></div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">After</span><span className="font-mono text-[10px] text-slate-600">{after.length}</span></div><div className="mt-2 grid gap-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">{after.length ? after.map((mechanic, index) => <MechanicCard key={`${mechanic.timestampMs}-${mechanic.name}-${index}`} mechanic={mechanic} onOpenReplay={() => openReplay(mechanic)} />) : <p className="text-[11px] leading-5 text-slate-600">No replay mechanic markers after the anchor inside this window.</p>}</div></div>
          </div>
        </section>
      )}
    </>
  );
}
