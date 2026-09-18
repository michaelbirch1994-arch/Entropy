import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock3, Plus, X } from 'lucide-react';
import type { WvWReport } from '../../types/report';
import type { Gw2Skill } from '../../types/buildEditor';
import { fetchGw2Skills } from '../../lib/gw2/gw2Api';
import { playerSkillState } from '../../lib/insight/playerSkillState';
import type { PlayerSkillStateContext } from '../../lib/insight/playerSkillState';
import { playerSkillTimeline } from '../../lib/insight/playerSkillTimeline';
import {
  buildPlayerSkillPalette,
  supplementalPlayerSkillIds,
  type PlayerPaletteSkill,
  type SkillReferenceSource,
} from '../../lib/insight/playerSkillPalette';

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
const sourceLabel = (source: SkillReferenceSource) => source === 'api' ? 'ArenaNet API' : source === 'wiki-wvw' ? 'GW2 Wiki · WvW' : source === 'documented' ? 'Documented reference' : 'Recorded cast';
const wikiUrl = (name: string) => `https://wiki.guildwars2.com/wiki/${encodeURIComponent(name.replaceAll(' ', '_'))}`;

type SkillReferenceSet = { key: string; skills: Record<number, Gw2Skill>; failed: boolean; error?: string };

function PaletteSkill({ entry, hotkey, selected, casts, timeMs, fallback, context, onSelect }: {
  entry: PlayerPaletteSkill | null;
  hotkey: string;
  selected: boolean;
  casts: NonNullable<WvWReport['stats']['rotations']>['fights'][number]['players'][number]['casts'];
  timeMs: number;
  fallback?: { name: string; icon?: string };
  context: PlayerSkillStateContext;
  onSelect: (id: number) => void;
}) {
  if (!entry) return <span className="player-skill-tile is-empty" aria-label={`Skill slot ${hotkey} unresolved`}><Plus aria-hidden="true"/><b>{hotkey}</b></span>;
  const state = playerSkillState(casts, entry.id, timeMs, entry.skill, context);
  const remaining = state.remainingMs;
  const conflicted = state.status === 'reference-conflict' || state.status === 'adjusted-uncertain';
  const isRecharging = !conflicted && (state.status === 'adjusted-recharging' || state.status === 'base-recharging');
  const isReferenceElapsed = !conflicted && (state.status === 'adjusted-elapsed' || state.status === 'base-elapsed');
  const rechargeScale = state.adjusted?.adjustedBaseMs ?? state.baseMs;
  const fill = remaining !== null && rechargeScale ? Math.min(100, Math.max(0, remaining / rechargeScale * 100)) : 0;
  const name = entry.skill?.name ?? fallback?.name ?? `Skill ${entry.id}`;
  const icon = entry.skill?.icon ?? fallback?.icon;
  const status = state.status === 'reference-conflict' ? 'cooldown has unexplained acceleration'
    : state.status === 'adjusted-uncertain' ? 'cooldown is inside a modeled uncertainty range'
      : isRecharging ? `${seconds(remaining!)} modeled recharge remaining`
        : isReferenceElapsed ? 'modeled recharge elapsed' : 'cooldown unknown';
  return <button
    type="button"
    data-skill-id={entry.id}
    data-source={entry.source}
    className={`player-skill-tile${selected ? ' is-selected' : ''}${isRecharging ? ' is-recharging' : ''}${remaining === null ? ' is-unknown' : ''}${conflicted ? ' is-conflicted' : ''}`}
    aria-pressed={selected}
    aria-label={`${hotkey}: ${name}, ${status}`}
    title={`${name} · ${sourceLabel(entry.source)} · ${status}`}
    onClick={() => onSelect(entry.id)}
  >
    {icon ? <img src={icon} alt=""/> : <span className="player-skill-fallback">?</span>}
    {isRecharging && <><span className="player-skill-cooldown-shade" style={{ height: `${fill}%` }} aria-hidden="true"/><strong className="player-skill-cooldown-value">{Math.ceil(remaining! / 1000)}</strong></>}
    {isReferenceElapsed && <Check className="player-skill-ready-mark" aria-hidden="true"/>}
    {conflicted && <AlertTriangle className="player-skill-conflict-mark" aria-hidden="true"/>}
    {entry.uses > 0 && <span className="player-skill-use-count">×{entry.uses}</span>}
    <b className="player-skill-hotkey">{hotkey}</b>
  </button>;
}

export default function PlayerLoadoutInspector({ report, account, fightId, timeMs, initialSkillId, onClose, onTime }: {
  report: WvWReport; account: string; fightId: string; timeMs: number; initialSkillId?: number; onClose: () => void; onTime: (ms: number) => void;
}) {
  const inspector = useRef<HTMLElement>(null);
  const rotationFight = report.stats.rotations?.fights.find((fight) => fight.fightId === fightId);
  const player = rotationFight?.players.find((candidate) => candidate.account === account);
  const casts = useMemo(() => player?.casts ?? [], [player]);
  const observedIds = useMemo(() => [...new Set(casts.map((cast) => cast.skillId).filter((id) => Number.isSafeInteger(id) && id > 0))], [casts]);
  const referenceIds = useMemo(() => [...new Set([...observedIds, ...(initialSkillId ? [initialSkillId] : []), ...supplementalPlayerSkillIds(player?.profession)])], [observedIds, initialSkillId, player?.profession]);
  const referenceKey = referenceIds.join(',');
  const [selected, setSelected] = useState(initialSkillId ?? 0);
  const [activeBar, setActiveBar] = useState('weapon');
  const [showAdditional, setShowAdditional] = useState(false);
  const [referenceSet, setReferenceSet] = useState<SkillReferenceSet>();

  useEffect(() => {
    inspector.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let live = true;
    if (!referenceIds.length) { setReferenceSet({ key: referenceKey, skills: {}, failed: false }); return () => { live = false; }; }
    const timeout = setTimeout(() => { if (live) { setReferenceSet({ key: referenceKey, skills: {}, failed: true }); live = false; } }, 8000);
    fetchGw2Skills(referenceIds).then((skills) => {
      if (live) { clearTimeout(timeout); setReferenceSet({ key: referenceKey, skills: Object.fromEntries(skills.map((skill) => [skill.id, skill])), failed: false }); }
    }).catch((error) => {
      if (live) { clearTimeout(timeout); setReferenceSet({ key: referenceKey, skills: {}, failed: true, error: error instanceof Error ? error.message : 'Unknown reference error' }); }
    });
    return () => { live = false; clearTimeout(timeout); };
  }, [referenceKey]);

  const references = referenceSet?.key === referenceKey ? referenceSet.skills : {};
  const referencesPending = Boolean(referenceIds.length && referenceSet?.key !== referenceKey);
  const meta = report.stats.rotations?.skillMeta;
  const replayPlayer = report.stats.replayFights?.find((fight) => fight.fightId === fightId)?.data.players.find((candidate) => candidate.account === account);
  const cooldownContext = useMemo<PlayerSkillStateContext>(() => ({
      profession: player?.profession,
      skillMeta: meta,
      effects: replayPlayer?.effects ?? [],
      effectTimelineComplete: Boolean(replayPlayer?.effects.length),
      gameMode: 'wvw',
  }), [player?.profession, meta, replayPlayer]);
  const palette = useMemo(() => buildPlayerSkillPalette(player?.profession, casts, references, timeMs, initialSkillId), [player?.profession, casts, references, timeMs, initialSkillId]);
  const allPaletteSkills = [...palette.utilitySlots, ...palette.mechanics, ...palette.bars.flatMap((bar) => bar.slots), ...palette.additional]
    .filter((entry): entry is PlayerPaletteSkill => Boolean(entry));
  const paletteReferenceLabel = useMemo(() => {
    const sources = new Set(allPaletteSkills.map((entry) => entry.source));
    const labels = [sources.has('api') ? 'API' : '', sources.has('wiki-wvw') ? 'WIKI WvW' : '', sources.has('documented') ? 'DOCUMENTED' : ''].filter(Boolean);
    return labels.length ? labels.join(' + ') : 'RECORDED ONLY';
  }, [allPaletteSkills]);
  const selectedEntry = allPaletteSkills.find((entry) => entry.id === selected) ?? allPaletteSkills.find((entry) => observedIds.includes(entry.id)) ?? allPaletteSkills[0];
  const id = selectedEntry?.id ?? 0;
  const skill = selectedEntry?.skill;
  const state = id ? playerSkillState(casts, id, timeMs, skill, cooldownContext) : null;
  const timeline = useMemo(
    () => playerSkillTimeline(casts, id, rotationFight?.durationMs ?? 0, state?.baseMs ?? null, state?.unexplainedGapEndMs),
    [casts, id, rotationFight?.durationMs, state?.baseMs, state?.unexplainedGapEndMs],
  );
  const timelineDuration = Math.max(1, timeline.durationMs);
  const timelinePosition = (value: number) => `${Math.min(100, Math.max(0, value / timelineDuration * 100))}%`;
  const cursorRatio = Math.min(1, Math.max(0, timeMs / timelineDuration));
  const cursorEdge = cursorRatio < .1 ? 'start' : cursorRatio > .9 ? 'end' : 'middle';
  const times = [...new Set(casts.filter((cast) => cast.skillId === id && Number.isFinite(cast.castTime) && cast.castTime >= 0).map((cast) => cast.castTime))].sort((a, b) => a - b);
  const previous = times.filter((time) => time < timeMs).at(-1);
  const next = times.find((time) => time > timeMs);
  const displayedBar = palette.bars.find((bar) => bar.key === activeBar) ?? palette.bars[0];
  const requestedBarKey = initialSkillId ? palette.bars.find((bar) => bar.slots.some((entry) => entry?.id === initialSkillId))?.key : undefined;
  useEffect(() => {
    if (initialSkillId) setSelected(initialSkillId);
    if (requestedBarKey) setActiveBar(requestedBarKey);
  }, [initialSkillId, requestedBarKey]);
  const selectedRemaining = state?.remainingMs ?? null;
  const selectedStatus = state?.status === 'reference-conflict' || state?.status === 'adjusted-uncertain' ? 'uncertain'
    : selectedRemaining === null ? 'unknown' : state?.status === 'adjusted-recharging' || state?.status === 'base-recharging' ? 'recharging' : 'reference-ready';
  const chooseMechanic = (entry: PlayerPaletteSkill, index: number) => {
    setSelected(entry.id);
    if (player?.profession === 'Firebrand') setActiveBar(['justice', 'resolve', 'courage'][index] ?? 'weapon');
    if (player?.profession === 'Druid') setActiveBar('celestial-avatar');
  };

  return <aside ref={inspector} tabIndex={-1} className="player-loadout-inspector" aria-label="Player combat skill palette and evidence">
    <header><div><small>PLAYER COMBAT PALETTE</small><h3>{account}</h3><span>{player?.profession ?? 'Profession unknown'} · evaluated at {seconds(timeMs)}</span></div><button aria-label="Close player evidence" title="Close player evidence" onClick={onClose}><X size={18}/></button></header>
    <section className="player-skill-palette" aria-label="Recorded and profession skill palette">
      <div className="player-skill-palette-head"><span><strong>{player?.profession ?? 'Player'} skill palette</strong><small>Documented slots · fight casts · effect-adjusted cooldown at the selected moment</small></span><b>{referencesPending ? 'Loading references' : referenceSet?.failed ? 'References offline' : `${paletteReferenceLabel}${replayPlayer ? ' + COMBAT EFFECTS' : ''}`}</b></div>
      <div className="player-palette-legend" aria-label="Skill cooldown model states"><span data-state="elapsed"><i/>Modeled elapsed</span><span data-state="recharging"><i/>Adjusted recharging</span><span data-state="unknown"><i/>Modifier uncertainty</span></div>
      {palette.mechanics.length > 0 && <div className="player-mechanic-row" aria-label="Profession mechanics"><div className="player-mechanic-skills">{palette.mechanics.map((entry, index) => <PaletteSkill key={entry.id} entry={entry} hotkey={player?.profession === 'Druid' ? 'F5' : `F${index + 1}`} selected={entry.id === id} casts={casts} timeMs={timeMs} fallback={meta?.[entry.id]} context={cooldownContext} onSelect={() => chooseMechanic(entry, index)}/>)}</div><span><strong>Profession mechanics</strong><small>{player?.profession === 'Firebrand' ? 'Choose a tome to reveal its five chapters' : player?.profession === 'Druid' ? 'Celestial Avatar replaces weapon skills 1–5' : 'Observed mechanic casts'}</small></span></div>}
      <nav className="player-bar-tabs" aria-label="Skill bar state">{palette.bars.map((bar) => <button key={bar.key} type="button" aria-pressed={displayedBar?.key === bar.key} onClick={() => setActiveBar(bar.key)}><span>{bar.label}</span><small>{sourceLabel(bar.source)}</small></button>)}</nav>
      <div className="player-combat-bar">
        <div className="player-combat-group is-weapon"><div className="player-combat-label"><span>{displayedBar?.label ?? 'Weapon skills'}</span><small>{displayedBar ? `${sourceLabel(displayedBar.source)} · cast-derived` : 'Unresolved'}</small></div><div className="player-combat-skills">{Array.from({ length: 5 }, (_, index) => { const entry = displayedBar?.slots[index] ?? null; return <PaletteSkill key={`${displayedBar?.key ?? 'none'}-${index}-${entry?.id ?? 'empty'}`} entry={entry} hotkey={String(index + 1)} selected={entry?.id === id} casts={casts} timeMs={timeMs} fallback={entry ? meta?.[entry.id] : undefined} context={cooldownContext} onSelect={setSelected}/>; })}</div></div>
        <div className="player-combat-core" aria-label={`Selected moment ${seconds(timeMs)}`}><strong>{clock(timeMs).slice(0, -4)}</strong><span>MOMENT</span></div>
        <div className="player-combat-group is-utility"><div className="player-combat-label"><span>Healing & utility</span><small>Observed casts by slot type</small></div><div className="player-combat-skills">{palette.utilitySlots.map((entry, index) => <PaletteSkill key={`utility-${index}-${entry?.id ?? 'empty'}`} entry={entry} hotkey={index === 4 ? '0' : String(index + 6)} selected={entry?.id === id} casts={casts} timeMs={timeMs} fallback={entry ? meta?.[entry.id] : undefined} context={cooldownContext} onSelect={setSelected}/>)}</div></div>
      </div>
      {palette.additional.length > 0 && <details className="player-additional-casts" open={showAdditional} onToggle={event => setShowAdditional(event.currentTarget.open)}><summary>Additional skill evidence <span>{palette.additional.length}</span></summary><div className="player-skill-grid">{palette.additional.map((entry) => <PaletteSkill key={entry.id} entry={entry} hotkey="·" selected={entry.id === id} casts={casts} timeMs={timeMs} fallback={meta?.[entry.id]} context={cooldownContext} onSelect={setSelected}/>)}</div></details>}
    </section>

    <details className="player-evidence-provenance"><summary>Loadout evidence and source coverage</summary><div className="player-loadout-proof" aria-label="Loadout evidence status"><span><small>Effects</small><strong>{replayPlayer ? 'Timestamped' : 'Unavailable'}</strong></span><span><small>Traits & sigils</small><strong>Not captured</strong></span><span><small>Skill evidence</small><strong>{observedIds.length ? `${observedIds.length} observed` : 'No casts'}</strong></span></div></details>

    {state && selectedEntry ? <>
      <div className="player-skill-heading" data-status={selectedStatus}>{(skill?.icon ?? meta?.[id]?.icon) && <img src={skill?.icon ?? meta?.[id]?.icon} alt="" width="48" height="48"/>}<div><small>SELECTED SKILL · {sourceLabel(selectedEntry.source)}</small><h4>{skill?.name ?? meta?.[id]?.name ?? `Skill ${id}`}</h4><span>{skill?.type ?? (referenceSet?.failed ? 'Reference unavailable' : 'Recorded skill')} · {initialSkillId === id && !observedIds.includes(id) ? 'Documented reference; no recorded casts' : `${state.recordedUses} uses by this moment`}</span></div></div>
      <section className="player-skill-timeline" aria-label={`Recorded casts and cooldown evidence for ${skill?.name ?? meta?.[id]?.name ?? `skill ${id}`}`}>
        <header><strong>COOLDOWN TIMELINE</strong><span>{timeline.baseMs === null ? 'Recharge reference unavailable' : `${seconds(timeline.baseMs)} API base · markers use adjusted checks`}</span></header>
        <div className="player-skill-timeline-track">
          {timeline.windows.map((window, index) => <i key={`${window.startMs}-${index}`} className="player-skill-timeline-window" style={{ left: timelinePosition(window.startMs), width: `${Math.max(0, (window.endMs - window.startMs) / timelineDuration * 100)}%` }} aria-hidden="true"/>)}
          {timeline.markers.map((marker, index) => <button key={`${marker.timeMs}-${index}`} type="button" className={`player-skill-timeline-marker${marker.conflictWithPrevious ? ' is-conflicted' : ''}`} style={{ left: timelinePosition(marker.timeMs) }} title={`Recorded cast at ${clock(marker.timeMs)}${marker.conflictWithPrevious ? ' · sooner than base recharge' : ''}`} aria-label={`Recorded cast at ${clock(marker.timeMs)}${marker.conflictWithPrevious ? ', sooner than base recharge' : ''}`} onClick={() => onTime(marker.timeMs)}/>)}
          <b className="player-skill-timeline-cursor" data-edge={cursorEdge} style={{ left: timelinePosition(timeMs) }} aria-hidden="true"><span>{clock(timeMs).slice(0, -4)}</span></b>
        </div>
        <footer><span>0:00</span><small>Recorded casts · shaded base-reference recharge</small><span>{clock(timeline.durationMs).slice(0, -4)}</span></footer>
      </section>
      <nav className="player-cast-navigation" aria-label="Recorded skill uses"><button title="Previous recorded use" aria-label="Previous recorded use" disabled={previous === undefined} onClick={() => previous !== undefined && onTime(previous)}><ArrowLeft size={17}/></button><span>{times.length} recorded uses in fight</span><button title="Next recorded use" aria-label="Next recorded use" disabled={next === undefined} onClick={() => next !== undefined && onTime(next)}><ArrowRight size={17}/></button></nav>
      <dl className="player-loadout-fields is-skill-timing"><div><dt>Last cast</dt><dd>{state.lastUseMs === null ? 'None before this moment' : clock(state.lastUseMs)}</dd></div><div><dt>API base cooldown</dt><dd>{state.baseMs === null ? 'Unavailable' : seconds(state.baseMs)}</dd></div><div><dt>Model certainty</dt><dd>{state.adjusted ? `${state.adjusted.coveragePct}%` : 'Unavailable'}</dd></div></dl>
      <div className="player-recharge" data-status={selectedStatus} role="status">{selectedStatus === 'reference-ready' ? <Check size={18}/> : selectedStatus === 'uncertain' ? <AlertTriangle size={18}/> : <Clock3 size={18}/>}<span><strong>{selectedStatus === 'uncertain' ? 'Cooldown is inside an uncertainty range' : selectedStatus === 'unknown' ? 'Cooldown unavailable' : selectedStatus === 'recharging' ? `${seconds(selectedRemaining!)} modeled recharge remaining` : 'Modeled recharge elapsed'}</strong><small>{selectedStatus === 'reference-ready' ? 'Icon restored; resources, range, state, and actual usability remain unverified.' : selectedStatus === 'recharging' ? 'Known combat effects are included; the icon restores when the conservative bound reaches zero.' : 'Inspect the quantified modifiers and candidate fit below.'}</small></span></div>
      {state.adjusted && <section className="player-cooldown-model" aria-label="Cooldown modifier assessment">
        <header><div><small>COOLDOWN MODIFIER MODEL</small><strong>{state.adjusted.coveragePct}% certainty from captured evidence</strong></div><span>{state.adjusted.adjustedBaseMs !== state.adjusted.baseMs ? `${seconds(state.adjusted.adjustedBaseMs)} trait-adjusted base` : 'No verified base reduction'}</span></header>
        <div className="player-cooldown-math"><span><small>Recharge progress</small><strong>{state.adjusted.minimumProgressMs === state.adjusted.maximumProgressMs ? seconds(state.adjusted.minimumProgressMs) : `${seconds(state.adjusted.minimumProgressMs)}-${seconds(state.adjusted.maximumProgressMs)}`}</strong></span><span><small>Modeled remaining</small><strong>{state.adjusted.remainingMinMs === state.adjusted.remainingMaxMs ? seconds(state.adjusted.remainingMaxMs) : `${seconds(state.adjusted.remainingMinMs)}-${seconds(state.adjusted.remainingMaxMs)}`}</strong></span></div>
        <div className="player-cooldown-modifiers">{state.adjusted.modifiers.slice(0, 8).map(modifier => <a key={modifier.id} href={modifier.source} target="_blank" rel="noreferrer" data-applied={modifier.applied} data-kind={modifier.kind}><span><b>{modifier.name}</b><small>{modifier.detail}</small></span><strong>{modifier.impact}<small>{modifier.certaintyPct}% {modifier.applied ? 'evidence certainty' : 'candidate fit'}</small></strong></a>)}</div>
      </section>}
      {state.reason && <p>{state.reason}.</p>}
      {state.shortGapCount > 0 && <div className="player-reference-conflicts"><strong>{state.shortGapCount} unexplained early recast{state.shortGapCount === 1 ? '' : 's'}</strong>{state.recentShortGaps.map((gap) => <p key={gap.endMs}>{seconds(gap.startMs)} to {seconds(gap.endMs)}: {seconds(gap.gapMs)} between uses, with at least {seconds(gap.assessment?.unexplainedShortfallMs ?? gap.shorterByMs)} still unaccounted for.</p>)}<p>Known Alacrity, Chill, Resistance, and completed supported resets were already included. Check the candidate modifiers above.</p></div>}
      {state.remainingMs !== null && state.baseMs !== null && <progress aria-label="Modeled cooldown progress" max={state.adjusted?.adjustedBaseMs ?? state.baseMs} value={Math.max(0, (state.adjusted?.adjustedBaseMs ?? state.baseMs) - state.remainingMs)}/>} 
      <p>{state.limitations}</p>
      {skill && <p><a href={selectedEntry.source === 'wiki-wvw' ? wikiUrl(skill.name) : `https://api.guildwars2.com/v2/skills/${id}`} target="_blank" rel="noreferrer">{sourceLabel(selectedEntry.source)} reference</a> · Reference facts are not a verified equipped-state snapshot.</p>}
      {referenceSet?.key === referenceKey && referenceSet.failed && <p role="alert" title={referenceSet.error}>Skill references are unavailable. Recorded uses remain available.</p>}
    </> : <p>No recorded skills for this player in this fight.</p>}
  </aside>;
}
