import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Film } from "lucide-react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { interpolatePosition, isInInterval } from "../lib/parseReplayData";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function ReplayView() {
  const { report } = useReport();
  const fights = report?.stats.replayFights;
  const [fightIdx, setFightIdx] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const fight = fights?.[fightIdx];

  useEffect(() => {
    setT(0);
    setPlaying(false);
  }, [fightIdx]);

  useEffect(() => {
    if (!playing || !fight) return;
    function tick(now: number) {
      if (lastTsRef.current != null) {
        const dt = (now - lastTsRef.current) * speed;
        setT((prev) => {
          const next = prev + dt;
          return next >= fight!.data.durationMs ? 0 : next;
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
  }, [playing, speed, fight]);

  const viewBox = useMemo(() => {
    if (!fight) return "0 0 100 100";
    const { bounds } = fight.data;
    const pad = Math.max((bounds.maxX - bounds.minX) * 0.08, 50);
    return `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.maxX - bounds.minX + pad * 2} ${bounds.maxY - bounds.minY + pad * 2}`;
  }, [fight]);

  if (!report) return null;

  if (!fights || fights.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Fight Replay"
          icon={<Film className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No replay data available for this report.
              <p className="text-[11px] text-slate-600 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports whose parse included
                combat replay data.
              </p>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      {fights.length > 1 && (
        <select
          value={fightIdx}
          onChange={(e) => setFightIdx(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2"
        >
          {fights.map((f, i) => (
            <option key={f.fightId} value={i}>{f.fightName}</option>
          ))}
        </select>
      )}

      {fight && (
        <Panel
          title="Fight Replay"
          subtitle={`${fight.fightName} - scrubbable 2D squad positions`}
          icon={<Film className="w-3.5 h-3.5" />}
          action={`${fight.data.players.length} players tracked`}
        >
          <div className="bg-black/40 rounded-xl border border-slate-800 overflow-hidden">
            <svg viewBox={viewBox} className="w-full h-[420px]" style={{ transform: "scaleY(-1)" }}>
              {fight.data.players.map((p) => {
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
                  />
                );
              })}
            </svg>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0 hover:bg-amber-500/25 transition-colors cursor-pointer"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={fight.data.durationMs}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <span className="text-[11px] font-mono text-slate-400 w-24 text-right flex-shrink-0">
              {fmtClock(t)} / {fmtClock(fight.data.durationMs)}
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

          <p className="text-[10px] text-slate-600 mt-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Squad
            <span className="inline-block w-2 h-2 rounded-full bg-slate-500 ml-2" /> Ally / non-squad
            <span className="inline-block w-2 h-2 rounded-full border border-rose-500 ml-2" /> Downed
          </p>
        </Panel>
      )}
    </div>
  );
}
