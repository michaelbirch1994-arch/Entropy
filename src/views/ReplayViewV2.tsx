import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Crosshair, Download, Film, Pause, Play, RotateCcw, X } from "lucide-react";
import ReplayLiveIntelligencePulse from "../components/replay/ReplayLiveIntelligencePulse";
import ReplayTacticalStatePanel from "../components/replay/ReplayTacticalStatePanel";
import Panel from "../components/ui/Panel";
import { buildIntelligenceDashboard } from "../lib/intelligence/intelligenceDashboard";
import { distanceBetween, interpolateFacing, interpolatePosition, isInInterval } from "../lib/parseReplayData";
import { alignedReplayIntelligenceEvent } from "../lib/replayNearbyIntelligence";
import { buildReplayIntelligenceAnchors } from "../lib/replayIntelligenceAnchors";
import { resolveReplayNavigationTarget, type ResolvedReplayNavigationTarget } from "../lib/replayNavigation";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

export default function ReplayViewV2() {
  const { report } = useReport();
  const { navigationTarget, clearNavigationTarget } = useView();
  const fights = report?.stats.replayFights;
  const [fightIdx, setFightIdx] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [intelligenceOrigin, setIntelligenceOrigin] = useState<ResolvedReplayNavigationTarget | null>(null);
  const pendingSeekRef = useRef<ResolvedReplayNavigationTarget | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [followFocus, setFollowFocus] = useState(true);
  const [showMechanics, setShowMechanics] = useState(true);
  const [showCasts, setShowCasts] = useState(false);
  const [showFacing, setShowFacing] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);

  const fight = fights?.[fightIdx];
  const intelligenceDashboard = useMemo(() => (report ? buildIntelligenceDashboard(report) : null), [report]);
  const replayIntelligenceAnchors = useMemo(
    () => buildReplayIntelligenceAnchors(intelligenceDashboard, fights),
    [intelligenceDashboard, fights],
  );
  const alignedIntelligenceEvent = useMemo(
    () => alignedReplayIntelligenceEvent(replayIntelligenceAnchors, fightIdx, t),
    [replayIntelligenceAnchors, fightIdx, t],
  );
  const alignedParticipantAccounts = useMemo(
    () => new Set(alignedIntelligenceEvent?.accounts ?? []),
    [alignedIntelligenceEvent],
  );

  useEffect(() => {
    const pending = pendingSeekRef.current;
    if (pending && pending.fightIndex === fightIdx) {
      setT(pending.timestampMs);
      setIntelligenceOrigin(pending);
      setSelectedAccount(pending.account ?? null);
      pendingSeekRef.current = null;
    } else {
      setT(0);
      setSelectedAccount(null);
    }
    setPlaying(false);
    setPan({ x: 0, y: 0 });
  }, [fightIdx]);

  useEffect(() => {
    const resolved = resolveReplayNavigationTarget(fights, navigationTarget);
    if (!resolved) return;
    setPlaying(false);
    setPan({ x: 0, y: 0 });
    setFollowFocus(true);
    setIntelligenceOrigin(resolved);
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

  const focusPoint = useMemo(() => {
    if (!fight) return null;
    if (selectedAccount) {
      const selected = fight.data.players.find((player) => player.account === selectedAccount);
      const selectedPoint = selected ? interpolatePosition(selected.points, t) : null;
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

  const [, vbYStr, , vbHStr] = viewBox.split(" ");
  const vbY = Number(vbYStr);
  const vbH = Number(vbHStr);
  const flipTransform = `translate(0, ${2 * vbY + vbH}) scale(1, -1)`;

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (zoom <= 1) return;
    (event.target as Element).setPointerCapture(event.pointerId);
    setFollowFocus(false);
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !svgRef.current || !frame) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setPan({
      x: clamp(dragRef.current.panX - dx * (frame.w / rect.width), -frame.maxPanX, frame.maxPanX),
      y: clamp(dragRef.current.panY + dy * (frame.h / rect.height), -frame.maxPanY, frame.maxPanY),
    });
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current) {
      try {
        (event.target as Element).releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already have been released.
      }
    }
    dragRef.current = null;
    setDragging(false);
  }

  const liveStats = useMemo(() => {
    if (!fight) return null;
    const squadAlive = fight.data.players.filter((player) => player.inSquad && !isInInterval(player.deadIntervals, t) && interpolatePosition(player.points, t));
    const enemiesAlive = fight.data.enemies.filter((enemy) => !isInInterval(enemy.deadIntervals, t) && interpolatePosition(enemy.points, t));
    const commander = squadAlive.find((player) => player.isCommander);
    const commanderPoint = commander ? interpolatePosition(commander.points, t) : null;
    const distances = commanderPoint
      ? squadAlive
          .filter((player) => !player.isCommander)
          .map((player) => distanceBetween(interpolatePosition(player.points, t), commanderPoint))
          .filter((value): value is number => value != null)
      : [];
    return {
      squadCount: squadAlive.length,
      enemyCount: enemiesAlive.length,
      avgDistToTag: distances.length > 0 ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null,
    };
  }, [fight, t]);

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

  function selectPlayer(account: string) {
    setPlaying(false);
    setSelectedAccount(account);
    if (zoom > 1) {
      setFollowFocus(true);
      setPan({ x: 0, y: 0 });
    }
  }

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

  const atIntelligenceAnchor = intelligenceOrigin?.fightIndex === fightIdx && Math.abs(t - intelligenceOrigin.timestampMs) < 1;

  return (
    <div className="space-y-5 animate-view pb-12">
      {intelligenceOrigin?.fightIndex === fightIdx && (
        <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.06] px-4 py-3 shadow-[0_0_30px_-18px_rgba(56,189,248,0.8)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">Intelligence evidence target</div>
              <div className="mt-1 text-sm font-black text-slate-100">Paused at {fmtClock(intelligenceOrigin.timestampMs)} in Fight {intelligenceOrigin.fightIndex + 1}</div>
              <div className="mt-1 text-[11px] text-slate-400">{intelligenceOrigin.account ? `Linked player: ${intelligenceOrigin.account}` : "Replay mechanic / event context"}{intelligenceOrigin.eventId ? ` · Event ${intelligenceOrigin.eventId}` : ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setT(intelligenceOrigin.timestampMs); setPlaying(false); if (intelligenceOrigin.account) setSelectedAccount(intelligenceOrigin.account); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/[0.12]"><RotateCcw className="h-3.5 w-3.5" /> Return to anchor</button>
              <button type="button" aria-label="Dismiss Intelligence replay target" onClick={() => setIntelligenceOrigin(null)} className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/20 p-2 text-slate-500 transition hover:border-white/20 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {fights.length > 1 && (
          <select value={fightIdx} onChange={(event) => { pendingSeekRef.current = null; setIntelligenceOrigin(null); setFightIdx(Number(event.target.value)); }} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
            {fights.map((entry, index) => <option key={entry.fightId} value={index}>#{index + 1} · {entry.fightName}</option>)}
          </select>
        )}
        <span className="text-[10px] text-slate-500">Select a player marker to pin exact-time tactical state.</span>
      </div>

      {fight && bombEvents.length > 0 && (
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
        <Panel title="Fight Replay" subtitle={`${fight.fightName} · tactical movement + exact-time player state`} icon={<Film className="h-3.5 w-3.5" />} action={`${fight.data.players.length} players tracked`}>
          {liveStats && (
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-sky-400/70">Squad tracked now</div><div className="font-mono text-lg font-black text-sky-300">{liveStats.squadCount}</div></div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-rose-400/70">Enemies tracked now</div><div className="font-mono text-lg font-black text-rose-300">{liveStats.enemyCount}</div></div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/70">Avg. dist to tag</div><div className="font-mono text-lg font-black text-amber-300">{liveStats.avgDistToTag == null ? "—" : Math.round(liveStats.avgDistToTag)}</div></div>
            </div>
          )}

          <ReplayLiveIntelligencePulse
            fightIndex={fightIdx}
            timestampMs={t}
            onSeek={(timestampMs, account) => {
              setT(timestampMs);
              setPlaying(false);
              if (account) setSelectedAccount(account);
            }}
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
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-black/70 shadow-[inset_0_0_50px_rgba(0,0,0,0.55)]">
              <svg ref={svgRef} viewBox={viewBox} className="h-[420px] w-full select-none touch-none xl:h-[520px] 2xl:h-[600px]" style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
                <g transform={flipTransform}>
                  {showMap && fight.data.map?.images.map((image, index) => {
                    const visible = image.endMs <= 0 || (t >= image.startMs && t <= image.endMs);
                    if (!visible) return null;
                    const width = fight.data.map!.width;
                    const height = fight.data.map!.height;
                    return <image key={`${image.url}-${index}`} href={image.url} x={image.x} y={image.y} width={width} height={height} opacity={0.9} preserveAspectRatio="none" transform={`translate(0 ${2 * image.y + height}) scale(1 -1)`} />;
                  })}

                  {showMechanics && (fight.data.mechanics ?? []).filter((mechanic) => Math.abs(mechanic.t - t) <= 1500 && mechanic.account).map((mechanic, index) => {
                    const owner = fight.data.players.find((player) => player.account === mechanic.account);
                    const point = owner ? interpolatePosition(owner.points, t) : null;
                    if (!point) return null;
                    const age = Math.abs(mechanic.t - t) / 1500;
                    return <circle key={`mechanic-${mechanic.t}-${index}`} cx={point.x} cy={point.y} r={(10 + age * 14) * markerUnit} fill="none" stroke="#fb7185" strokeWidth={2 * markerUnit} opacity={0.7 * (1 - age)} />;
                  })}

                  {showCasts && fight.data.players.map((player) => {
                    const recent = (player.casts ?? []).filter((cast) => Math.abs(cast.t - t) <= 600);
                    if (recent.length === 0) return null;
                    const point = interpolatePosition(player.points, t);
                    if (!point) return null;
                    const age = Math.min(...recent.map((cast) => Math.abs(cast.t - t))) / 600;
                    return <circle key={`cast-${player.account}`} cx={point.x} cy={point.y} r={(5 + age * 8) * markerUnit} fill="none" stroke="#fbbf24" strokeWidth={1.5 * markerUnit} opacity={0.6 * (1 - age)} />;
                  })}

                  {showFacing && fight.data.enemies.map((enemy) => {
                    if (isInInterval(enemy.deadIntervals, t)) return null;
                    const point = interpolatePosition(enemy.points, t);
                    const angle = interpolateFacing(enemy.facings ?? [], t);
                    if (!point || angle == null) return null;
                    const end = facingLineEnd(point.x, point.y, 10 * markerUnit, angle);
                    return <line key={`enemy-facing-${enemy.id}`} x1={point.x} y1={point.y} x2={end.x2} y2={end.y2} stroke="#fb7185" strokeWidth={1.2 * markerUnit} opacity={0.7} />;
                  })}

                  {fight.data.enemies.map((enemy) => {
                    const point = interpolatePosition(enemy.points, t);
                    if (!point || isInInterval(enemy.deadIntervals, t)) return null;
                    const down = isInInterval(enemy.downIntervals, t);
                    return (
                      <g key={enemy.id}>
                        <circle cx={point.x} cy={point.y} r={(down ? 7.5 : 5.4) * markerUnit} fill="#ef4444" fillOpacity={down ? 0.28 : 0.88} stroke={down ? "#fecdd3" : "#7f1d1d"} strokeWidth={1.7 * markerUnit}><title>{`${enemy.name}${down ? " — downed" : ""}`}</title></circle>
                      </g>
                    );
                  })}

                  {showFacing && fight.data.players.map((player) => {
                    if (isInInterval(player.deadIntervals, t)) return null;
                    const point = interpolatePosition(player.points, t);
                    const angle = interpolateFacing(player.facings ?? [], t);
                    if (!point || angle == null) return null;
                    const end = facingLineEnd(point.x, point.y, 11 * markerUnit, angle);
                    return <line key={`player-facing-${player.account}`} x1={point.x} y1={point.y} x2={end.x2} y2={end.y2} stroke={player.inSquad ? "#38bdf8" : "#94a3b8"} strokeWidth={1.2 * markerUnit} opacity={0.75} />;
                  })}

                  {fight.data.players.map((player) => {
                    const point = interpolatePosition(player.points, t);
                    if (!point || isInInterval(player.deadIntervals, t)) return null;
                    const down = isInInterval(player.downIntervals, t);
                    const selected = selectedAccount === player.account;
                    const intelligenceParticipant = alignedParticipantAccounts.has(player.account);
                    const baseRadius = player.isCommander ? 8.5 : 6;
                    const fill = player.inSquad ? "#38bdf8" : "#94a3b8";
                    return (
                      <g key={player.account} onClick={(event) => { event.stopPropagation(); selectPlayer(player.account); }} className="cursor-pointer">
                        {intelligenceParticipant && (
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={(baseRadius + (selected ? 8.5 : 6.5)) * markerUnit}
                            fill="none"
                            stroke="#7dd3fc"
                            strokeWidth={1.6 * markerUnit}
                            strokeDasharray={`${2.5 * markerUnit} ${2.5 * markerUnit}`}
                            opacity={selected ? 0.7 : 0.9}
                          />
                        )}
                        {selected && <circle cx={point.x} cy={point.y} r={(baseRadius + 6) * markerUnit} fill="none" stroke="#fbbf24" strokeWidth={2 * markerUnit} opacity={0.9} />}
                        {player.isCommander && <circle cx={point.x} cy={point.y} r={(baseRadius + 3) * markerUnit} fill="none" stroke="#f59e0b" strokeWidth={2 * markerUnit} opacity={0.95} />}
                        <circle cx={point.x} cy={point.y} r={(down ? baseRadius + 1.5 : baseRadius) * markerUnit} fill={fill} fillOpacity={down ? 0.35 : 0.95} stroke={down ? "#fb7185" : "#e2e8f0"} strokeWidth={1.4 * markerUnit}><title>{`${player.name} · ${player.profession}${player.isCommander ? " · commander" : ""}${down ? " · downed" : ""}${intelligenceParticipant ? " · Intelligence event participant" : ""}`}</title></circle>
                        {(selected || player.isCommander) && (
                          <text x={point.x} y={point.y - (baseRadius + 6) * markerUnit} textAnchor="middle" fontSize={9 * markerUnit} fontWeight="800" fill={selected ? "#fef3c7" : "#e2e8f0"} stroke="#020617" strokeWidth={2.5 * markerUnit} paintOrder="stroke" transform={`translate(0 ${2 * (point.y - (baseRadius + 6) * markerUnit)}) scale(1 -1)`}>{shortName(player.name)}</text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
            <ReplayTacticalStatePanel data={fight.data} player={selectedPlayer} t={t} />
          </div>

          <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${atIntelligenceAnchor ? "border-sky-400/35 bg-sky-500/[0.07]" : "border-slate-800 bg-slate-900/50"}`}>
            <button type="button" onClick={() => setPlaying((value) => !value)} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-sky-400/35 bg-sky-500/10 text-sky-300 transition hover:bg-sky-500/20">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
            <input type="range" min={0} max={fight.data.durationMs} value={t} onChange={(event) => { setT(Number(event.target.value)); setPlaying(false); }} className="flex-1 accent-sky-400" />
            {atIntelligenceAnchor && <span className="rounded-full border border-sky-400/25 bg-sky-500/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-sky-200">Intel anchor</span>}
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

          <p className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span className="inline-block h-2 w-2 rounded-full bg-sky-400" /> Squad <span className="ml-2 inline-block h-2 w-2 rounded-full bg-slate-400" /> Ally / non-squad <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500" /> Enemy <span className="ml-2 inline-block h-2 w-2 rounded-full border border-rose-300" /> Downed <span className="ml-2 inline-block h-2 w-2 rounded-full border border-dashed border-sky-300" /> Intel participant <span className="ml-auto text-slate-600">Mechanic/cast rings mark event location, not AoE size.</span></p>
        </Panel>
      )}
    </div>
  );
}
