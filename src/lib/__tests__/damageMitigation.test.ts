import { describe, it, expect } from 'vitest';
import { computePlayerAggregation } from '../bridge-metrics/computePlayerAggregation';

function fallbackLog() {
  return {
    details: {
      players: [
        {
          name: 'Alice',
          account: 'Alice.1234',
          profession: 'Guardian',
          notInSquad: false,
          totalDamageTaken: [
            [
              { id: 999, blocked: 2, evaded: 1, glance: 0, missed: 0, invulned: 0, interrupted: 0, hits: 3, connectedHits: 3 },
            ],
          ],
        },
      ],
      targets: [
        {
          totalDamageDist: [[{ id: 999, totalDamage: 3000, connectedHits: 3, min: 500 }]],
        },
      ],
    },
  };
}

function exactSourceLog() {
  return {
    details: {
      players: [
        {
          name: 'Alice',
          account: 'Alice.1234',
          profession: 'Guardian',
          notInSquad: false,
          totalDamageTaken: [[]],
        },
      ],
      targets: [],
      player_damage_mitigation: {
        'Alice|Guardian|Alice.1234': {
          '999': {
            avoided_damage: 500,
            min_avoided_damage: 100,
            blocked: 1,
            evaded: 0,
            glanced: 0,
            missed: 0,
            invulned: 0,
            interrupted: 0,
            skill_hits: 1,
          },
        },
      },
    },
  };
}

const runAgg = (log: any) =>
  computePlayerAggregation({
    validLogs: [log],
    method: 'count',
    skillDamageSource: 'dpsAll',
    splitPlayersByClass: false,
  });

describe('damage mitigation totals', () => {
  it('estimates avoided damage from squad-wide skill averages when EI has no detailed mitigation source, and flags it as estimated', () => {
    const result = runAgg(fallbackLog());
    const row = result.damageMitigationPlayersMap.get('Alice.1234');
    expect(row).toBeTruthy();
    // blocked(2) + evaded(1) = 3 hits avoided entirely, at the observed average of 1000/hit (3000 total / 3 connected hits)
    expect(row!.mitigationTotals.blocked).toBe(2);
    expect(row!.mitigationTotals.evaded).toBe(1);
    expect(row!.mitigationTotals.totalMitigation).toBe(3000);
    expect(row!.mitigationTotals.isEstimated).toBe(true);
  });

  it('preserves exact avoided-damage totals from EI detailed player_damage_mitigation and does not overwrite them with the estimate', () => {
    const result = runAgg(exactSourceLog());
    const row = result.damageMitigationPlayersMap.get('Alice.1234');
    expect(row).toBeTruthy();
    expect(row!.mitigationTotals.blocked).toBe(1);
    expect(row!.mitigationTotals.totalMitigation).toBe(500);
    expect(row!.mitigationTotals.minMitigation).toBe(100);
    expect(row!.mitigationTotals.isEstimated).toBe(false);
  });

  it('does not fabricate mitigation when there is no matching enemy skill data to estimate from', () => {
    const log = fallbackLog();
    log.details.targets = [];
    const result = runAgg(log);
    const row = result.damageMitigationPlayersMap.get('Alice.1234');
    expect(row).toBeTruthy();
    expect(row!.mitigationTotals.totalMitigation).toBe(0);
    expect(row!.mitigationTotals.isEstimated).toBe(true);
  });
});
