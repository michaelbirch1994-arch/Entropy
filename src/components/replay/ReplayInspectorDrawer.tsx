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

  const modeClass = (selected: boolean) =>
    selected
      ? "border-theme-accent/35 bg-theme-accent/[0.09] text-theme-accent-strong"
      : "border-theme-border bg-theme-surface text-theme-muted hover:border-theme-accent/25 hover:text-theme-text";

  return (
    <aside className={`${heightClass} flex min-w-0 flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface/95 shadow-[0_18px_45px_-36px_rgba(0,0,0,0.95)]`}>
      <div className="flex shrink-0 items-center gap-1 border-b border-theme-border/70 bg-theme-surface-inset/65 p-2">
        <button
          type="button"
          onClick={() => onModeChange("intelligence")}
          aria-pressed={mode === "intelligence"}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[9px] font-black uppercase tracking-wider transition ${modeClass(mode === "intelligence")}`}
        >
          <BrainCircuit className="h-3 w-3" /> Live Intel
          {evidenceEvent && <span className="h-1.5 w-1.5 rounded-full bg-theme-accent-strong shadow-[0_0_8px_color-mix(in_srgb,var(--theme-accent)_55%,transparent)]" aria-label="Evidence available" />}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("player")}
          aria-pressed={mode === "player"}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[9px] font-black uppercase tracking-wider transition ${modeClass(mode === "player")}`}
        >
          <Crosshair className="h-3 w-3" /> Player
          {player && <span className="max-w-24 truncate font-mono normal-case tracking-normal text-theme-text/75">{player.name}</span>}
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
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-theme-accent/20 bg-theme-accent/[0.06] text-theme-accent">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div className="mt-3 text-[10px] font-black uppercase tracking-[0.17em] text-theme-text">Live Intelligence</div>
              <p className="mt-2 max-w-56 text-[10px] leading-relaxed text-theme-muted">
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
