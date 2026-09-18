import type { WvWReport } from '../../types/report';
import { buildCombatConnections, connectionWindow, type CombatMoment } from './combatConnections';
import { eventResponses, type ResponseKind } from './eventResponses';
import type { InsightEvidence } from './evidence';

export function eventContext(report: WvWReport, fightId: string, event: CombatMoment) {
  if (!event.account || !Number.isFinite(event.time)) return null;
  const model = buildCombatConnections(report, fightId, event.account);
  if (!model || event.time < 0 || event.time > model.fight.duration) return null;
  const window = connectionWindow(model, event.time, 5000);
  const effects = model.effects.map(effect => {
    const atEvent = effect.spans.find(span => span.start <= event.time && span.end > event.time)?.value ?? null;
    function interval(start: number, end: number) {
      const durationMs = end - start;
      let coveredMs = 0, presentMs = 0;
      for (const span of effect.spans) {
        const overlap = Math.max(0, Math.min(end, span.end) - Math.max(start, span.start));
        coveredMs += overlap;
        if (span.value > 0) presentMs += overlap;
      }
      return { durationMs, coveredMs, presentMs,
        presencePercentOfCoveredTime: coveredMs > 0 ? Math.round(presentMs / coveredMs * 100) : null };
    }
    return { name: effect.name.slice(0, 160), classification: effect.classification, atEvent,
      before: interval(window.startMs, event.time), after: interval(event.time, window.endMs) };
  });
  return { targetAccount: event.account, startMs: window.startMs, eventTimeMs: event.time, endMs: window.endMs,
    effects: effects.slice(0, 40), omittedEffects: Math.max(0, effects.length - 40),
    targetEvents: window.events.slice(0, 40).map(({ icon: _icon, ...moment }) => ({ ...moment, label: moment.label.slice(0, 160) })),
    omittedTargetEvents: Math.max(0, window.events.length - 40), output: window.output,
    coverage: model.coverage, limitations: [...window.limitations,
      'Effect presence percentages use covered milliseconds, not unknown time. These are measurements, not confidence scores.',
      'Only the target player is represented here. Output is outgoing damage, not incoming damage or healing.',
      'No per-event healing or cleanse-recipient attribution is available in this context. A condition ending does not identify its remover.'] };
}

export function eventInvestigation(report: WvWReport, fightId: string, event: CombatMoment, kind: ResponseKind, responses = eventResponses(report, fightId, event, kind)): InsightEvidence {
  const fightIndex = report.stats.fightBreakdown?.findIndex(fight => fight.id === fightId) ?? -1;
  const data = { fightId, ...responses, candidates: responses.candidates.slice(0, 8),
    omittedCandidates: Math.max(0, responses.candidates.length - 8), context: eventContext(report, fightId, event) };
  // Keep the event packet bounded alongside the existing player evidence budget.
  while (data.candidates.length && new TextEncoder().encode(JSON.stringify(data)).length > 28000) {
    data.candidates.pop(); data.omittedCandidates++;
  }
  return { id: 'W1', label: 'Combat event response investigation', data, provenance: responses.provenance,
    ...(fightIndex >= 0 && event.account ? { replay: { fightIndex, account: event.account, timestampMs: event.time } } : {}) };
}
