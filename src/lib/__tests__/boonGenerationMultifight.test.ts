import { describe, expect, it } from 'vitest';
import { buildBoonTables } from '../bridge-metrics/boonGeneration';
import { getGeneratedSeconds, getWastedSeconds } from '../buffGenerationDuration';

const QUICKNESS_ID = 1187;
const buffMap = {
  [`b${QUICKNESS_ID}`]: {
    name: 'Quickness',
    stacking: false,
    classification: 'Boon',
  },
};

function squadGeneration(generation: number, wasted: number) {
  return [{ id: QUICKNESS_ID, buffData: [{ generation, wasted }] }];
}

describe('Buff Generation multi-fight duration aggregation', () => {
  it('sums generated and wasted duration across fights while preserving stable account identity', () => {
    const { boonTables } = buildBoonTables([
      {
        details: {
          durationMS: 100_000,
          buffMap,
          players: [
            {
              account: 'MultiSpec.1234',
              profession: 'Guardian',
              group: 1,
              activeTimes: [80_000],
              squadBuffs: squadGeneration(10, 5),
            },
            { account: 'GroupMate.1111', profession: 'Warrior', group: 1, activeTimes: [100_000] },
            { account: 'OtherGroup.2222', profession: 'Ranger', group: 2, activeTimes: [100_000] },
          ],
        },
      },
      {
        details: {
          durationMS: 50_000,
          buffMap,
          players: [
            {
              account: 'MultiSpec.1234',
              profession: 'Mesmer',
              group: 2,
              activeTimes: [30_000],
              squadBuffs: squadGeneration(20, 4),
            },
            { account: 'GroupMate.1111', profession: 'Warrior', group: 1, activeTimes: [50_000] },
            { account: 'OtherGroup.2222', profession: 'Ranger', group: 2, activeTimes: [50_000] },
            { account: 'SecondMate.3333', profession: 'Engineer', group: 2, activeTimes: [50_000] },
          ],
        },
      },
    ]);

    const quickness = boonTables.find((table) => table.id === `b${QUICKNESS_ID}`);
    expect(quickness).toBeDefined();

    const row = quickness!.rows.find((candidate) => candidate.account === 'MultiSpec.1234');
    expect(row).toBeDefined();
    expect(quickness!.rows.filter((candidate) => candidate.account === 'MultiSpec.1234')).toHaveLength(1);
    expect(row!.professionList).toEqual(expect.arrayContaining(['Guardian', 'Mesmer']));
    expect(row!.numFights).toBe(2);
    expect(row!.activeTimeMs).toBe(110_000);
    expect(row!.groupSupported).toBe(5);
    expect(row!.squadSupported).toBe(7);

    // Fight 1: 10% * 100s * (3 - 1 recipients) = 20s.
    // Fight 2: 20% * 50s * (4 - 1 recipients) = 30s.
    expect(getGeneratedSeconds(row!, 'squadBuffs', false)).toBe(50);

    // Fight 1: 5% * 100s * 2 = 10s.
    // Fight 2: 4% * 50s * 3 = 6s.
    expect(getWastedSeconds(row!, 'squadBuffs', false)).toBe(16);
  });

  it('keeps partial attendance separate instead of normalizing it to the full session', () => {
    const { boonTables } = buildBoonTables([
      {
        details: {
          durationMS: 100_000,
          buffMap,
          players: [
            { account: 'FullSession.1000', profession: 'Guardian', group: 1, activeTimes: [100_000] },
            { account: 'Mate.1001', profession: 'Warrior', group: 1, activeTimes: [100_000] },
          ],
        },
      },
      {
        details: {
          durationMS: 60_000,
          buffMap,
          players: [
            {
              account: 'Partial.2000',
              profession: 'Revenant',
              group: 1,
              activeTimes: [20_000],
              squadBuffs: squadGeneration(25, 0),
            },
            { account: 'FullSession.1000', profession: 'Guardian', group: 1, activeTimes: [60_000] },
            { account: 'Mate.1001', profession: 'Warrior', group: 2, activeTimes: [60_000] },
          ],
        },
      },
    ]);

    const quickness = boonTables.find((table) => table.id === `b${QUICKNESS_ID}`)!;
    const partial = quickness.rows.find((row) => row.account === 'Partial.2000');

    expect(partial).toBeDefined();
    expect(partial!.numFights).toBe(1);
    expect(partial!.activeTimeMs).toBe(20_000);
    expect(partial!.squadSupported).toBe(3);

    // Generation is reconstructed from the fight in which it occurred only:
    // 25% * 60s * (3 - 1 recipients) = 30s. It must not be diluted over fight 1.
    expect(getGeneratedSeconds(partial!, 'squadBuffs', false)).toBe(30);
  });
});
