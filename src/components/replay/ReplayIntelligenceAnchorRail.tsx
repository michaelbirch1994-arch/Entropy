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
    <section className="theme-evidence-gate rounded-2xl border border-theme-accent/25 bg-theme-surface/95 px-4 py-3 shadow-[inset_2px_0_0_color-mix(in_srgb,var(--theme-accent)_50%,transparent)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-theme-accent/25 bg-theme-accent/[0.08] text-theme-accent-strong">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-accent-strong">Intelligence Replay Anchors</div>
            <div className="mt-0.5 text-[10px] text-theme-muted">Evidence-backed moments with exact replay coverage. Select one to seek directly to it.</div>
          </div>
        </div>
        <div className="rounded-full border border-theme-border bg-theme-surface-inset px-2.5 py-1 font-mono text-[10px] text-theme-muted">
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
            className="group min-w-[210px] max-w-[270px] shrink-0 cursor-pointer rounded-xl border border-theme-border bg-theme-surface-inset/55 px-3 py-2.5 text-left transition hover:border-theme-accent/35 hover:bg-theme-accent/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent-strong/60"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-black uppercase tracking-[0.13em] text-theme-text/85 group-hover:text-theme-accent-strong">
                {titleForKind(anchor.kind)}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-theme-faint transition group-hover:translate-x-0.5 group-hover:text-theme-accent-strong" />
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-theme-muted">
              <span>F{anchor.fightIndex + 1}</span>
              <span>·</span>
              <span>{fmtClock(anchor.timestampMs)}</span>
              <span>·</span>
              <span className="truncate">{anchor.category}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-theme-muted group-hover:text-theme-text/75">
              {anchor.summary}
            </p>
            <div className="mt-2 text-[8px] font-bold uppercase tracking-wider text-theme-accent/70">
              {anchor.confidence} evidence
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
