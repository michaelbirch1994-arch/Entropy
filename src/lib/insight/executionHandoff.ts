import type { WvWReport } from '../../types/report';
import type { InsightEvidence } from './evidence';
import { buildCombatConnections, connectionWindow } from './combatConnections';
import { measureReadiness, measureReadinessWindow } from './readiness';
import type { ExecutionAnchor } from './execution/executionAnchors';

/** Keep the clicked evidence intact; attach explicitly scoped context with a byte budget. */
export function executionHandoff(report: WvWReport, record: InsightEvidence, selection: {
  fightId: string; timeMs: number; radiusMs: number; account?: string; anchor?: ExecutionAnchor;
}): InsightEvidence {
  const replay = report.stats.replayFights?.find(f => f.fightId === selection.fightId);
  const players = replay?.data.players ?? [];
  const readiness = replay ? measureReadiness(players, selection.timeMs, replay.data.durationMs).map(({ members: _members, ...r }) => r) : null;
  const continuity = readiness?.map(r => {
    const { before, after } = measureReadinessWindow(players, r.name, selection.timeMs, selection.radiusMs, replay!.data.durationMs);
    return { boon: r.name, before, after };
  }) ?? null;
  const model = selection.account ? buildCombatConnections(report, selection.fightId, selection.account, true) : null;
  const window = model ? connectionWindow(model, selection.timeMs, selection.radiusMs) : null;
  const analysisAnchor = selection.anchor ?? { id: 'manual', kind: 'manual', label: 'Manual moment', timeMs: selection.timeMs,
    evidenceStatus: 'unknown', method: 'user-selected-time', limitations: ['User-selected moment, not a detected engagement.'] };
  const context = { ...selection, anchor: analysisAnchor, methodVersion: 'execution-handoff-v2', readiness, continuity,
    combat: window ? { ...window, events: window.events.slice(0, 120), eventCount: window.events.length,
      omittedEvents: Math.max(0, window.events.length - 120) } : null,
    limitations: [...analysisAnchor.limitations, 'A damage-activity anchor is not a detected engagement. A pressure-wave anchor is not proof of teammate synchronization.', 'Readiness uses the replay squad roster, not verified time-local membership.', 'Continuity durations are summed player-milliseconds, not elapsed fight time.', 'Player effects and damage are not squad totals. Missing data is unknown; timing overlap does not establish cause.'] };
  const full = { ...record, data: { selectedEvidence: record.data, executionContext: context } };
  if (new TextEncoder().encode(JSON.stringify(full)).length <= 60000) return full;
  // Never silently truncate the selected record or relabel partial events as a full timeline.
  const compact = { ...record, data: { selectedEvidence: record.data, executionContext: { ...context, combat: null,
    omittedCombatReason: 'Combined evidence exceeded the 60 KB context budget.' } } };
  return new TextEncoder().encode(JSON.stringify(compact)).length <= 60000 ? compact : record;
}
