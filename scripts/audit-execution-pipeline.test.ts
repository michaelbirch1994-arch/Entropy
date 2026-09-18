import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { normalizeDeathEvents } from '../src/lib/combat/normalizeDeaths';
import { detectFailedRecoveries, detectMassDowns } from '../src/lib/intelligence/criticalEvents';
import { detectSquadSeparations } from '../src/lib/intelligence/squadSeparation';
import { segmentEngagements } from '../src/lib/intelligence/segmentation';
import { executionActivity } from '../src/lib/insight/executionActivity';
import { executionBursts } from '../src/lib/insight/executionBursts';

const directory = process.env.ENTROPY_EXECUTION_AUDIT_DIR;
describe.skipIf(!directory)('opt-in captured execution pipeline audit', () => {
  it('runs the same casualty-based inputs as persisted intelligence without exporting identities', () => {
    const files = readdirSync(directory!).filter(f => f.endsWith('_detailed_wvw_kill.json')).sort();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(directory!, file), 'utf8'));
      const activity = executionActivity(raw);
      const enemyActivity = executionActivity(raw, 'recorded-enemy-players');
      console.log(JSON.stringify({ file, targetScopeAudit: {
        selectedTargets: enemyActivity.selectedTargetIndices?.length,
        unknownClassifications: enemyActivity.unknownTargetClassifications,
        fullFightPhase: enemyActivity.fullFightPhase,
        unknownBins: enemyActivity.bins.filter(b => b.state === 'unknown').length,
        recordedEnemyDamage: enemyActivity.bins.filter(b => b.state !== 'unknown').reduce((sum, b) => sum + (b.damage ?? 0), 0),
        allTargetDamage: activity.bins.filter(b => b.state !== 'unknown').reduce((sum, b) => sum + (b.damage ?? 0), 0),
      } }));
      // Trial thresholds for inspection only, not a validated performance standard.
      const peaks = executionBursts(activity.bins, { baselineBinsEachSide: 2, minimumDamage: 1000, minimumExcess: 1000, minimumRatio: 2 });
      console.log(JSON.stringify({ file, experimentalPeaks: peaks }));
      console.log(JSON.stringify({ file, activityCandidates: activity.candidates, unknownDamageBins: activity.bins.filter(b => b.state === 'unknown').length, unmeasuredTailMs: activity.unmeasuredTailMs }));
      const input = { details: raw } as Parameters<typeof normalizeDeathEvents>[0];
      const events = normalizeDeathEvents(input);
      const critical = [...detectMassDowns(events, file), ...detectFailedRecoveries(events, file), ...detectSquadSeparations(input, file, events)];
      const segments = segmentEngagements({ fightId: file, combatEvents: events.events, criticalEvents: critical });
      for (const s of segments) {
        expect(s.fightId).toBe(file);
        expect(s.end.timestampMs).toBeGreaterThanOrEqual(s.start.timestampMs);
      }
      console.log(JSON.stringify({ file, normalizedEvents: events.events.length, criticalEvents: critical.length,
        segments: segments.map(s => ({ startMs: s.start.timestampMs, endMs: s.end.timestampMs, reason: s.start.reason })),
        categories: [...new Set(events.events.map(e => e.category))] }));
    }
  });
});
