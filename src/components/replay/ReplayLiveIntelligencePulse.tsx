import { useMemo } from "react";
import { BrainCircuit, Clock3 } from "lucide-react";
import { buildIntelligenceDashboard } from "../../lib/intelligence/intelligenceDashboard";
import { nearbyReplayIntelligenceEvents } from "../../lib/replayNearbyIntelligence";
import { buildReplayIntelligenceAnchors } from "../../lib/replayIntelligenceAnchors";
import { useReport } from "../../store/ReportContext";

function fmtOffset(ms: number): string {
  if (Math.abs(ms) < 500) return "now";
  const seconds = Math.abs(ms) / 1000;
  return `${ms < 0 ? "-" : "+"}${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

function titleForKind(kind: string): string {
  return kind.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReplayLiveIntelligencePulse({
  fightIndex,
  timestampMs,
  onSeek,
}: {
  fightIndex: number;
  timestampMs: number;
  onSeek: (timestampMs: number, account?: string) => void;
}) {
  const { report } = useReport();
  const replayFights = report?.stats.replayFights;
  const dashboard = useMemo(() => (report ? buildIntelligenceDashboard(report) : null), [report]);
  const anchors = useMemo(() => buildReplayIntelligenceAnchors(dashboard, replayFights), [dashboard, replayFights]);
  const nearby = useMemo(
    () => nearbyReplayIntelligenceEvents(anchors, fightIndex, timestampMs, 5000).slice(0, 3),
    [anchors, fightIndex, timestampMs],
  );

  if (nearby.length === 0) return null;

  const nearest = nearby[0];
  const active = nearest.distanceMs <= 750;

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
              {active ? "Critical evidence aligns with the current playhead." : `Critical evidence is ${fmtOffset(nearest.offsetMs)} from the playhead.`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
          <Clock3 className="h-3 w-3" /> ±5s window
        </div>
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        {nearby.map((event) => (
          <button
            key={event.id}
            type="button"
            title={event.summary}
            onClick={() => onSeek(event.timestampMs, event.account)}
            className={`min-w-[190px] max-w-[260px] shrink-0 cursor-pointer rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 ${
              event.distanceMs <= 750
                ? "border-sky-300/30 bg-sky-300/[0.07]"
                : "border-white/[0.07] bg-black/20 hover:border-sky-400/25 hover:bg-sky-400/[0.04]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">{titleForKind(event.kind)}</span>
              <span className={`shrink-0 font-mono text-[9px] font-bold ${event.distanceMs <= 750 ? "text-sky-200" : "text-sky-400/70"}`}>{fmtOffset(event.offsetMs)}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-500">{event.summary}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
