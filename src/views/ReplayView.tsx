import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Film, Crosshair, Download } from "lucide-react";
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
  // Optional overlay layers. Casts default off: a WvW pull produces
  // thousands of them and they bury the squad dots otherwise.
  const [showMap, setShowMap] = useState(true);
  const [showMechanics, setShowMechanics] = useState(true);
  const [showCasts, setShowCasts] = useState(false);
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

  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);

  useEffect(() => {
    if (!fight) return;
    setClipStart(0);
    setClipEnd(fight.data.durationMs);
  }, [fight]);

  // Standalone, dependency-free HTML export of a trimmed time window of the
  // current replay - no server/backend involved, so "shareable" here means a
  // single .html file someone can open directly in any browser. Re-implements
  // the same dot-drawing/interpolation logic as the React view in plain JS
  // since the exported file can't import from this app's bundle.
  function exportClip() {
    if (!fight) return;
    const start = Math.max(0, Math.min(clipStart, clipEnd));
    const end = Math.min(fight.data.durationMs, Math.max(clipStart, clipEnd));
    if (end - start < 500) return;

    const trim = (points: { t: number; x: number; y: number }[]) =>
      points.filter((p) => p.t >= start - 500 && p.t <= end + 500).map((p) => [p.t - start, p.x, p.y]);
    const trimIntervals = (intervals: [number, number][]) =>
      intervals
        .filter(([s0, e0]) => e0 >= start && s0 <= end)
        .map(([s0, e0]) => [Math.max(0, s0 - start), Math.min(end - start, e0 - start)]);

    const clipData = {
      durationMs: end - start,
      bounds: fight.data.bounds,
      players: fight.data.players.map((p) => ({
        account: p.account,
        inSquad: p.inSquad,
        isCommander: p.isCommander,
        points: trim(p.points),
        downIntervals: trimIntervals(p.downIntervals),
        deadIntervals: trimIntervals(p.deadIntervals),
      })),
      enemies: fight.data.enemies.map((e) => ({
        id: e.id,
        points: trim(e.points),
        downIntervals: trimIntervals(e.downIntervals),
        deadIntervals: trimIntervals(e.deadIntervals),
      })),
    };

    const b = clipData.bounds;
    const pad = Math.max((b.maxX - b.minX) * 0.08, 50);
    const viewBoxStr = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${fight.fightName} - Entropy Replay Clip</title>
<style>
  body { margin:0; background:#05070f; font-family:system-ui,sans-serif; color:#e2e8f0; }
  .wrap { max-width:720px; margin:24px auto; padding:0 16px; }
  h1 { font-size:14px; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; }
  .stage { background:#000; border-radius:12px; overflow:hidden; border:1px solid #1e293b; }
  svg { width:100%; height:420px; transform:scaleY(-1); display:block; }
  .controls { display:flex; align-items:center; gap:12px; margin-top:12px; }
  button { background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); color:#fbbf24; border-radius:999px; width:36px; height:36px; cursor:pointer; }
  input[type=range] { flex:1; accent-color:#f59e0b; }
  .clock { font-family:monospace; font-size:11px; color:#94a3b8; width:90px; text-align:right; }
  .legend { font-size:10px; color:#64748b; margin-top:10px; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:999px; margin-right:4px; }
</style></head>
<body><div class="wrap">
<h1>${fight.fightName} &middot; Entropy replay clip (${(clipData.durationMs / 1000).toFixed(1)}s)</h1>
<div class="stage"><svg viewBox="${viewBoxStr}" id="svg"></svg></div>
<div class="controls">
  <button id="playBtn">&#9654;</button>
  <input type="range" id="scrub" min="0" max="${clipData.durationMs}" value="0" />
  <span class="clock" id="clock">0:00 / ${(clipData.durationMs / 1000).toFixed(1)}s</span>
</div>
<p class="legend"><span class="dot" style="background:#f59e0b"></span>Squad<span class="dot" style="background:#64748b;margin-left:8px"></span>Ally<span class="dot" style="background:#f43f5e;margin-left:8px"></span>Enemy</p>
</div>
<script>
const DATA = ${JSON.stringify(clipData)};
const svg = document.getElementById('svg');
const scrub = document.getElementById('scrub');
const clock = document.getElementById('clock');
const playBtn = document.getElementById('playBtn');
function interp(points, t) {
  if (!points.length) return null;
  if (t <= points[0][0]) return points[0];
  if (t >= points[points.length - 1][0]) return points[points.length - 1];
  let lo = 0, hi = points.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (points[mid][0] <= t) lo = mid; else hi = mid; }
  const a = points[lo], b = points[hi], span = b[0] - a[0] || 1, f = (t - a[0]) / span;
  return [t, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
function inInterval(intervals, t) { return intervals.some(([s, e]) => t >= s && t <= e); }
function render(t) {
  let out = '';
  DATA.enemies.forEach((e) => {
    if (inInterval(e.deadIntervals, t)) return;
    const p = interp(e.points, t); if (!p) return;
    const down = inInterval(e.downIntervals, t);
    out += '<circle cx="' + p[1] + '" cy="' + p[2] + '" r="' + (down ? 45 : 38) + '" fill="#f43f5e" fill-opacity="' + (down ? 0.25 : 0.75) + '" stroke="' + (down ? '#f43f5e' : 'none') + '" stroke-width="' + (down ? 10 : 0) + '"/>';
  });
  DATA.players.forEach((pl) => {
    if (inInterval(pl.deadIntervals, t)) return;
    const p = interp(pl.points, t); if (!p) return;
    const down = inInterval(pl.downIntervals, t);
    const r = down ? 55 : pl.isCommander ? 65 : 45;
    out += '<circle cx="' + p[1] + '" cy="' + p[2] + '" r="' + r + '" fill="' + (pl.inSquad ? '#f59e0b' : '#64748b') + '" fill-opacity="' + (down ? 0.3 : 0.9) + '" stroke="' + (down ? '#f43f5e' : pl.isCommander ? '#fbbf24' : 'none') + '" stroke-width="' + (down || pl.isCommander ? 14 : 0) + '"/>';
  });
  svg.innerHTML = out;
  const s = Math.max(0, Math.floor(t / 1000));
  clock.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' / ' + (DATA.durationMs / 1000).toFixed(1) + 's';
}
let playing = false, lastTs = null, t = 0;
function tick(now) {
  if (!playing) return;
  if (lastTs != null) { t += (now - lastTs); if (t >= DATA.durationMs) t = 0; scrub.value = t; render(t); }
  lastTs = now;
  requestAnimationFrame(tick);
}
playBtn.onclick = () => { playing = !playing; playBtn.innerHTML = playing ? '&#9208;' : '&#9654;'; lastTs = null; if (playing) requestAnimationFrame(tick); };
scrub.oninput = () => { t = Number(scrub.value); render(t); };
render(0);
</script>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fight.fightName.replace(/[^a-z0-9]+/gi, "-")}-clip.html`;
    a.click();
    URL.revokeObjectURL(url);
  }



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

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {([
              { on: showMap, set: setShowMap, label: "Map", available: !!fight.data.map },
              { on: showMechanics, set: setShowMechanics, label: "Mechanics", available: fight.data.mechanics.length > 0 },
              { on: showCasts, set: setShowCasts, label: "Cast markers", available: true },
            ] as { on: boolean; set: (v: boolean) => void; label: string; available: boolean }[])
              .filter((l) => l.available)
              .map((l) => (
                <button
                  key={l.label}
                  onClick={() => l.set(!l.on)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    l.on
                      ? "text-sky-400 border-sky-500/30 bg-sky-500/5"
                      : "text-slate-500 border-slate-800 bg-black/30 hover:text-slate-300"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            <span className="text-[10px] text-slate-500">
              Markers show where an event happened, not how big the effect was - Elite Insights does not export AoE shapes.
            </span>
          </div>

          <div className="bg-black/40 rounded-xl border border-slate-800 overflow-hidden">
            <svg viewBox={viewBox} className="w-full h-[420px]" style={{ transform: "scaleY(-1)" }}>
                {/* Real combat-replay map imagery from EI. Per-actor positions are
                    already in this same pixel space, so the image needs no scaling -
                    but the whole svg is flipped with scaleY(-1) to match EI's y-axis,
                    so each image is counter-flipped about its own centre to keep it
                    the right way up. */}
                {showMap && fight.data.map?.images.map((img, i) => {
                  const visible = img.endMs <= 0 || (t >= img.startMs && t <= img.endMs);
                  if (!visible) return null;
                  const w = fight.data.map!.width;
                  const h = fight.data.map!.height;
                  return (
                    <image
                      key={`${img.url}-${i}`}
                      href={img.url}
                      x={img.x}
                      y={img.y}
                      width={w}
                      height={h}
                      opacity={0.55}
                      preserveAspectRatio="none"
                      transform={`translate(0 ${2 * img.y + h}) scale(1 -1)`}
                    />
                  );
                })}

                {/* Mechanic events near the playhead, pinned to whoever triggered
                    them. EI exports no AoE geometry, so this marks that something
                    happened to that player at that spot - not the effect's radius. */}
                {showMechanics && fight.data.mechanics
                  .filter((m) => Math.abs(m.t - t) <= 1500 && m.account)
                  .map((m, i) => {
                    const owner = fight.data.players.find((p) => p.account === m.account);
                    const pt = owner ? interpolatePosition(owner.points, t) : null;
                    if (!pt) return null;
                    const age = Math.abs(m.t - t) / 1500;
                    return (
                      <circle
                        key={`mech-${m.t}-${m.name}-${i}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={40 + age * 70}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth={6}
                        opacity={0.75 * (1 - age)}
                      />
                    );
                  })}

                {/* Damage-skill cast pulses at the caster's position. Again: where a
                    skill was cast, not the area it covered. */}
                {showCasts &&
                  fight.data.players.map((p) => {
                    const recent = p.casts.filter((c) => Math.abs(c.t - t) <= 600);
                    if (recent.length === 0) return null;
                    const pt = interpolatePosition(p.points, t);
                    if (!pt) return null;
                    const age = Math.min(...recent.map((c) => Math.abs(c.t - t))) / 600;
                    return (
                      <circle
                        key={`cast-${p.account}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={18 + age * 40}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={4}
                        opacity={0.6 * (1 - age)}
                      />
                    );
                  })}

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

          

          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Export clip:</span>
            <input
              type="number"
              min={0}
              max={fight.data.durationMs}
              value={Math.round(clipStart / 1000)}
              onChange={(e) => setClipStart(Number(e.target.value) * 1000)}
              className="w-16 bg-slate-900 border border-slate-700 text-slate-300 text-[11px] rounded-lg px-2 py-1"
            />
            <span className="text-[10px] text-slate-500">to</span>
            <input
              type="number"
              min={0}
              max={fight.data.durationMs}
              value={Math.round(clipEnd / 1000)}
              onChange={(e) => setClipEnd(Number(e.target.value) * 1000)}
              className="w-16 bg-slate-900 border border-slate-700 text-slate-300 text-[11px] rounded-lg px-2 py-1"
            />
            <span className="text-[10px] text-slate-500">sec</span>
            <button
              type="button"
              onClick={exportClip}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/20 transition-all"
            >
              <Download className="w-3 h-3" /> Download standalone .html
            </button>
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
