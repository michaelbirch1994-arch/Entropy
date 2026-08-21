import { memo } from "react";
import { BrainCircuit, Crosshair } from "lucide-react";
import type { ReplayData, ReplayPlayerTrack } from "../../lib/parseReplayData";
import type { ReplayIntelligenceAnchor } from "../../lib/replayIntelligenceAnchors";
import ReplayEventEvidencePanel from "./ReplayEventEvidencePanel";
import ReplayTacticalStatePanel from "./ReplayTacticalStatePanel";

export type ReplayInspectorMode = "intelligence" | "player";

function ReplayInspectorDrawer({
  data,
  player,
  timestampMs,
  evidenceEvent,
  mode,
  focusMode,
  onModeChange,
  onSelectAccount,
}: {
  data: ReplayData;
  player: ReplayPlayerTrack | null;
  timestampMs: number;
  evidenceEvent: ReplayIntelligenceAnchor | null;
  mode: ReplayInspectorMode;
  focusMode: boolean;
  onModeChange: (mode: ReplayInspectorMode) => void;
  onSelectAccount: (account: string) => void;
}) {
  const heightClass = focusMode
    ? "h-[clamp(520px,60vh,760px)]"
    : "h-[420px] xl:h-[520px] 2xl:h-[600px]";

  return (
    <aside className={`${heightClass} flex min-w-0 flex-col overflow-hidden rounded-xl border border-sky-400/15 bg-[#060c14]/95 shadow-[0_0_35px_-25px_rgba(56,189,248,0.75)]`}>
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.07] bg-black/20 p-2">
        <button
          type="button"
          onClick={() => onModeChange("intelligence")}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[9px] font-black uppercase tracking-wider transition ${mode === "intelligence" ? "border-sky-300/30 bg-sky-300/[0.09] text-sky-200" : "border-white/[0.07] text-slate-500 hover:text-slate-300"}`}
        >
          <BrainCircuit className="h-3 w-3" /> Live Intel
          {evidenceEvent && <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.85)]" aria-label="Evidence available" />}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("player")}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[9px] font-black uppercase tracking-wider transition ${mode === "player" ? "border-amber-300/30 bg-amber-300/[0.08] text-amber-200" : "border-white/[0.07] text-slate-500 hover:text-slate-300"}`}
        >
          <Crosshair className="h-3 w-3" /> Player
          {player && <span className="max-w-24 truncate font-mono normal-case tracking-normal text-slate-400">{player.name}</span>}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
        {mode === "intelligence" ? (
          evidenceEvent ? (
            <ReplayEventEvidencePanel
              data={data}
              event={evidenceEvent}
              t={evidenceEvent.timestampMs}
              onSelectAccount={onSelectAccount}
            />
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center px-5 text-center">
              <BrainCircuit className="h-6 w-6 text-sky-400/45" />
              <div className="mt-3 text-[10px] font-black uppercase tracking-[0.17em] text-slate-300">Live Intelligence</div>
              <p className="mt-2 max-w-56 text-[10px] leading-relaxed text-slate-500">
                Evidence will update inside this drawer without moving the replay map or the page.
              </p>
            </div>
          )
        ) : (
          <ReplayTacticalStatePanel data={data} player={player} t={timestampMs} />
        )}
      </div>
    </aside>
  );
}

export default memo(ReplayInspectorDrawer);
