import { memo, useRef, useState, type PointerEventHandler, type RefObject } from "react";
import { interpolateFacing, interpolatePosition, isInInterval, type ReplayData } from "../../lib/parseReplayData";
import type { ReplayIntelligenceAnchor } from "../../lib/replayIntelligenceAnchors";
import { classIconSrc } from "../../data/classIconAssets";

function shortName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown";
  return trimmed.length > 16 ? `${trimmed.slice(0, 15)}…` : trimmed;
}

// EI orientations use game-space Y, while replay pixels grow downward.
const FACING_ANGLE_SIGN = -1;
const FACING_ANGLE_OFFSET_DEG = 0;
const REPLAY_MAP_REQUEST_PROPS: Record<string, string> = { referrerPolicy: "no-referrer" };

function facingLineEnd(cx: number, cy: number, length: number, angleDeg: number) {
  const rad = ((FACING_ANGLE_SIGN * angleDeg + FACING_ANGLE_OFFSET_DEG) * Math.PI) / 180;
  return { x2: cx + Math.cos(rad) * length, y2: cy + Math.sin(rad) * length };
}

function facingArrow(cx: number, cy: number, startRadius: number, arrowLength: number, angleDeg: number) {
  const rad = ((FACING_ANGLE_SIGN * angleDeg + FACING_ANGLE_OFFSET_DEG) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return {
    x1: cx + dx * startRadius,
    y1: cy + dy * startRadius,
    x2: cx + dx * (startRadius + arrowLength),
    y2: cy + dy * (startRadius + arrowLength),
  };
}

function playerMarkerRadius(isCommander: boolean, down: boolean, markerUnit: number) {
  const baseRadius = isCommander ? 13.5 : 9.5;
  return (down ? baseRadius + 2 : baseRadius) * markerUnit;
}

export function replayActorTransform(x: number, y: number): string {
  return `translate(${x} ${y})`;
}

interface ReplayMapStageProps {
  data: ReplayData;
  timestampMs: number;
  viewBox: string;
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
  onSelectPlayer: (account: string | null) => void;
}

/**
 * The animated SVG is deliberately isolated from the surrounding evidence
 * workspace. Replay still paints at its bounded visual cadence, while drawer,
 * narrative, and control-state updates do not rebuild every marker.
 *
 * Moving actors use one stable group transform. Child circles, images,
 * labels, and clip paths remain in actor-local coordinates instead of having
 * every SVG geometry attribute rewritten on every frame. This keeps the
 * current frame visually identical while avoiding retained/duplicated paint
 * artifacts in embedded WebViews when many actors move at once.
 */
export function ReplayMapStage({
  data,
  timestampMs,
  viewBox,
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
  const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const players = data.players.map((player, playerIndex) => ({ player, playerIndex }));
  const priority = (account: string, commander: boolean) => account === hoveredAccount ? 3 : account === selectedAccount ? 2 : commander ? 1 : 0;
  players.sort((a, b) => priority(a.player.account, a.player.isCommander) - priority(b.player.account, b.player.isCommander));
  const placedLabels: { x: number; y: number; halfWidth: number }[] = [];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-black/70 shadow-[inset_0_0_50px_rgba(0,0,0,0.55)]">
      <svg
        ref={svgRef}
        preserveAspectRatio="xMidYMid slice"
        viewBox={viewBox}
        className={focusMode ? "h-[clamp(520px,60vh,760px)] w-full select-none touch-none" : "h-[420px] w-full select-none touch-none xl:h-[520px] 2xl:h-[600px]"}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; moved.current = false; onPointerDown(event); }}
        onPointerMove={(event) => {
          if (pointerStart.current && Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 4) moved.current = true;
          onPointerMove(event);
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={(event) => { moved.current = true; pointerStart.current = null; setHoveredAccount(null); onPointerUp(event); }}
        onPointerLeave={onPointerUp}
        onClick={() => { if (!moved.current) onSelectPlayer(null); pointerStart.current = null; }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onSelectPlayer(null); } }}
      >
        <defs>
          <marker id="replay-facing-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#ffffff" />
          </marker>
        </defs>
        <g>
          {showMap && data.map?.images.map((image, index) => {
            const visible = image.endMs <= 0 || (timestampMs >= image.startMs && timestampMs <= image.endMs);
            if (!visible) return null;
            const width = data.map!.width;
            const height = data.map!.height;
            return <image key={`${image.url}-${index}`} href={image.url} x={image.x} y={image.y} width={width} height={height} opacity={0.9} preserveAspectRatio="none" {...REPLAY_MAP_REQUEST_PROPS} />;
          })}

          {showMechanics && (data.mechanics ?? []).filter((mechanic) => Math.abs(mechanic.t - timestampMs) <= 1500 && mechanic.account).map((mechanic, index) => {
            const owner = data.players.find((player) => player.account === mechanic.account);
            const point = owner ? interpolatePosition(owner.points, timestampMs) : null;
            if (!point) return null;
            const age = Math.abs(mechanic.t - timestampMs) / 1500;
            return (
              <g key={`mechanic-${mechanic.t}-${index}`} transform={replayActorTransform(point.x, point.y)}>
                <circle cx={0} cy={0} r={(10 + age * 14) * markerUnit} fill="none" stroke="#fb7185" strokeWidth={2 * markerUnit} opacity={0.7 * (1 - age)} />
              </g>
            );
          })}

          {showCasts && data.players.map((player) => {
            const recent = (player.casts ?? []).filter((cast) => Math.abs(cast.t - timestampMs) <= 600);
            if (recent.length === 0) return null;
            const point = interpolatePosition(player.points, timestampMs);
            if (!point) return null;
            const age = Math.min(...recent.map((cast) => Math.abs(cast.t - timestampMs))) / 600;
            return (
              <g key={`cast-${player.account}`} transform={replayActorTransform(point.x, point.y)}>
                <circle cx={0} cy={0} r={(5 + age * 8) * markerUnit} fill="none" stroke="#fbbf24" strokeWidth={1.5 * markerUnit} opacity={0.6 * (1 - age)} />
              </g>
            );
          })}

          {data.enemies.map((enemy) => {
            const point = interpolatePosition(enemy.points, timestampMs);
            if (!point || isInInterval(enemy.deadIntervals, timestampMs)) return null;
            const down = isInInterval(enemy.downIntervals, timestampMs);
            const angle = showFacing ? interpolateFacing(enemy.facings ?? [], timestampMs) : null;
            const facingEnd = angle == null ? null : facingLineEnd(0, 0, 10 * markerUnit, angle);
            return (
              <g key={enemy.id} transform={replayActorTransform(point.x, point.y)}>
                {facingEnd && (
                  <line x1={0} y1={0} x2={facingEnd.x2} y2={facingEnd.y2} stroke="#fb7185" strokeWidth={1.2 * markerUnit} opacity={0.7} />
                )}
                <circle cx={0} cy={0} r={(down ? 7.5 : 5.4) * markerUnit} fill="#ef4444" fillOpacity={down ? 0.28 : 0.88} stroke={down ? "#fecdd3" : "#7f1d1d"} strokeWidth={1.7 * markerUnit}>
                  <title>{`${enemy.name}${down ? " — downed" : ""}`}</title>
                </circle>
              </g>
            );
          })}

          {players.map(({ player, playerIndex }) => {
            const point = interpolatePosition(player.points, timestampMs);
            if (!point || isInInterval(player.deadIntervals, timestampMs)) return null;
            const down = isInInterval(player.downIntervals, timestampMs);
            const selected = selectedAccount === player.account;
            const intelligenceParticipant = intelligenceAccounts.has(player.account);
            const baseRadius = player.isCommander ? 10.5 : 7.5;
            const iconRadius = playerMarkerRadius(player.isCommander, down, markerUnit);
            const iconSrc = classIconSrc(player.profession);
            const clipId = `replay-icon-clip-${playerIndex}-${player.account.replace(/[^a-zA-Z0-9]/g, "")}`;
            const intelInnerRadius = (baseRadius + 3.5) * markerUnit;
            const intelOuterRadius = (baseRadius + 6.5) * markerUnit;
            const outlineColor = down ? "#fb7185" : "#ffffff";
            const angle = showFacing ? interpolateFacing(player.facings ?? [], timestampMs) : null;
            const facing = angle == null ? null : facingArrow(0, 0, iconRadius, 7 * markerUnit, angle);
            return (
              <g
                key={`${player.account}-${playerIndex}`}
                transform={replayActorTransform(point.x, point.y)}
                onClick={(event) => { event.stopPropagation(); if (!moved.current) onSelectPlayer(selected ? null : player.account); pointerStart.current = null; }}
                onPointerEnter={() => setHoveredAccount(player.account)}
                onPointerDown={(event) => { if (event.pointerType === "mouse") event.preventDefault(); }}
                onPointerLeave={() => setHoveredAccount(null)}
                role="button"
                tabIndex={0}
                aria-label={`${player.name}, ${player.profession}${player.isCommander ? ", commander" : ""}`}
                aria-pressed={selected}
                onFocus={() => setHoveredAccount(player.account)}
                onBlur={() => setHoveredAccount(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectPlayer(selected ? null : player.account);
                  }
                }}
                className="cursor-pointer"
              >
                <title>{`${player.name} · ${player.profession}${player.isCommander ? " · commander" : ""}${down ? " · downed" : ""}${intelligenceParticipant ? " · Intelligence event participant" : ""}`}</title>
                {facing && (
                  <line
                    x1={facing.x1}
                    y1={facing.y1}
                    x2={facing.x2}
                    y2={facing.y2}
                    stroke="#ffffff"
                    strokeWidth={1.3 * markerUnit}
                    opacity={0.9}
                    markerEnd="url(#replay-facing-arrow)"
                  />
                )}
                {intelligenceParticipant && (
                  <circle cx={0} cy={0} r={intelInnerRadius} fill="none" stroke="#7dd3fc" strokeWidth={1.4 * markerUnit} opacity={selected ? 0.45 : 0.72} pointerEvents="none">
                    <animate attributeName="r" values={`${intelInnerRadius};${intelOuterRadius};${intelInnerRadius}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values={selected ? "0.28;0.5;0.28" : "0.48;0.86;0.48"} dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                {selected && <circle cx={0} cy={0} r={(baseRadius + 7) * markerUnit} fill="none" stroke="#fbbf24" strokeWidth={2 * markerUnit} opacity={0.95} />}
                {player.isCommander && <circle cx={0} cy={0} r={(baseRadius + 3) * markerUnit} fill="none" stroke="#f59e0b" strokeWidth={2 * markerUnit} opacity={0.95} />}
                {iconSrc ? (
                  <>
                    <clipPath id={clipId}>
                      <circle cx={0} cy={0} r={iconRadius} />
                    </clipPath>
                    <circle cx={0} cy={0} r={iconRadius} fill="#111820" pointerEvents="none" />
                    <image href={iconSrc} x={-iconRadius} y={-iconRadius} width={iconRadius * 2} height={iconRadius * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" opacity={down ? 0.55 : 1} />
                    <circle cx={0} cy={0} r={iconRadius} fill="none" stroke={outlineColor} strokeWidth={1 * markerUnit} />
                  </>
                ) : (
                  <circle cx={0} cy={0} r={iconRadius} fill={player.inSquad ? "#475569" : "#334155"} fillOpacity={down ? 0.35 : 0.95} stroke={outlineColor} strokeWidth={1 * markerUnit} />
                )}
              </g>
            );
          })}
          <g pointerEvents="none" data-replay-labels="true">
            {players.map(({ player, playerIndex }) => {
              const selected = player.account === selectedAccount;
              if (!selected && !player.isCommander && player.account !== hoveredAccount) return null;
              const point = interpolatePosition(player.points, timestampMs);
              if (!point || isInInterval(player.deadIntervals, timestampMs)) return null;
              const label = shortName(player.name);
              const halfWidth = label.length * 3.2 * markerUnit;
              let y = point.y - (player.isCommander ? 16.5 : 13.5) * markerUnit;
              while (placedLabels.some(other => Math.abs(other.x - point.x) < other.halfWidth + halfWidth && Math.abs(other.y - y) < 13 * markerUnit)) y -= 14 * markerUnit;
              placedLabels.push({ x: point.x, y, halfWidth });
              return <text key={`${player.account}-${playerIndex}`} x={point.x} y={y} textAnchor="middle" fontSize={9 * markerUnit} fontWeight="800" fill={selected ? "#fef3c7" : "#e2e8f0"} stroke="#020617" strokeWidth={2.5 * markerUnit} paintOrder="stroke">{label}</text>;
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}

export default memo(ReplayMapStage);
