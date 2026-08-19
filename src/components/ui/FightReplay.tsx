import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, X, Film } from "lucide-react";
import type { RawFightLog } from "../../types/rawFight";
import { parseReplayData, interpolatePosition, isInInterval } from "../../lib/parseReplayData";
import { inspectReplayPlayer } from "../../lib/replayInspection";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

type HoverState = {
  account: string;
  x: number;
  y: number;
} | null;

export default function FightReplay({ log, onClose }: { log: RawFightLog; onClose: () => void }) {
  const data = useMemo(() => parseReplayData(log), [log]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [hover, setHover] = useState<HoverState>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const replayFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!playing || !data) return;
    function tick(now: number) {
      if (lastTsRef.current != null) {
        const dt = (now - lastTsRef.current) * speed;
        setT((prev) => {
          const next = prev + dt;
          return next >= data!.durationMs ? 0 : next;
        });
      }
      lastTsRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, speed, data]);

  useEffect(() => {
    if (playing) setHover(null);
  }, [playing]);

  const hoveredInspection = useMemo(() => {
    if (!hover || playing) return null;
    return inspectReplayPlayer(log, hover.account, t);
  }, [hover, playing, log, t]);

  const hoveredTrack = useMemo(() => {
    if (!hover || !data) return null;
    return data.players.find((player) => player.account === hover.account) ?? null;
  }, [hover, data]);

  function updateHoverPosition(account: string, clientX: number, clientY: number) {
    if (playing || !replayFrameRef.current) return;
    const rect = replayFrameRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(clientX - rect.left + 12, rect.width - 290));
    const y = Math.max(8, Math.min(clientY - rect.top + 12, rect.height - 190));
    setHover({ account, x, y });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0a101f] border border-amber-500/20 rounded-2xl p-5 w-full max-w-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Film className="w-3.5 h-3.5" /> Fight Replay
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-rose-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!data ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">Replay data isn't available for this fight.</p>
            <p className="text-[11px] text-slate-500 mt-1">The parsed log didn't include per-tick position data.</p>
          </div>
        ) : (
          <>
            <div ref={replayFrameRef} className="relative bg-black/40 rounded-xl border border-slate-800">
              <svg
                viewBox={(() => {
                  const { bounds } = data;
                  const pad = Math.max((bounds.maxX - bounds.minX) * 0.08, 50);
                  return `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.maxX - bounds.minX + pad * 2} ${bounds.maxY - bounds.minY + pad * 2}`;
                })()}
                className="w-full h-80 rounded-xl"
                style={{ transform: "scaleY(-1)" }}
              >
                {data.players.map((p) => {
                  const pt = interpolatePosition(p.points, t);
                  if (!pt) return null;
                  const dead = isInInterval(p.deadIntervals, t);
                  const down = isInInterval(p.downIntervals, t);
                  if (dead) return null;
                  return (
                    <circle
                      key={p.account}
                      cx={pt.x}
                      cy={pt.y}
                      r={down ? 55 : p.isCommander ? 65 : 45}
                      fill={p.inSquad ? "#f59e0b" : "#64748b"}
                      fillOpacity={down ? 0.3 : 0.9}
                      stroke={down ? "#f43f5e" : p.isCommander ? "#fbbf24" : "none"}
                      strokeWidth={down || p.isCommander ? 14 : 0}
                      className={!playing ? "cursor-help" : undefined}
                      onMouseEnter={(event) => updateHoverPosition(p.account, event.clientX, event.clientY)}
                      onMouseMove={(event) => updateHoverPosition(p.account, event.clientX, event.clientY)}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
              </svg>

              {!playing && hover && hoveredInspection && (
                <div
                  className="pointer-events-none absolute z-20 w-[278px] rounded-xl border border-amber-500/25 bg-[#080d18]/95 p-3 shadow-2xl backdrop-blur"
                  style={{ left: hover.x, top: hover.y }}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-slate-100">{hoveredInspection.name}</div>
                      <div className="truncate text-[10px] text-slate-500">{hoveredInspection.account}</div>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-amber-300">
                      {hoveredInspection.profession}
                    </span>
                  </div>

                  {hoveredTrack && isInInterval(hoveredTrack.downIntervals, t) && (
                    <div className="mt-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                      Downed
                    </div>
                  )}

                  {!hoveredInspection.hasTimestampedBuffState ? (
                    <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
                      Timestamped boon/condition state is unavailable in this report.
                    </div>
                  ) : (
                    <>
                      <div className="mt-2">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400/80">Boons</div>
                        <div className="flex flex-wrap gap-1">
                          {hoveredInspection.boons.length > 0 ? hoveredInspection.boons.map((effect) => (
                            <span
                              key={`boon-${effect.id}`}
                              className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-200"
                            >
                              {effect.icon && <img src={effect.icon} alt="" className="h-3 w-3 rounded-sm" referrerPolicy="no-referrer" />}
                              {effect.name}{effect.stacks > 1 ? ` ×${effect.stacks}` : ""}
                            </span>
                          )) : <span className="text-[9px] text-slate-600">None active</span>}
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-rose-400/80">Conditions</div>
                        <div className="flex flex-wrap gap-1">
                          {hoveredInspection.conditions.length > 0 ? hoveredInspection.conditions.map((effect) => (
                            <span
                              key={`condition-${effect.id}`}
                              className="inline-flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-200"
                            >
                              {effect.icon && <img src={effect.icon} alt="" className="h-3 w-3 rounded-sm" referrerPolicy="no-referrer" />}
                              {effect.name}{effect.stacks > 1 ? ` ×${effect.stacks}` : ""}
                            </span>
                          )) : <span className="text-[9px] text-slate-600">None active</span>}
                        </div>
                      </div>

                      <div className="mt-2 border-t border-white/10 pt-2 text-[9px]">
                        {hoveredInspection.controlEffects.length > 0 ? (
                          <span className="font-semibold text-rose-300">
                            Control: {hoveredInspection.controlEffects.join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Hard CC: unavailable from this report's timestamped state data
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setPlaying((v) => !v)}
                className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0 hover:bg-amber-500/25 transition-colors"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={data.durationMs}
                value={t}
                onChange={(e) => setT(Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="text-[11px] font-mono text-slate-400 w-24 text-right flex-shrink-0">
                {fmtClock(t)} / {fmtClock(data.durationMs)}
              </span>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-slate-300 text-[11px] rounded-lg px-2 py-1.5 flex-shrink-0"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
                <option value={8}>8x</option>
              </select>
            </div>

            <p className="text-[10px] text-slate-500 mt-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Squad
              <span className="inline-block w-2 h-2 rounded-full bg-slate-500 ml-2" /> Ally / non-squad
              <span className="inline-block w-2 h-2 rounded-full border border-rose-500 ml-2" /> Downed
              <span className="ml-auto text-slate-600">Pause, then hover a player for state details</span>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
