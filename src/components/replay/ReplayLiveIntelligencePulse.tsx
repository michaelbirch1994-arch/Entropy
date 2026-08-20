import { useEffect, useMemo } from "react";
import { BrainCircuit, Clock3, SkipBack, SkipForward, Users } from "lucide-react";
import { buildIntelligenceDashboard } from "../../lib/intelligence/intelligenceDashboard";
import { nearbyReplayIntelligenceEvents } from "../../lib/replayNearbyIntelligence";
import { buildReplayIntelligenceAnchors, type ReplayIntelligenceAnchor } from "../../lib/replayIntelligenceAnchors";
import { useReport } from "../../store/ReportContext";

function fmtOffset(ms: number): string {
  if (Math.abs(ms) < 500) return "now";
  const seconds = Math.abs(ms) / 1000;
  return `${ms < 0 ? "-" : "+"}${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

function fmtClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function titleForKind(kind: string): string {
  return kind.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function markerClass(category: string, aligned: boolean): string {
  if (aligned) return "bg-sky-200 ring-2 ring-sky-300/35";
  if (category === "defense") return "bg-rose-400";
  if (category === "positioning") return "bg-amber-300";
  if (category === "support") return "bg-emerald-400";
  if (category === "offense") return "bg-orange-400";
  if (category === "coordination") return "bg-violet-400";
  return "bg-sky-400";
}

export default function ReplayLiveIntelligencePulse({
  fightIndex,
  timestampMs,
  onSeek,
  onAlignedEventChange,
}: {
  fightIndex: number;
  timestampMs: number;
  onSeek: (timestampMs: number, account?: string) => void;
  onAlignedEventChange?: (event: ReplayIntelligenceAnchor | null) => void;
}) {
  const { report } = useReport();
  const replayFights = report?.stats.replayFights;
  const dashboard = useMemo(() => (report ? buildIntelligenceDashboard(report) : null), [report]);
  const anchors = useMemo(() => buildReplayIntelligenceAnchors(dashboard, replayFights), [dashboard, replayFights]);
  const fight = replayFights?.[fightIndex];
  const fightAnchors = useMemo(
    () => anchors.filter((anchor) => anchor.fightIndex === fightIndex),
    [anchors, fightIndex],
  );
  const nearby = useMemo(
    () => nearbyReplayIntelligenceEvents(anchors, fightIndex, timestampMs, 5000).slice(0, 3),
    [anchors, fightIndex, timestampMs],
  );

  const playerNameByAccount = useMemo(
    () => new Map((fight?.data.players ?? []).map((player) => [player.account, player.name])),
    [fight],
  );

  const nearest = nearby[0];
  const active = !!nearest && nearest.distanceMs <= 750;
  const alignedEvent = active ? nearest : null;

  useEffect(() => {
    onAlignedEventChange?.(alignedEvent);
    return () => onAlignedEventChange?.(null);
  }, [alignedEvent?.id, fightIndex, onAlignedEventChange]);

  if (!fight || fightAnchors.length === 0) return null;

  const playheadPct = fight.data.durationMs > 0
    ? Math.max(0, Math.min(100, (timestampMs / fight.data.durationMs) * 100))
    : 0;
  const previousAnchor = [...fightAnchors].reverse().find((anchor) => anchor.timestampMs < timestampMs - 750);
  const nextAnchor = fightAnchors.find((anchor) => anchor.timestampMs > timestampMs + 750);

  return (
    <section
      className={`mb-3 overflow-hidden rounded-xl border px-3 py-2.5 transition ${
        active
          ? "border-sky-300/35 bg-sky-400/[0.09] shadow-[0_0_28px_-18px_rgba(56,189,248,0.9)]"
          : "border-sky-400/15 bg-sky-400/[0.035]"
      }`}
      aria-label="Nearby Intelligence events"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${active ? "border-sky-300/35 bg-sky-300/10 text-sky-200" : "border-sky-400/20 bg-sky-400/[0.06] text-sky-400"}`}>
            {active && <span className="absolute inset-0 animate-ping rounded-lg border border-sky-300/25" aria-hidden="true" />}
            <BrainCircuit className="relative h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-sky-300">Entropy live intelligence</div>
            <div className="truncate text-[10px] text-slate-500">
              {active
                ? "Critical evidence aligns with the current playhead."
                : nearest
                  ? `Critical evidence is ${fmtOffset(nearest.offsetMs)} from the playhead.`
                  : `${fightAnchors.length} evidence-backed event${fightAnchors.length === 1 ? "" : "s"} mapped across this fight.`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
          <Clock3 className="h-3 w-3" /> {nearby.length > 0 ? "±5s live window" : `${fightAnchors.length} fight events`}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/25 px-2.5 py-2">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">
          <span>Intelligence event track</span>
          <span className="font-mono normal-case tracking-normal text-slate-500">{fmtClock(timestampMs)} / {fmtClock(fight.data.durationMs)}</span>
        </div>
        <div className="relative h-6" aria-label={`${fightAnchors.length} Intelligence events across this fight`}>
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-700/70" />
          <div className="absolute bottom-0 top-0 w-px bg-sky-200/70 shadow-[0_0_8px_rgba(125,211,252,0.65)]" style={{ left: `${playheadPct}%` }} aria-hidden="true" />
          {fightAnchors.map((anchor) => {
            const pct = fight.data.durationMs > 0
              ? Math.max(0, Math.min(100, (anchor.timestampMs / fight.data.durationMs) * 100))
              : 0;
            const aligned = Math.abs(anchor.timestampMs - timestampMs) <= 750;
            const participantLabel = anchor.accounts.length > 0 ? ` · ${anchor.accounts.length} tracked player${anchor.accounts.length === 1 ? "" : "s"}` : "";
            return (
              <button
                key={anchor.id}
                type="button"
                onClick={() => onSeek(anchor.timestampMs, anchor.account)}
                title={`${titleForKind(anchor.kind)} · ${fmtClock(anchor.timestampMs)}${participantLabel} · ${anchor.summary}`}
                aria-label={`Seek to ${titleForKind(anchor.kind)} at ${fmtClock(anchor.timestampMs)}`}
                className={`absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full transition hover:h-4 hover:w-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 ${markerClass(anchor.category, aligned)}`}
                style={{ left: `${pct}%` }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] text-slate-600">
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />Defense</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />Positioning</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Support</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />Offense</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />Coordination</span>
          <span className="ml-auto text-slate-500">Click any marker to seek to exact evidence.</span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
          <button
            type="button"
            disabled={!previousAnchor}
            onClick={() => previousAnchor && onSeek(previousAnchor.timestampMs, previousAnchor.account)}
            title={previousAnchor ? `Previous: ${titleForKind(previousAnchor.kind)} at ${fmtClock(previousAnchor.timestampMs)}` : "No previous Intelligence event"}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-slate-500 transition hover:border-sky-400/20 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <SkipBack className="h-3 w-3" /> Previous event
          </button>
          <span className="truncate text-center font-mono text-[8px] text-slate-600">
            {nextAnchor ? `Next ${fmtOffset(nextAnchor.timestampMs - timestampMs)} · ${titleForKind(nextAnchor.kind)}` : "End of Intelligence track"}
          </span>
          <button
            type="button"
            disabled={!nextAnchor}
            onClick={() => nextAnchor && onSeek(nextAnchor.timestampMs, nextAnchor.account)}
            title={nextAnchor ? `Next: ${titleForKind(nextAnchor.kind)} at ${fmtClock(nextAnchor.timestampMs)}` : "No next Intelligence event"}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-slate-500 transition hover:border-sky-400/20 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-25"
          >
            Next event <SkipForward className="h-3 w-3" />
          </button>
        </div>
      </div>

      {nearby.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {nearby.map((event) => (
            <div
              key={event.id}
              className={`min-w-[220px] max-w-[310px] shrink-0 overflow-hidden rounded-lg border transition ${
                event.distanceMs <= 750
                  ? "border-sky-300/30 bg-sky-300/[0.07]"
                  : "border-white/[0.07] bg-black/20 hover:border-sky-400/20"
              }`}
            >
              <button
                type="button"
                title={event.summary}
                onClick={() => onSeek(event.timestampMs, event.account)}
                className="block w-full cursor-pointer px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">{titleForKind(event.kind)}</span>
                  <span className={`shrink-0 font-mono text-[9px] font-bold ${event.distanceMs <= 750 ? "text-sky-200" : "text-sky-400/70"}`}>{fmtOffset(event.offsetMs)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-500">{event.summary}</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">
                  <span>{event.confidence} evidence</span>
                  {event.accounts.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-sky-400/70"><Users className="h-2.5 w-2.5" /> {event.accounts.length} tracked</span>
                    </>
                  )}
                </div>
              </button>

              {event.accounts.length > 0 && (
                <div className="flex flex-wrap gap-1 border-t border-white/[0.05] px-2.5 py-2">
                  {event.accounts.slice(0, 5).map((account) => (
                    <button
                      key={account}
                      type="button"
                      onClick={() => onSeek(event.timestampMs, account)}
                      title={`Open Tactical State for ${playerNameByAccount.get(account) ?? account}`}
                      className="max-w-[132px] cursor-pointer truncate rounded-md border border-sky-400/15 bg-sky-400/[0.045] px-1.5 py-1 text-[8px] font-semibold text-sky-300/80 transition hover:border-sky-300/30 hover:bg-sky-400/[0.08] hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45"
                    >
                      {playerNameByAccount.get(account) ?? account}
                    </button>
                  ))}
                  {event.accounts.length > 5 && (
                    <span className="px-1 py-1 font-mono text-[8px] text-slate-600">+{event.accounts.length - 5} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
