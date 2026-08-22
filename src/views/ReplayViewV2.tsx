import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Crosshair, Download, Film, Maximize2, Minimize2, Pause, Play, RotateCcw, X } from "lucide-react";
import ReplayInspectorDrawer, { type ReplayInspectorMode } from "../components/replay/ReplayInspectorDrawer";
import ReplayLiveIntelligencePulse from "../components/replay/ReplayLiveIntelligencePulse";
import ReplayMapStage from "../components/replay/ReplayMapStage";
import Panel from "../components/ui/Panel";
import { distanceBetween, interpolatePosition, isInInterval } from "../lib/parseReplayData";
import type { ReplayIntelligenceAnchor } from "../lib/replayIntelligenceAnchors";
import { resolveReplayNavigationTarget, type ResolvedReplayNavigationTarget } from "../lib/replayNavigation";
import { quantizeReplayAnalysisTime, REPLAY_RENDER_INTERVAL_MS, resolveReplayPlaybackTime } from "../lib/replayPlaybackClock";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function ReplayViewV2() {
  const { report } = useReport();
  const { navigationTarget, clearNavigationTarget } = useView();
  const fights = report?.stats.replayFights;
  const [fightIdx, setFightIdx] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [evidenceOrigin, setEvidenceOrigin] = useState<ResolvedReplayNavigationTarget | null>(null);
  const [alignedIntelligenceEvent, setAlignedIntelligenceEvent] = useState<ReplayIntelligenceAnchor | null>(null);
  const [evidenceEvent, setEvidenceEvent] = useState<ReplayIntelligenceAnchor | null>(null);
  const [inspectorMode, setInspectorMode] = useState<ReplayInspectorMode>("intelligence");
  const [focusMode, setFocusMode] = useState(false);
  const pendingSeekRef = useRef<ResolvedReplayNavigationTarget | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [followFocus, setFollowFocus] = useState(true);
  const [showMechanics, setShowMechanics] = useState(true);
  const [showCasts, setShowCasts] = useState(false);
  const [showFacing, setShowFacing] = useState(true);
  const rafRef = useRef<number | null>(null);
  const playbackTimeRef = useRef(0);
  const lastRenderTsRef = useRef(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);

  const fight = fights?.[fightIdx];

  useEffect(() => {
    const pending = pendingSeekRef.current;
    if (pending && pending.fightIndex === fightIdx) {
      setT(pending.timestampMs);
      setEvidenceOrigin(pending);
      setSelectedAccount(pending.account ?? null);
      pendingSeekRef.current = null;
    } else {
      setT(0);
      setSelectedAccount(null);
    }
    setAlignedIntelligenceEvent(null);
    setEvidenceEvent(null);
    setInspectorMode("intelligence");
    setPlaying(false);
    setPan({ x: 0, y: 0 });
  }, [fightIdx]);

  useEffect(() => {
    const resolved = resolveReplayNavigationTarget(fights, navigationTarget);
    if (!resolved) return;
    setPlaying(false);
    setPan({ x: 0, y: 0 });
    setFollowFocus(true);
    setEvidenceOrigin(resolved);
    setSelectedAccount(resolved.account ?? null);
    if (resolved.fightIndex === fightIdx) {
      setT(resolved.timestampMs);
    } else {
      pendingSeekRef.current = resolved;
      setFightIdx(resolved.fightIndex);
    }
    clearNavigationTarget();
  }, [clearNavigationTarget, fightIdx, fights, navigationTarget]);

  useEffect(() => {
    playbackTimeRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!playing || !fight) return;
    const anchor = {
      timelineMs: playbackTimeRef.current,
      wallClockMs: performance.now(),
    };
    lastRenderTsRef.current = anchor.wallClockMs - REPLAY_RENDER_INTERVAL_MS;
    function tick(now: number) {
      if (now - lastRenderTsRef.current >= REPLAY_RENDER_INTERVAL_MS) {
        const next = resolveReplayPlaybackTime(anchor, now, speed, fight!.data.durationMs);
        playbackTimeRef.current = next;
        setT(next);
        lastRenderTsRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, speed, fight]);

  useEffect(() => {
    if (!focusMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [focusMode]);

  useEffect(() => {
    if (!fight) return;
    setClipStart(0);
    setClipEnd(fight.data.durationMs);
  }, [fight]);

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
    return {
      baseCx,
      baseCy,
      w,
      h,
      maxPanX: Math.max(0, (fullW - w) / 2),
      maxPanY: Math.max(0, (fullH - h) / 2),
      minX: bounds.minX - pad,
      maxX: bounds.maxX + pad,
      minY: bounds.minY - pad,
      maxY: bounds.maxY + pad,
    };
  }, [fight, zoom]);

  const markerUnit = frame ? Math.max(frame.w / 1000, frame.h / 560, 0.001) : 1;
  const analysisT = useMemo(() => quantizeReplayAnalysisTime(t), [t]);

  const focusPoint = useMemo(() => {
    if (!fight) return null;
    if (selectedAccount) {
      const selected = fight.data.players.find((player) => player.account === selectedAccount);
      const selectedPoint = selected && !isInInterval(selected.deadIntervals, t) ? interpolatePosition(selected.points, t) : null;
      if (selectedPoint) return selectedPoint;
    }
    const squadAlive = fight.data.players.filter((player) => player.inSquad && !isInInterval(player.deadIntervals, t));
    const commander = squadAlive.find((player) => player.isCommander);
    const commanderPoint = commander ? interpolatePosition(commander.points, t) : null;
    if (commanderPoint) return commanderPoint;
    const points = squadAlive
      .map((player) => interpolatePosition(player.points, t))
      .filter((point): point is NonNullable<ReturnType<typeof interpolatePosition>> => point != null);
    if (points.length === 0) return null;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }, [fight, selectedAccount, t]);

  useEffect(() => {
    if (!frame) return;
    setPan((current) => {
      const x = clamp(current.x, -frame.maxPanX, frame.maxPanX);
      const y = clamp(current.y, -frame.maxPanY, frame.maxPanY);
      return x === current.x && y === current.y ? current : { x, y };
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

  const handlePointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (zoom <= 1) return;
    (event.target as Element).setPointerCapture(event.pointerId);
    setFollowFocus(false);
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }, [pan.x, pan.y, zoom]);

  const handlePointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !svgRef.current || !frame) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setPan({
      x: clamp(dragRef.current.panX - dx * (frame.w / rect.width), -frame.maxPanX, frame.maxPanX),
      y: clamp(dragRef.current.panY - dy * (frame.h / rect.height), -frame.maxPanY, frame.maxPanY),
    });
  }, [frame]);

  const handlePointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      try {
        (event.target as Element).releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already have been released.
      }
    }
    dragRef.current = null;
    setDragging(false);
  }, []);

  const liveStats = useMemo(() => {
    if (!fight) return null;
    const squadAlive = fight.data.players.filter((player) => player.inSquad && !isInInterval(player.deadIntervals, analysisT) && interpolatePosition(player.points, analysisT));
    const enemiesAlive = fight.data.enemies.filter((enemy) => !isInInterval(enemy.deadIntervals, analysisT) && interpolatePosition(enemy.points, analysisT));
    const commander = squadAlive.find((player) => player.isCommander);
    const commanderPoint = commander ? interpolatePosition(commander.points, analysisT) : null;
    const distances = commanderPoint
      ? squadAlive
          .filter((player) => !player.isCommander)
          .map((player) => distanceBetween(interpolatePosition(player.points, analysisT), commanderPoint))
          .filter((value): value is number => value != null)
      : [];
    return {
      squadCount: squadAlive.length,
      enemyCount: enemiesAlive.length,
      avgDistToTag: distances.length > 0 ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null,
    };
  }, [analysisT, fight]);

  const bombEvents = useMemo(() => {
    if (!fight) return [];
    const downs = fight.data.enemies
      .flatMap((enemy) => enemy.downIntervals.map(([start]) => ({ t: start, enemy: enemy.name })))
      .sort((a, b) => a.t - b.t);
    const clusters: { t: number; count: number; enemies: string[] }[] = [];
    let i = 0;
    while (i < downs.length) {
      let j = i;
      const enemies: string[] = [];
      while (j < downs.length && downs[j].t - downs[i].t <= 3000) {
        enemies.push(downs[j].enemy);
        j++;
      }
      if (enemies.length >= 2) clusters.push({ t: downs[i].t, count: enemies.length, enemies });
      i = j > i ? j : i + 1;
    }
    return clusters.sort((a, b) => b.count - a.count).slice(0, 12);
  }, [fight]);

  const selectedPlayer = useMemo(() => {
    if (!fight || !selectedAccount) return null;
    return fight.data.players.find((player) => player.account === selectedAccount) ?? null;
  }, [fight, selectedAccount]);

  const selectPlayer = useCallback((account: string) => {
    setPlaying(false);
    setSelectedAccount(account);
    setInspectorMode("player");
    if (zoom > 1) {
      setFollowFocus(true);
      setPan({ x: 0, y: 0 });
    }
  }, [zoom]);

  const seekReplay = useCallback((timestampMs: number, account?: string) => {
    playbackTimeRef.current = timestampMs;
    setT(timestampMs);
    setPlaying(false);
    if (account) {
      setSelectedAccount(account);
      setInspectorMode("player");
    }
  }, []);

  const inspectEvidenceAccount = useCallback((account: string) => {
    seekReplay(evidenceEvent?.timestampMs ?? playbackTimeRef.current, account);
  }, [evidenceEvent?.timestampMs, seekReplay]);

  function exportClip() {
    if (!fight) return;
    const start = Math.max(0, Math.min(clipStart, clipEnd));
    const end = Math.min(fight.data.durationMs, Math.max(clipStart, clipEnd));
    if (end - start < 500) return;
    const trim = (points: { t: number; x: number; y: number }[]) =>
      points.filter((point) => point.t >= start - 500 && point.t <= end + 500).map((point) => [point.t - start, point.x, point.y]);
    const trimIntervals = (intervals: [number, number][]) =>
      intervals.filter(([s, e]) => e >= start && s <= end).map(([s, e]) => [Math.max(0, s - start), Math.min(end - start, e - start)]);
    const data = {
      durationMs: end - start,
      bounds: fight.data.bounds,
      players: fight.data.players.map((player) => ({ account: player.account, inSquad: player.inSquad, isCommander: player.isCommander, points: trim(player.points), downIntervals: trimIntervals(player.downIntervals), deadIntervals: trimIntervals(player.deadIntervals) })),
      enemies: fight.data.enemies.map((enemy) => ({ id: enemy.id, points: trim(enemy.points), downIntervals: trimIntervals(enemy.downIntervals), deadIntervals: trimIntervals(enemy.deadIntervals) })),
    };
    const bounds = data.bounds;
    const pad = Math.max((bounds.maxX - bounds.minX) * 0.08, 50);
    const vb = `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.maxX - bounds.minX + pad * 2} ${bounds.maxY - bounds.minY + pad * 2}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${fight.fightName} - Entropy Replay Clip</title><style>body{margin:0;background:#05070f;color:#e2e8f0;font-family:system-ui}.wrap{max-width:900px;margin:24px auto;padding:0 16px}.stage{background:#000;border:1px solid #1e293b;border-radius:12px;overflow:hidden}svg{width:100%;height:520px;transform:scaleY(-1)}.controls{display:flex;gap:12px;align-items:center;margin-top:12px}input{flex:1}button{width:38px;height:38px;border-radius:999px;background:#2a1b08;color:#fbbf24;border:1px solid #92400e}.clock{font:12px monospace;color:#94a3b8}</style></head><body><div class="wrap"><h3>${fight.fightName}</h3><div class="stage"><svg viewBox="${vb}" id="stage"></svg></div><div class="controls"><button id="play">▶</button><input type="range" id="scrub" min="0" max="${data.durationMs}" value="0"><span id="clock" class="clock"></span></div></div><script>const DATA=${JSON.stringify(data)};const stage=document.getElementById('stage'),scrub=document.getElementById('scrub'),clock=document.getElementById('clock'),play=document.getElementById('play');function interp(points,t){if(!points.length||t<points[0][0]||t>points[points.length-1][0])return null;if(t===points[0][0])return points[0];if(t===points[points.length-1][0])return points[points.length-1];let lo=0,hi=points.length-1;while(lo<hi-1){const m=(lo+hi)>>1;if(points[m][0]<=t)lo=m;else hi=m}const a=points[lo],b=points[hi],span=b[0]-a[0]||1,f=(t-a[0])/span;return[t,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]}function inside(xs,t){return xs.some(([s,e])=>t>=s&&t<=e)}function render(t){let out='';DATA.enemies.forEach(e=>{if(inside(e.deadIntervals,t))return;const p=interp(e.points,t);if(!p)return;out+='<circle cx="'+p[1]+'" cy="'+p[2]+'" r="6" fill="#f43f5e" stroke="#fecdd3" stroke-width="1" />'});DATA.players.forEach(p=>{if(inside(p.deadIntervals,t))return;const q=interp(p.points,t);if(!q)return;const down=inside(p.downIntervals,t);out+='<circle cx="'+q[1]+'" cy="'+q[2]+'" r="'+(p.isCommander?10:7)+'" fill="'+(p.inSquad?'#38bdf8':'#94a3b8')+'" stroke="'+(down?'#fb7185':'#e2e8f0')+'" stroke-width="2" />'});stage.innerHTML=out;const s=Math.floor(t/1000);clock.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}let running=false,last=null,t=0;function tick(now){if(!running)return;if(last!=null){t+=now-last;if(t>=DATA.durationMs)t=0;scrub.value=t;render(t)}last=now;requestAnimationFrame(tick)}play.onclick=()=>{running=!running;play.textContent=running?'Ⅱ':'▶';last=null;if(running)requestAnimationFrame(tick)};scrub.oninput=()=>{t=Number(scrub.value);render(t)};render(0)</script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fight.fightName.replace(/[^a-z0-9]+/gi, "-")}-clip.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!report) return null;
  if (!fights || fights.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel title="Fight Replay" icon={<Film className="h-3.5 w-3.5" />} empty={<div className="py-10 text-center text-sm text-slate-500">No replay data available for this report.<p className="mt-1 text-[11px] text-slate-500">Replay requires EI combat replay position data.</p></div>}>{null}</Panel>
      </div>
    );
  }

  const atEvidenceAnchor = evidenceOrigin?.fightIndex === fightIdx && Math.abs(t - evidenceOrigin.timestampMs) < 1;

  return (
    <div className={focusMode ? "fixed inset-0 z-[120] space-y-3 overflow-y-auto bg-[#02070b] p-3 sm:p-4" : "space-y-5 animate-view pb-12"}>
      {focusMode && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 rounded-xl border border-sky-400/20 bg-[#050b12]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">Replay Focus Mode</div>
            <div className="truncate text-sm font-black text-slate-100">{fight?.fightName}</div>
          </div>
          <button type="button" onClick={() => setFocusMode(false)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-300/25 bg-sky-300/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-sky-200 transition hover:bg-sky-300/[0.14]"><Minimize2 className="h-3.5 w-3.5" /> Exit Focus <span className="font-mono text-slate-500">Esc</span></button>
        </div>
      )}
      {!focusMode && evidenceOrigin?.fightIndex === fightIdx && (
        <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.06] px-4 py-3 shadow-[0_0_30px_-18px_rgba(56,189,248,0.8)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">Evidence target</div>
              <div className="mt-1 text-sm font-black text-slate-100">Paused at {fmtClock(evidenceOrigin.timestampMs)} in Fight {evidenceOrigin.fightIndex + 1}</div>
              <div className="mt-1 text-[11px] text-slate-400">{evidenceOrigin.metric ? `${evidenceOrigin.metric} · ` : ""}{evidenceOrigin.account ? `Linked player: ${evidenceOrigin.account}` : "Replay mechanic / event context"}{evidenceOrigin.eventId ? ` · Event ${evidenceOrigin.eventId}` : ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setT(evidenceOrigin.timestampMs); setPlaying(false); if (evidenceOrigin.account) setSelectedAccount(evidenceOrigin.account); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/[0.12]"><RotateCcw className="h-3.5 w-3.5" /> Return to anchor</button>
              <button type="button" aria-label="Dismiss Replay evidence target" onClick={() => setEvidenceOrigin(null)} className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/20 p-2 text-slate-500 transition hover:border-white/20 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {fights.length > 1 && (
          <select value={fightIdx} onChange={(event) => { pendingSeekRef.current = null; setEvidenceOrigin(null); setFightIdx(Number(event.target.value)); }} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
            {fights.map((entry, index) => <option key={entry.fightId} value={index}>#{index + 1} · {entry.fightName}</option>)}
          </select>
        )}
        <span className="text-[10px] text-slate-500">Select a player marker to pin exact-time tactical state.</span>
      </div>

      {!focusMode && fight && bombEvents.length > 0 && (
        <Panel title="Detected Bombs" subtitle="Multiple tracked enemies downed within 3 seconds; a focus-fire proxy, not damage attribution" icon={<Crosshair className="h-3.5 w-3.5" />} action={`${bombEvents.length} detected`}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {bombEvents.map((bomb, index) => (
              <button key={index} type="button" onClick={() => { setT(bomb.t); setPlaying(false); }} className="min-w-28 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-left transition-colors hover:border-rose-500/40 hover:bg-rose-500/10">
                <div className="font-mono text-sm font-black text-rose-300">{bomb.count} downed</div><div className="font-mono text-[10px] text-slate-500">{fmtClock(bomb.t)}</div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {fight && (
        <Panel title="Fight Replay" subtitle={`${fight.fightName} · tactical movement + exact-time player state`} icon={<Film className="h-3.5 w-3.5" />} action={`${fight.data.players.length} players tracked`} className={focusMode ? "rounded-xl" : ""} bodyClassName={focusMode ? "p-3" : "p-5"}>
          {liveStats && (
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-sky-400/70">Squad tracked now</div><div className="font-mono text-lg font-black text-sky-300">{liveStats.squadCount}</div></div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-rose-400/70">Enemies tracked now</div><div className="font-mono text-lg font-black text-rose-300">{liveStats.enemyCount}</div></div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/70">Avg. dist to tag</div><div className="font-mono text-lg font-black text-amber-300">{liveStats.avgDistToTag == null ? "—" : Math.round(liveStats.avgDistToTag)}</div></div>
            </div>
          )}

          <ReplayLiveIntelligencePulse
            fightIndex={fightIdx}
            timestampMs={analysisT}
            onAlignedEventChange={setAlignedIntelligenceEvent}
            onEvidenceEventChange={setEvidenceEvent}
            onSeek={seekReplay}
          />

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([
              { on: showMap, set: setShowMap, label: "Map", available: !!fight.data.map },
              { on: showMechanics, set: setShowMechanics, label: "Mechanics", available: (fight.data.mechanics ?? []).length > 0 },
              { on: showCasts, set: setShowCasts, label: "Cast markers", available: true },
              { on: showFacing, set: setShowFacing, label: "Facing", available: true },
            ] as { on: boolean; set: (value: boolean) => void; label: string; available: boolean }[]).filter((layer) => layer.available).map((layer) => (
              <button key={layer.label} type="button" onClick={() => layer.set(!layer.on)} className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${layer.on ? "border-sky-500/30 bg-sky-500/5 text-sky-400" : "border-slate-800 bg-black/30 text-slate-500 hover:text-slate-300"}`}>{layer.label}</button>
            ))}
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Zoom</span>
            <input type="range" min={1} max={8} step={0.25} value={zoom} onChange={(event) => { setZoom(Number(event.target.value)); setFollowFocus(true); setPan({ x: 0, y: 0 }); }} className="w-28 accent-sky-400" />
            <span className="w-9 font-mono text-[10px] text-slate-400">{zoom.toFixed(1)}x</span>
            {zoom > 1 && <button type="button" onClick={() => { setFollowFocus((value) => !value); setPan({ x: 0, y: 0 }); }} className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${followFocus ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-slate-800 text-slate-500"}`}>Follow focus</button>}
            {zoom !== 1 && <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setFollowFocus(true); }} className="rounded border border-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300">Reset</button>}
            <button type="button" onClick={() => setFocusMode((value) => !value)} className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-400/20 bg-sky-400/[0.055] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-300 transition hover:border-sky-300/35 hover:bg-sky-400/[0.09]"><Maximize2 className="h-3 w-3" /> {focusMode ? "Exit focus" : "Focus mode"}</button>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <ReplayMapStage
              data={fight.data}
              timestampMs={t}
              viewBox={viewBox}
              markerUnit={markerUnit}
              selectedAccount={selectedAccount}
              alignedIntelligenceEvent={alignedIntelligenceEvent}
              showMap={showMap}
              showMechanics={showMechanics}
              showCasts={showCasts}
              showFacing={showFacing}
              zoom={zoom}
              dragging={dragging}
              focusMode={focusMode}
              svgRef={svgRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onSelectPlayer={selectPlayer}
            />
            <ReplayInspectorDrawer
              data={fight.data}
              player={selectedPlayer}
              timestampMs={analysisT}
              evidenceEvent={evidenceEvent}
              mode={inspectorMode}
              focusMode={focusMode}
              onModeChange={setInspectorMode}
              onSelectAccount={inspectEvidenceAccount}
            />
          </div>

          <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${atEvidenceAnchor ? "border-sky-400/35 bg-sky-500/[0.07]" : "border-slate-800 bg-slate-900/50"}`}>
            <button type="button" onClick={() => setPlaying((value) => !value)} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-sky-400/35 bg-sky-500/10 text-sky-300 transition hover:bg-sky-500/20">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
            <input type="range" min={0} max={fight.data.durationMs} value={t} onChange={(event) => { setT(Number(event.target.value)); setPlaying(false); }} className="flex-1 accent-sky-400" />
            {atEvidenceAnchor && <span className="rounded-full border border-sky-400/25 bg-sky-500/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-sky-200">Evidence anchor</span>}
            <span className="w-24 shrink-0 text-right font-mono text-[11px] text-slate-400">{fmtClock(t)} / {fmtClock(fight.data.durationMs)}</span>
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-300"><option value={1}>1x</option><option value={2}>2x</option><option value={4}>4x</option><option value={8}>8x</option></select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Export clip:</span>
            <input type="number" min={0} max={fight.data.durationMs / 1000} value={Math.round(clipStart / 1000)} onChange={(event) => setClipStart(Number(event.target.value) * 1000)} className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300" />
            <span className="text-[10px] text-slate-500">to</span>
            <input type="number" min={0} max={fight.data.durationMs / 1000} value={Math.round(clipEnd / 1000)} onChange={(event) => setClipEnd(Number(event.target.value) * 1000)} className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300" />
            <span className="text-[10px] text-slate-500">sec</span>
            <button type="button" onClick={exportClip} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 transition hover:bg-amber-500/20"><Download className="h-3 w-3" /> Download standalone .html</button>
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span className="inline-block h-2 w-2 rounded-full bg-sky-400" /> Squad <span className="ml-2 inline-block h-2 w-2 rounded-full bg-slate-400" /> Ally / non-squad <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500" /> Enemy <span className="ml-2 inline-block h-2 w-2 rounded-full border border-rose-300" /> Downed <span className="ml-2 inline-block h-2 w-2 rounded-full border border-sky-300" /> Intel participant <span className="ml-auto text-slate-600">Mechanic/cast rings mark event location, not AoE size.</span></p>
        </Panel>
      )}
    </div>
  );
}
