import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Film, Crosshair } from "lucide-react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { interpolatePosition, isInInterval, distanceBetween } from "../lib/parseReplayData";

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

  // Live squad/enemy headcounts and average squad spread from the tag, all
  // recomputed at the current scrub position straight from the same replay
  // points the dots are drawn from - not pre-baked report averages, so it
  // tracks exactly what's on screen at time t.
  const liveStats = useMemo(() => {
    if (!fight) return null;
    const squadAlive = fight.data.players.filter((p) => p.inSquad && !isInInterval(p.deadIntervals, t));
    const alliesAlive = fight.data.players.filter((p) => !p.inSquad && !isInInterval(p.deadIntervals, t));
    const enemiesAlive = fight.data.enemies.filter((e) => !isInInterval(e.deadIntervals, t));
    const commander = squadAlive.find((p) => p.isCommander);
    const commanderPt = commander ? interpolatePosition(commander.points, t) : null;
    let distSum = 0;
    let distCount = 0;
    if (commanderPt) {
      squadAlive.forEach((p) => {
        if (p.isCommander) return;
        const pt = interpolatePosition(p.points, t);
        const d = distanceBetween(pt, commanderPt);
        if (d != null) {
          distSum += d;
          distCount++;
        }
      });
    }
    return {
      squadCount: squadAlive.length,
      allyCount: alliesAlive.length,
      enemyCount: enemiesAlive.length,
      avgDistToTag: distCount > 0 ? distSum / distCount : null,
      hasCommander: !!commanderPt,
    };
  }, [fight, t]);

  // "Bomb"/focus-fire detection: cluster enemy down-state START timestamps
  // within a short window. EI's export has no per-hit damage timestamps, so
  // we can't attribute a burst to specific skills/players here - but every
  // real target's down/dead intervals ARE timestamped, so multiple enemies
  // going down within a few seconds of each other is a solid, honest proxy
  // for a squad successfully bombing a group rather than trading single
  // targets. Clicking a detected bomb seeks the scrubber to that moment.
  const BOMB_WINDOW_MS = 3000;
  const bombEvents = useMemo(() => {
    if (!fight) return [];
    const downs = fight.data.enemies
      .flatMap((e) => e.downIntervals.map(([start]) => ({ t: start, enemy: e.name })))
      .sort((a, b) => a.t - b.t);
    const clusters: { t: number; count: number; enemies: string[] }[] = [];
    let i = 0;
    while (i < downs.length) {
      let j = i;
      const enemies: string[] = [];
      while (j < downs.length && downs[j].t - downs[i].t <= BOMB_WINDOW_MS) {
        enemies.push(downs[j].enemy);
        j++;
      }
      if (enemies.length >= 2) {
        clusters.push({ t: downs[i].t, count: enemies.length, enemies });
      }
      i = j > i ? j : i + 1;
    }
    return clusters.sort((a, b) => b.count - a.count).slice(0, 12);
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
              <p className="text-[11px] text-slate-500 mt-1">
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

            {fight && bombEvents.length > 0 && (
        <Panel
          title="Detected Bombs"
          subtitle="Moments where multiple tracked enemies went down within 3 seconds of each other - a proxy for successful focus fire, not an attribution of who did it"
          icon={<Crosshair className="w-3.5 h-3.5" />}
          action={`${bombEvents.length} detected`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {bombEvents.map((b, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setT(b.t); setPlaying(false); }}
                className="text-left rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 transition-colors px-3 py-2"
              >
                <div className="text-sm font-black text-rose-300 font-mono">{b.count} downed</div>
                <div className="text-[10px] text-slate-500 font-mono">{fmtClock(b.t)}</div>
              </button>
            ))}
          </div>
        </Panel>
      )}

{fight && (
        <Panel
          title="Fight Replay"
          subtitle={`${fight.fightName} - scrubbable 2D positions, squad + tracked enemies`}
          icon={<Film className="w-3.5 h-3.5" />}
          action={`${fight.data.players.length} players tracked`}
        >
          {/* Live readout - the numbers that actually change as you scrub,
              instead of the map being the only signal on screen. */}
          {liveStats && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-amber-400/70 font-bold">Squad Alive</div>
                <div className="text-lg font-black text-amber-300 font-mono">{liveStats.squadCount}</div>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-rose-400/70 font-bold">Enemies Tracked</div>
                <div className="text-lg font-black text-rose-300 font-mono">{liveStats.enemyCount}</div>
              </div>
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-sky-400/70 font-bold">Avg. Dist to Tag</div>
                <div className="text-lg font-black text-sky-300 font-mono">
                  {liveStats.hasCommander && liveStats.avgDistToTag != null ? Math.round(liveStats.avgDistToTag) : "—"}
                </div>
              </div>
            </div>
          )}

          <div className="bg-black/40 rounded-xl border border-slate-800 overflow-hidden">
            <svg viewBox={viewBox} className="w-full h-[420px]" style={{ transform: "scaleY(-1)" }}>
              {fight.data.enemies.map((e) => {
                const pt = interpolatePosition(e.points, t);
                if (!pt) return null;
                const dead = isInInterval(e.deadIntervals, t);
                const down = isInInterval(e.downIntervals, t);
                if (dead) return null;
                return (
                  <circle
                    key={e.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={down ? 45 : 38}
                    fill="#f43f5e"
                    fillOpacity={down ? 0.25 : 0.75}
                    stroke={down ? "#f43f5e" : "none"}
                    strokeWidth={down ? 10 : 0}
                  />
                );
              })}
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

          <p className="text-[10px] text-slate-500 mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Squad
            <span className="inline-block w-2 h-2 rounded-full bg-slate-500 ml-2" /> Ally / non-squad
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-2" /> Enemy
            <span className="inline-block w-2 h-2 rounded-full border border-rose-500 ml-2" /> Downed
          </p>
        </Panel>
      )}
    </div>
  );
}
