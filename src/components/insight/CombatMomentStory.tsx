import { Activity, ArrowRight, Shield, Swords } from 'lucide-react';
import type { buildCombatConnections } from '../../lib/insight/combatConnections';
import { classIconSrc } from '../../data/classIconAssets';
import { reportImageSrc } from '../../utils/reportImageAssets';
import { fmtCompact } from '../../utils/format';
import './CombatMomentStory.css';

type Model = NonNullable<ReturnType<typeof buildCombatConnections>>;
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
export default function CombatMomentStory({ model, time, radius, profession, onTime }: { model: Model; time: number; radius: number; profession?: string; onTime: (time: number) => void }) {
  const events = model.moments.filter(m => m.time >= time - radius && m.time <= time + radius)
    .map(m => ({ time: m.time, name: m.label, kind: m.kind as string, icon: m.icon, account: m.account }));
  for (const effect of model.effects) {
    effect.spans.forEach((span, index) => {
      const previous = effect.spans[index - 1];
      if (span.start < time - radius || span.start > time + radius || !previous || previous.end !== span.start || previous.value === span.value) return;
      events.push({ time: span.start, name: `${effect.name}: ${previous.value} to ${span.value}`, kind: effect.classification.toLowerCase(), icon: effect.icon, account: model.account });
    });
  }
  events.sort((a, b) => a.time - b.time);
  const before = events.filter(e => e.time < time).slice(-5);
  const after = events.filter(e => e.time >= time).slice(0, 5);
  const current = model.effects.map(effect => ({ ...effect, value: effect.spans.find(s => s.start <= time && s.end > time)?.value }));
  const dps = model.output.find(p => p.time === Math.floor(time / 1000) * 1000)?.dps;
  const survival = model.moments.find(m => m.account === model.account && ['down', 'death'].includes(m.kind) && m.time <= time && (m.end ?? m.time) > time);
  const renderEvents = (items: typeof events) => items.length ? items.map((event, index) => <button type="button" key={`${event.time}:${index}`} className="moment-story-event" data-kind={event.kind} onClick={() => onTime(event.time)}>
    <time>{clock(event.time)}<small>{event.time < time ? '-' : '+'}{(Math.abs(event.time - time) / 1000).toFixed(1)}s</small></time>
    <span className="moment-story-icon">{event.icon ? <img src={reportImageSrc(event.icon)} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/> : <Activity size={18}/>}</span>
    <span><strong>{event.name}</strong><small>{event.account === model.account ? 'Selected player' : event.account ?? 'Recorded event'}</small></span>
  </button>) : <p className="moment-story-empty">No recorded events in this interval.</p>;
  return <section className="moment-story" aria-label="Moment story">
    <header><span><Activity size={16}/> MOMENT STORY</span><small>Time-linked evidence</small></header>
    <div className="moment-story-grid">
      <section className="moment-story-sequence"><h3>Lead-in <span>{clock(Math.max(0, time - radius))}</span></h3>{renderEvents(before)}</section>
      <section className="moment-story-focus"><div className="moment-story-avatar">{classIconSrc(profession) ? <img src={classIconSrc(profession)} alt={profession}/> : <Swords size={40}/>}</div><span className="moment-story-account">{model.account}</span><time>{clock(time)}</time><strong className="moment-story-state" data-kind={survival?.kind}>{survival ? survival.label : 'No incapacitation recorded at cursor'}</strong><div className="moment-story-damage"><Swords size={15}/><strong>{dps == null ? 'Unknown' : fmtCompact(dps)}</strong><span>5s rolling DPS</span></div></section>
      <section className="moment-story-sequence"><h3>At cursor & after <span>{clock(Math.min(model.fight.duration, time + radius))}</span></h3>{renderEvents(after)}</section>
    </div>
    <div className="moment-story-effects"><span><Shield size={14}/> EFFECTS AT CURSOR</span><div>{current.map(effect => <span key={effect.id} className="moment-story-effect" data-state={effect.value === undefined ? 'unknown' : effect.value > 0 ? 'present' : 'absent'} data-kind={effect.classification} title={`${effect.name}: ${effect.value === undefined ? 'not recorded at this moment' : `recorded state ${effect.value}`}`}>
      {effect.icon && <img src={reportImageSrc(effect.icon)} alt=""/>}{effect.name}<b>{effect.value ?? '?'}</b></span>)}{!current.length && <small>No timestamped effect states available.</small>}</div></div>
    <footer><ArrowRight size={13}/>Up to five events on each side. Timing does not establish cause.</footer>
  </section>;
}
