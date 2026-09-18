import { describe, expect, it } from 'vitest';
import type { WvWReport } from '../../types/report';
import { executionAnchors, preferredExecutionAnchor } from '../insight/execution/executionAnchors';
import { executionActivity, summarizeExecutionActivity } from '../insight/executionActivity';

const summary = (scope: 'all-targets' | 'recorded-enemy-players') => summarizeExecutionActivity(executionActivity({
  durationMS: 3000,
  phases: [{ start: 0, end: 3000 }],
  targets: [{ enemyPlayer: true }],
  players: [{ account: 'A', damage1S: [[0, 0, 10, 20]], targetDamage1S: [[[0, 5, 10, 15]]] }],
}, scope));

describe('execution activity anchors', () => {
  it('prefers enemy-player activity while preserving the broader scope separately', () => {
    const report = { stats: { executionActivity: { fights: [{ fightId: 'f', fightName: 'Fight', scopes: {
      recordedEnemyPlayers: summary('recorded-enemy-players'), allTargets: summary('all-targets'),
    } }] } } } as unknown as WvWReport;
    const anchors = executionAnchors(report, 'f');
    expect(anchors.map(anchor => anchor.scope)).toEqual([undefined, 'recorded-enemy-players', 'all-targets']);
    expect(preferredExecutionAnchor(anchors)).toMatchObject({ scope: 'recorded-enemy-players', timeMs: 0, timeBoundsMs: [0, 999], evidenceStatus: 'calculated' });
    expect(anchors[1].label).not.toContain('engage');
  });

  it('falls back to an explicitly manual moment when activity evidence is absent', () => {
    const anchors = executionAnchors({ stats: {} } as WvWReport, 'missing');
    expect(preferredExecutionAnchor(anchors)).toMatchObject({ id: 'manual', method: 'user-selected-time' });
  });

  it('prefers a measured enemy pressure wave and carries its comparison evidence', () => {
    const pressureSummary = (scope: 'all-targets' | 'recorded-enemy-players') => summarizeExecutionActivity(executionActivity({
      durationMS: 5000,
      phases: [{ start: 0, end: 5000 }],
      targets: [{ enemyPlayer: true }],
      players: [{ account: 'A', damage1S: [[0, 10, 20, 5020, 5030, 5040]], targetDamage1S: [[[0, 10, 20, 5020, 5030, 5040]]] }],
    }, scope));
    const report = { stats: { executionActivity: { fights: [{ fightId: 'f', fightName: 'Fight', scopes: {
      recordedEnemyPlayers: pressureSummary('recorded-enemy-players'), allTargets: pressureSummary('all-targets'),
    } }] }, rotations: { skillMeta: { 10: { name: 'Pressure Strike', icon: '/strike.png' }, 20: { name: 'Support Pulse' } }, fights: [{
      fightId: 'f', fightName: 'Fight', durationMs: 5000, damagingSkillIds: [10], players: [
        { account: 'A', profession: 'Guardian', professionList: ['Guardian'], casts: [{ skillId: 10, castTime: 2100, duration: 500 }] },
        { account: 'B', profession: 'Ranger', professionList: ['Ranger'], casts: [{ skillId: 20, castTime: 2500, duration: 250 }] },
      ],
    }] } } } as unknown as WvWReport;
    const anchor = preferredExecutionAnchor(executionAnchors(report, 'f'));
    expect(anchor).toMatchObject({ kind: 'damage-pressure', scope: 'recorded-enemy-players', timeMs: 2000,
      timeBoundsMs: [2000, 2999], damage: 5000, baseline: 10, excess: 4990, ratio: 500 });
    expect(anchor.castContext).toMatchObject({ recordedPlayers: 2, playersStartingCasts: 2, castStarts: 2,
      damagingCastStarts: 1, damagingPlayers: 1 });
    expect(anchor.castContext?.skills[0]).toMatchObject({ name: 'Pressure Strike', casts: 1, players: 1, damaging: true });
  });
});
