import { useMemo } from "react";
import { BrainCircuit, ChevronRight } from "lucide-react";
import { buildIntelligenceDashboard } from "../../lib/intelligence/intelligenceDashboard";
import { buildReplayIntelligenceAnchors } from "../../lib/replayIntelligenceAnchors";
import { useReport } from "../../store/ReportContext";
import { useView } from "../../store/ViewContext";

function fmtClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function titleForKind(kind: string): string {
  return kind
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReplayIntelligenceAnchorRail() {
  const { report } = useReport();
  const { navigateToView } = useView();
  const replayFights = report?.stats.replayFights;

  const dashboard = useMemo(() => (report ? buildIntelligenceDashboard(report) : null), [report]);
  const anchors = useMemo(() => buildReplayIntelligenceAnchors(dashboard, replayFights), [dashboard, replayFights]);

  if (!report || anchors.length === 0) return null;

  return (
    <section className="rounded-2xl border border-sky-400/15 bg-[#07101c]/90 px-4 py-3 shadow-[0_0_34px_-26px_rgba(56,189,248,0.8)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/[0.08] text-sky-300">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">Intelligence Replay Anchors</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Evidence-backed moments with exact replay coverage. Select one to seek directly to it.</div>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 font-mono text-[10px] text-slate-400">
          {anchors.length} linked event{anchors.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {anchors.map((anchor) => (
          <button
            key={anchor.id}
            type="button"
            title={anchor.summary}
            onClick={() =>
              navigateToView("fight-replay", {
                source: "intelligence",
                fightId: anchor.fightId,
                fightIndex: anchor.fightIndex,
                timestampMs: anchor.timestampMs,
                eventId: anchor.id,
                account: anchor.account,
                metric: titleForKind(anchor.kind),
              })
            }
            className="group min-w-[210px] max-w-[270px] shrink-0 cursor-pointer rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-left transition hover:border-sky-400/30 hover:bg-sky-400/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-black uppercase tracking-[0.13em] text-slate-300 group-hover:text-sky-200">
                {titleForKind(anchor.kind)}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-sky-300" />
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
              <span>F{anchor.fightIndex + 1}</span>
              <span>·</span>
              <span>{fmtClock(anchor.timestampMs)}</span>
              <span>·</span>
              <span className="truncate">{anchor.category}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-slate-500 group-hover:text-slate-400">
              {anchor.summary}
            </p>
            <div className="mt-2 text-[8px] font-bold uppercase tracking-wider text-sky-400/55">
              {anchor.confidence} evidence
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
