import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Play, Pause, Film, Crosshair, Download } from "lucide-react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { interpolatePosition, interpolateFacing, isInInterval, distanceBetween } from "../lib/parseReplayData";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shortActorName(name: string | undefined): string {
  if (!name) return "Unknown";
  return name.split(".")[0] || name;
}

// EI's Orientations angle convention (which way 0deg points, cw vs ccw) is
// unverified against a real replay export - see the comment on
// asFacingPoints in src/lib/parseReplayData.ts. If facing spokes look
// mirrored or rotated once checked against a live log, adjust these two
// instead of touching the render code below.
const FACING_ANGLE_SIGN = 1;
const FACING_ANGLE_OFFSET_DEG = 0;

function facingLineEnd(cx: number, cy: number, length: number, angleDeg: number): { x2: number; y2: number } {
  const rad = ((FACING_ANGLE_SIGN * angleDeg + FACING_ANGLE_OFFSET_DEG) * Math.PI) / 180;
  return { x2: cx + Math.cos(rad) * length, y2: cy + Math.sin(rad) * length };
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
  // Real combat-replay map imagery (WvW keep/tower terrain screenshots from
  // EI), counter-flipped per-image so it matches the y-down SVG flip below.
  // Verified on-screen across zoom levels and scrub positions - framing
  // tracks the fitted squad-movement bounds correctly. Default on so users
  // get real map context without an extra click.
  const [showMap, setShowMap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [followFocus, setFollowFocus] = useState(true);
  const [showMechanics, setShowMechanics] = useState(true);
  const [showCasts, setShowCasts] = useState(false);
  // Facing spokes default OFF: the EI orientation-angle convention (which
  // way 0deg points, cw vs ccw) has never been verified against a real
  // replay export (see the comment on asFacingPoints in parseReplayData.ts).
  // If the angle sign/offset is wrong, this line points backward relative
  // to travel, which reads as a streak trailing behind a moving dot -
  // exactly the "trailing line" artifact users kept reporting even after
  // the SVG paint-compositing fix in v0.2.43 (which was never the real
  // cause). Opt-in until FACING_ANGLE_SIGN/FACING_ANGLE_OFFSET_DEG are
  // confirmed correct against a live log.
  const [showFacing, setShowFacing] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Pan offset (in map/world units, same space as the viewBox), applied on
  // top of the zoom-centered viewBox below. Only meaningful once zoomed in -
  // at zoom 1 the viewBox already shows the full fitted bounds so there's
  // nowhere to pan to (and it's clamped to 0 either way).
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const fight = fights?.[fightIdx];

  useEffect(() => {
    setT(0);
    setPlaying(false);
    setPan({ x: 0, y: 0 });
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

  // Base (un-panned) fitted window for the current fight, and how far the
  // pan offset is allowed to travel at the current zoom level before the
  // edge of the zoomed window would go past the fitted bounds.
  const frame = useMemo(() => {
    if (!fight) return null;
    const { bounds } = fight.data;
    const pad = Math.max((bounds.maxX - bounds.minX) * 0.08, 50);
    const fullW = bounds.maxX - bounds.minX + pad * 2;
    const fullH = bounds.maxY - bounds.minY + pad * 2;
    const baseCx = bounds.minX - pad + fullW / 2;
    const baseCy = bounds.minY - pad + fullH / 2;
    const w = fullW / zoom;
    const h = fullH / zoom;
    const maxPanX = Math.max(0, (fullW - w) / 2);
    const maxPanY = Math.max(0, (fullH - h) / 2);
    return { baseCx, baseCy, w, h, maxPanX, maxPanY, minX: bounds.minX - pad, maxX: bounds.maxX + pad, minY: bounds.minY - pad, maxY: bounds.maxY + pad };
  }, [fight, zoom]);

  // Marker radii are expressed in SVG/world units, but the user experiences
  // them as screen pixels. Use the limiting axis of the actual 900x420
  // viewport so very tight or unusually shaped bounds never inflate dots.
  const markerUnit = frame ? Math.max(frame.w / 900, frame.h / 420, 0.001) : 1;

  const focusPoint = useMemo(() => {
    if (!fight) return null;
    const squadAlive = fight.data.players.filter((p) => p.inSquad && !isInInterval(p.deadIntervals, t));
    const commander = squadAlive.find((p) => p.isCommander);
    const commanderPt = commander ? interpolatePosition(commander.points, t) : null;
    if (commanderPt) return commanderPt;
    const pts = squadAlive
      .map((p) => interpolatePosition(p.points, t))
      .filter((pt): pt is NonNullable<ReturnType<typeof interpolatePosition>> => !!pt);
    if (pts.length === 0) return null;
    return {
      x: pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length,
      y: pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length,
    };
  }, [fight, t]);

  // Re-clamp pan whenever the allowed range shrinks (e.g. zooming back out)
  // so a stale pan offset from a higher zoom level doesn't leave the view
  // sitting outside the fitted bounds.
  useEffect(() => {
    if (!frame) return;
    setPan((p) => {
      const x = Math.min(frame.maxPanX, Math.max(-frame.maxPanX, p.x));
      const y = Math.min(frame.maxPanY, Math.max(-frame.maxPanY, p.y));
      return x === p.x && y === p.y ? p : { x, y };
    });
  }, [frame]);

  const viewBox = useMemo(() => {
    if (!frame) return "0 0 100 100";
    const preferredCx = zoom > 1 && followFocus && focusPoint ? focusPoint.x : frame.baseCx;
    const preferredCy = zoom > 1 && followFocus && focusPoint ? focusPoint.y : frame.baseCy;
    const minCx = frame.minX + frame.w / 2;
    const maxCx = frame.maxX - frame.w / 2;
    const minCy = frame.minY + frame.h / 2;
    const maxCy = frame.maxY - frame.h / 2;
    const cx = clamp(preferredCx + pan.x, Math.min(minCx, maxCx), Math.max(minCx, maxCx));
    const cy = clamp(preferredCy + pan.y, Math.min(minCy, maxCy), Math.max(minCy, maxCy));
    return `${cx - frame.w / 2} ${cy - frame.h / 2} ${frame.w} ${frame.h}`;
  }, [frame, focusPoint, followFocus, pan, zoom]);

    // Native SVG transform (not a CSS transform on the <svg> root) for the
    // y-up-to-y-down flip. A CSS transform on an animated SVG root is prone
    // to a Chromium paint/compositing bug where fast attribute updates leave
    // stale pixels behind moving shapes (streaking ghosts) - wrapping the
    // content in a plain SVG <g> instead keeps the flip inside the normal
    // SVG paint pipeline.
    const [, vbYStr, , vbHStr] = viewBox.split(" ");
    const vbY = Number(vbYStr);
    const vbH = Number(vbHStr);
    const flipTransform = `translate(0, ${2 * vbY + vbH}) scale(1, -1)`;

  // Mouse/touch drag-to-pan on the SVG viewport. Only active once zoomed in
  // (maxPanX/Y are 0 at zoom 1, so drags are effectively no-ops there).
  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    if (zoom <= 1) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setFollowFocus(false);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !svgRef.current || !frame) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scaleX = frame.w / rect.width;
    const scaleY = frame.h / rect.height;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    // The svg is flipped vertically via CSS (scaleY(-1)) to correct the
    // game's y-up coordinates, so horizontal and vertical drag deltas need
    // opposite sign conventions to both make the content "follow the cursor".
    const nextX = dragRef.current.panX - dx * scaleX;
    const nextY = dragRef.current.panY + dy * scaleY;
    setPan({
      x: Math.min(frame.maxPanX, Math.max(-frame.maxPanX, nextX)),
      y: Math.min(frame.maxPanY, Math.max(-frame.maxPanY, nextY)),
    });
  }

  function handlePointerUp(e: PointerEvent<SVGSVGElement>) {
    if (dragRef.current) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // no-op - pointer capture may already be released
      }
    }
    dragRef.current = null;
    setDragging(false);
  }

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
const PAD = Math.max((DATA.bounds.maxX - DATA.bounds.minX) * 0.08, 50);
const UNIT = Math.max((DATA.bounds.maxX - DATA.bounds.minX + PAD * 2) / 720, 0.08);
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
    out += '<circle cx="' + p[1] + '" cy="' + p[2] + '" r="' + ((down ? 9 : 6.5) * UNIT) + '" fill="#f43f5e" fill-opacity="' + (down ? 0.25 : 0.75) + '" stroke="' + (down ? '#f43f5e' : 'none') + '" stroke-width="' + ((down ? 2 : 0) * UNIT) + '"><title>' + (e.id || 'Enemy') + (down ? ' - downed' : '') + '</title></circle>';
  });
  DATA.players.forEach((pl) => {
    if (inInterval(pl.deadIntervals, t)) return;
    const p = interp(pl.points, t); if (!p) return;
    const down = inInterval(pl.downIntervals, t);
    const r = (down ? 10 : pl.isCommander ? 11 : 7) * UNIT;
    out += '<circle cx="' + p[1] + '" cy="' + p[2] + '" r="' + r + '" fill="' + (pl.inSquad ? '#f59e0b' : '#64748b') + '" fill-opacity="' + (down ? 0.3 : 0.9) + '" stroke="' + (down ? '#f43f5e' : pl.isCommander ? '#fbbf24' : 'none') + '" stroke-width="' + ((down || pl.isCommander ? 2.25 : 0) * UNIT) + '"><title>' + (pl.account || 'Unknown') + (pl.isCommander ? ' - commander' : '') + (down ? ' - downed' : '') + '</title></circle>';
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
            <option key={f.fightId} value={i}>#{i + 1} · {f.fightName}</option>
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
                  {liveStats.hasCommander && liveStats.avgDistToTag != null ? Math.round(liveStats.avgDistToTag) : "-"}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {([
              { on: showMap, set: setShowMap, label: "Map", available: !!fight.data.map },
              { on: showMechanics, set: setShowMechanics, label: "Mechanics", available: (fight.data.mechanics ?? []).length > 0 },
              { on: showCasts, set: setShowCasts, label: "Cast markers", available: true },
              { on: showFacing, set: setShowFacing, label: "Facing", available: true },
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
            <div className="flex items-center gap-2 ml-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Zoom</span>
              <input
                type="range"
                min={1}
                max={8}
                step={0.25}
                value={zoom}
                onChange={(e) => {
                  setZoom(Number(e.target.value));
                  setFollowFocus(true);
                  setPan({ x: 0, y: 0 });
                }}
                className="w-28 accent-sky-400"
              />
              <span className="text-[10px] font-mono text-slate-400 w-9">{zoom.toFixed(1)}x</span>
              {zoom > 1 && (
                <button
                  onClick={() => {
                    setFollowFocus((v) => !v);
                    setPan({ x: 0, y: 0 });
                  }}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                    followFocus
                      ? "text-sky-300 border-sky-500/30 bg-sky-500/10"
                      : "text-slate-500 border-slate-800 hover:text-slate-300"
                  }`}
                >
                  Follow tag
                </button>
              )}
              {zoom !== 1 && (
                <button
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setFollowFocus(true); }}
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 px-2 py-1 rounded border border-slate-800"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="text-[10px] text-slate-500">
              Markers show where an event happened, not how big the effect was - Elite Insights does not export AoE shapes.
              {zoom > 1 ? " Drag the map to pan." : ""}
            </span>
          </div>

          <div className="bg-black/60 rounded-xl border border-slate-700/80 overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
            <svg
              ref={svgRef}
              viewBox={viewBox}
              className="w-full h-[420px] select-none touch-none"
                      style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
                      <g transform={flipTransform}>
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
                    opacity={0.85}
                    preserveAspectRatio="none"
                    transform={`translate(0 ${2 * img.y + h}) scale(1 -1)`}
                  />
                );
              })}

              {/* Mechanic events near the playhead, pinned to whoever triggered
                  them. EI exports no AoE geometry, so this marks that something
                  happened to that player at that spot - not the effect's radius. */}
              {showMechanics && (fight.data.mechanics ?? [])
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
                      r={(9 + age * 14) * markerUnit}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth={2 * markerUnit}
                      opacity={0.75 * (1 - age)}
                    />
                  );
                })}

              {/* Damage-skill cast pulses at the caster's position. Again: where a
                  skill was cast, not the area it covered. */}
              {showCasts &&
                fight.data.players.map((p) => {
                  const recent = (p.casts ?? []).filter((c) => Math.abs(c.t - t) <= 600);
                  if (recent.length === 0) return null;
                  const pt = interpolatePosition(p.points, t);
                  if (!pt) return null;
                  const age = Math.min(...recent.map((c) => Math.abs(c.t - t))) / 600;
                  return (
                    <circle
                      key={`cast-${p.account}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={(5 + age * 8) * markerUnit}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={1.5 * markerUnit}
                      opacity={0.6 * (1 - age)}
                    />
                  );
                })}

              {showFacing &&
                fight.data.enemies.map((e) => {
                  if (isInInterval(e.deadIntervals, t)) return null;
                  const pt = interpolatePosition(e.points, t);
                  const angle = interpolateFacing(e.facings ?? [], t);
                  if (!pt || angle == null) return null;
                  const r = (isInInterval(e.downIntervals, t) ? 6.5 : 4.5) * markerUnit;
                  const end = facingLineEnd(pt.x, pt.y, r + 5 * markerUnit, angle);
                  return (
                    <line
                      key={`facing-${e.id}`}
                      x1={pt.x}
                      y1={pt.y}
                      x2={end.x2}
                      y2={end.y2}
                      stroke="#f43f5e"
                      strokeWidth={1.5 * markerUnit}
                      strokeLinecap="round"
                      opacity={0.8}
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
                    r={(down ? 6.5 : 4.5) * markerUnit}
                    fill="#f43f5e"
                    fillOpacity={down ? 0.25 : 0.75}
                    stroke={down ? "#f43f5e" : "none"}
                    strokeWidth={(down ? 2 : 0) * markerUnit}
                  >
                    <title>{`${e.name || "Enemy"}${down ? " — downed" : ""}`}</title>
                  </circle>
                );
              })}
              {showFacing &&
                fight.data.players.map((p) => {
                  if (isInInterval(p.deadIntervals, t)) return null;
                  const pt = interpolatePosition(p.points, t);
                  const angle = interpolateFacing(p.facings ?? [], t);
                  if (!pt || angle == null) return null;
                  const r = (isInInterval(p.downIntervals, t) ? 7.5 : p.isCommander ? 8.5 : 5) * markerUnit;
                  const end = facingLineEnd(pt.x, pt.y, r + 5 * markerUnit, angle);
                  return (
                    <line
                      key={`facing-${p.account}`}
                      x1={pt.x}
                      y1={pt.y}
                      x2={end.x2}
                      y2={end.y2}
                      stroke={p.inSquad ? "#f59e0b" : "#94a3b8"}
                      strokeWidth={1.5 * markerUnit}
                      strokeLinecap="round"
                      opacity={0.85}
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
                    r={(down ? 7.5 : p.isCommander ? 8.5 : 5) * markerUnit}
                    fill={p.inSquad ? "#f59e0b" : "#64748b"}
                    fillOpacity={down ? 0.3 : 0.9}
                    stroke={down ? "#f43f5e" : p.isCommander ? "#fbbf24" : "none"}
                    strokeWidth={(down || p.isCommander ? 2.25 : 0) * markerUnit}
                  >
                    <title>{`${shortActorName(p.account)}${p.isCommander ? " — commander" : ""}${down ? " — downed" : ""}`}</title>
                  </circle>
                );
              })}
                      </g>
            </svg>
          </div>

          <div className="flex items-center gap-3 mt-4 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
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
