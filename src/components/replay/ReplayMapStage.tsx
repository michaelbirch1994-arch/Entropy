import { memo, type PointerEventHandler, type RefObject } from "react";
import { interpolateFacing, interpolatePosition, isInInterval, type ReplayData } from "../../lib/parseReplayData";
import type { ReplayIntelligenceAnchor } from "../../lib/replayIntelligenceAnchors";

function shortName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown";
  return trimmed.length > 16 ? `${trimmed.slice(0, 15)}…` : trimmed;
}

const FACING_ANGLE_SIGN = 1;
const FACING_ANGLE_OFFSET_DEG = 0;

function facingLineEnd(cx: number, cy: number, length: number, angleDeg: number) {
  const rad = ((FACING_ANGLE_SIGN * angleDeg + FACING_ANGLE_OFFSET_DEG) * Math.PI) / 180;
  return { x2: cx + Math.cos(rad) * length, y2: cy + Math.sin(rad) * length };
}

interface ReplayMapStageProps {
  data: ReplayData;
  timestampMs: number;
  viewBox: string;
  flipTransform: string;
  markerUnit: number;
  selectedAccount: string | null;
  alignedIntelligenceEvent: ReplayIntelligenceAnchor | null;
  showMap: boolean;
  showMechanics: boolean;
  showCasts: boolean;
  showFacing: boolean;
  zoom: number;
  dragging: boolean;
  focusMode: boolean;
  svgRef: RefObject<SVGSVGElement | null>;
  onPointerDown: PointerEventHandler<SVGSVGElement>;
  onPointerMove: PointerEventHandler<SVGSVGElement>;
  onPointerUp: PointerEventHandler<SVGSVGElement>;
  onSelectPlayer: (account: string) => void;
}

/**
 * The animated SVG is deliberately isolated from the surrounding evidence
 * workspace. Replay still paints at its bounded visual cadence, while drawer,
 * narrative, and control-state updates do not rebuild every marker.
 */
function ReplayMapStage({
  data,
  timestampMs,
  viewBox,
  flipTransform,
  markerUnit,
  selectedAccount,
  alignedIntelligenceEvent,
  showMap,
  showMechanics,
  showCasts,
  showFacing,
  zoom,
  dragging,
  focusMode,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSelectPlayer,
}: ReplayMapStageProps) {
  const intelligenceAccounts = new Set(alignedIntelligenceEvent?.accounts ?? []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-black/70 shadow-[inset_0_0_50px_rgba(0,0,0,0.55)]">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={focusMode ? "h-[clamp(520px,60vh,760px)] w-full select-none touch-none" : "h-[420px] w-full select-none touch-none xl:h-[520px] 2xl:h-[600px]"}
        style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={flipTransform}>
          {showMap && data.map?.images.map((image, index) => {
            const visible = image.endMs <= 0 || (timestampMs >= image.startMs && timestampMs <= image.endMs);
            if (!visible) return null;
            const width = data.map!.width;
            const height = data.map!.height;
            return <image key={`${image.url}-${index}`} href={image.url} x={image.x} y={image.y} width={width} height={height} opacity={0.9} preserveAspectRatio="none" transform={`translate(0 ${2 * image.y + height}) scale(1 -1)`} />;
          })}

          {showMechanics && (data.mechanics ?? []).filter((mechanic) => Math.abs(mechanic.t - timestampMs) <= 1500 && mechanic.account).map((mechanic, index) => {
            const owner = data.players.find((player) => player.account === mechanic.account);
            const point = owner ? interpolatePosition(owner.points, timestampMs) : null;
            if (!point) return null;
            const age = Math.abs(mechanic.t - timestampMs) / 1500;
            return <circle key={`mechanic-${mechanic.t}-${index}`} cx={point.x} cy={point.y} r={(10 + age * 14) * markerUnit} fill="none" stroke="#fb7185" strokeWidth={2 * markerUnit} opacity={0.7 * (1 - age)} />;
          })}

          {showCasts && data.players.map((player) => {
            const recent = (player.casts ?? []).filter((cast) => Math.abs(cast.t - timestampMs) <= 600);
            if (recent.length === 0) return null;
            const point = interpolatePosition(player.points, timestampMs);
            if (!point) return null;
            const age = Math.min(...recent.map((cast) => Math.abs(cast.t - timestampMs))) / 600;
            return <circle key={`cast-${player.account}`} cx={point.x} cy={point.y} r={(5 + age * 8) * markerUnit} fill="none" stroke="#fbbf24" strokeWidth={1.5 * markerUnit} opacity={0.6 * (1 - age)} />;
          })}

          {showFacing && data.enemies.map((enemy) => {
            if (isInInterval(enemy.deadIntervals, timestampMs)) return null;
            const point = interpolatePosition(enemy.points, timestampMs);
            const angle = interpolateFacing(enemy.facings ?? [], timestampMs);
            if (!point || angle == null) return null;
            const end = facingLineEnd(point.x, point.y, 10 * markerUnit, angle);
            return <line key={`enemy-facing-${enemy.id}`} x1={point.x} y1={point.y} x2={end.x2} y2={end.y2} stroke="#fb7185" strokeWidth={1.2 * markerUnit} opacity={0.7} />;
          })}

          {data.enemies.map((enemy) => {
            const point = interpolatePosition(enemy.points, timestampMs);
            if (!point || isInInterval(enemy.deadIntervals, timestampMs)) return null;
            const down = isInInterval(enemy.downIntervals, timestampMs);
            return (
              <circle key={enemy.id} cx={point.x} cy={point.y} r={(down ? 7.5 : 5.4) * markerUnit} fill="#ef4444" fillOpacity={down ? 0.28 : 0.88} stroke={down ? "#fecdd3" : "#7f1d1d"} strokeWidth={1.7 * markerUnit}>
                <title>{`${enemy.name}${down ? " — downed" : ""}`}</title>
              </circle>
            );
          })}

          {showFacing && data.players.map((player) => {
            if (isInInterval(player.deadIntervals, timestampMs)) return null;
            const point = interpolatePosition(player.points, timestampMs);
            const angle = interpolateFacing(player.facings ?? [], timestampMs);
            if (!point || angle == null) return null;
            const end = facingLineEnd(point.x, point.y, 11 * markerUnit, angle);
            return <line key={`player-facing-${player.account}`} x1={point.x} y1={point.y} x2={end.x2} y2={end.y2} stroke={player.inSquad ? "#38bdf8" : "#94a3b8"} strokeWidth={1.2 * markerUnit} opacity={0.75} />;
          })}

          {data.players.map((player) => {
            const point = interpolatePosition(player.points, timestampMs);
            if (!point || isInInterval(player.deadIntervals, timestampMs)) return null;
            const down = isInInterval(player.downIntervals, timestampMs);
            const selected = selectedAccount === player.account;
            const intelligenceParticipant = intelligenceAccounts.has(player.account);
            const baseRadius = player.isCommander ? 8.5 : 6;
            const fill = player.inSquad ? "#38bdf8" : "#94a3b8";
            const intelInnerRadius = (baseRadius + 3.5) * markerUnit;
            const intelOuterRadius = (baseRadius + 6.5) * markerUnit;
            return (
              <g key={player.account} onClick={(event) => { event.stopPropagation(); onSelectPlayer(player.account); }} className="cursor-pointer">
                {intelligenceParticipant && (
                  <circle cx={point.x} cy={point.y} r={intelInnerRadius} fill="none" stroke="#7dd3fc" strokeWidth={1.4 * markerUnit} opacity={selected ? 0.45 : 0.72} pointerEvents="none">
                    <animate attributeName="r" values={`${intelInnerRadius};${intelOuterRadius};${intelInnerRadius}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values={selected ? "0.28;0.5;0.28" : "0.48;0.86;0.48"} dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                {selected && <circle cx={point.x} cy={point.y} r={(baseRadius + 7) * markerUnit} fill="none" stroke="#fbbf24" strokeWidth={2 * markerUnit} opacity={0.95} />}
                {player.isCommander && <circle cx={point.x} cy={point.y} r={(baseRadius + 3) * markerUnit} fill="none" stroke="#f59e0b" strokeWidth={2 * markerUnit} opacity={0.95} />}
                <circle cx={point.x} cy={point.y} r={(down ? baseRadius + 1.5 : baseRadius) * markerUnit} fill={fill} fillOpacity={down ? 0.35 : 0.95} stroke={down ? "#fb7185" : "#e2e8f0"} strokeWidth={1.4 * markerUnit}>
                  <title>{`${player.name} · ${player.profession}${player.isCommander ? " · commander" : ""}${down ? " · downed" : ""}${intelligenceParticipant ? " · Intelligence event participant" : ""}`}</title>
                </circle>
                {(selected || player.isCommander) && (
                  <text x={point.x} y={point.y - (baseRadius + 6) * markerUnit} textAnchor="middle" fontSize={9 * markerUnit} fontWeight="800" fill={selected ? "#fef3c7" : "#e2e8f0"} stroke="#020617" strokeWidth={2.5 * markerUnit} paintOrder="stroke" transform={`translate(0 ${2 * (point.y - (baseRadius + 6) * markerUnit)}) scale(1 -1)`}>{shortName(player.name)}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default memo(ReplayMapStage);
