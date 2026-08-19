import { Activity, ArrowRight } from "lucide-react";
import { useReport } from "../../store/ReportContext";
import { useView } from "../../store/ViewContext";
import { buildEventMechanicEvidence } from "../../lib/intelligence/eventMechanicEvidence";
import type { IntelligenceEventWindow } from "../../lib/intelligence/eventInspection";

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatOffset(ms: number): string {
  const seconds = Math.abs(ms / 1000).toFixed(1);
  if (ms === 0) return "at anchor";
  return ms < 0 ? `-${seconds}s` : `+${seconds}s`;
}

export default function IntelligenceMechanicEvidencePanel({
  fightId,
  fightIndex,
  eventId,
  window,
  relatedPlayerKeys,
}: {
  fightId: string;
  fightIndex: number;
  eventId: string;
  window: IntelligenceEventWindow;
  relatedPlayerKeys: string[];
}) {
  const { report } = useReport();
  const { navigateToView } = useView();
  const mechanics = report?.stats.replayFights
    ? buildEventMechanicEvidence({
        replayFights: report.stats.replayFights,
        fightId,
        window,
        relatedPlayerKeys,
      })
    : [];

  if (mechanics.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-violet-300">
          <Activity className="h-4 w-4" /> Replay mechanics inside this window
        </div>
        <span className="text-[10px] font-bold uppercase text-slate-500">
          {mechanics.length} recorded mechanic{mechanics.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">
        These markers come directly from the existing Fight Replay mechanic track. They are shown because they occurred inside this event window; temporal proximity is not treated as causation.
      </p>

      <div className="mt-3 grid gap-2">
        {mechanics.map((mechanic, index) => (
          <div
            key={`${mechanic.timestampMs}-${mechanic.name}-${mechanic.actor}-${index}`}
            className="rounded-xl border border-white/[0.06] bg-black/25 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black text-slate-200">{formatTime(mechanic.timestampMs)}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                    {formatOffset(mechanic.offsetMs)}
                  </span>
                  <span className="rounded-full border border-violet-400/15 bg-violet-500/[0.05] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-200">
                    {mechanic.severity}
                  </span>
                  {mechanic.linkedPlayer && (
                    <span className="rounded-full border border-sky-400/20 bg-sky-500/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-200">
                      linked player
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs font-black text-slate-100">{mechanic.name}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Actor: <span className="text-slate-300">{mechanic.actor || "unknown"}</span>
                  {mechanic.account ? <> · Account: <span className="text-slate-300">{mechanic.account}</span></> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigateToView("fight-replay", {
                  source: "intelligence",
                  fightIndex,
                  account: mechanic.account,
                  timestampMs: mechanic.timestampMs,
                  eventId,
                })}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-violet-200 transition hover:border-violet-300/35 hover:bg-violet-500/[0.1]"
              >
                Open Fight Replay <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
