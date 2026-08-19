import { describe, expect, it } from 'vitest';
import { buildEventDeathEvidence } from '../eventDeathEvidence';
import type { DeathRecapEntry } from '../../../types/report';
import type { IntelligenceEventWindow } from '../eventInspection';

const window: IntelligenceEventWindow = {
  anchorTimestampMs: 42_000,
  startTimestampMs: 27_000,
  endTimestampMs: 57_000,
  beforeMs: 15_000,
  afterMs: 15_000,
};

function recap(overrides: Partial<DeathRecapEntry>): DeathRecapEntry {
  return {
    account: 'Player.1234',
    profession: 'Guardian',
    characterName: 'Player',
    fightName: 'Fight One',
    fightIndex: 0,
    deathTimeMs: 42_000,
    toDown: [],
    toKill: [],
    ...overrides,
  };
}

describe('buildEventDeathEvidence', () => {
  it('returns only real death recaps from the same fight and inspection window', () => {
    const evidence = buildEventDeathEvidence({
      deathRecaps: [
        recap({ account: 'Before.1111', deathTimeMs: 30_000 }),
        recap({ account: 'After.2222', deathTimeMs: 50_000 }),
        recap({ account: 'Outside.3333', deathTimeMs: 60_000 }),
        recap({ account: 'OtherFight.4444', fightIndex: 1, deathTimeMs: 40_000 }),
      ],
      fightIndex: 0,
      window,
      relatedPlayerKeys: [],
    });

    expect(evidence.map((item) => item.recap.account)).toEqual(['Before.1111', 'After.2222']);
    expect(evidence.map((item) => item.offsetMs)).toEqual([-12_000, 8_000]);
  });

  it('marks an exact already-linked account without treating nearby deaths as linked players', () => {
    const evidence = buildEventDeathEvidence({
      deathRecaps: [
        recap({ account: 'Linked.1234', deathTimeMs: 41_000 }),
        recap({ account: 'Nearby.5678', deathTimeMs: 43_000 }),
      ],
      fightIndex: 0,
      window,
      relatedPlayerKeys: ['Linked.1234'],
    });

    expect(evidence.map((item) => [item.recap.account, item.linkedPlayer])).toEqual([
      ['Linked.1234', true],
      ['Nearby.5678', false],
    ]);
  });

  it('keeps window boundaries inclusive and deterministic', () => {
    const evidence = buildEventDeathEvidence({
      deathRecaps: [
        recap({ account: 'End.9999', deathTimeMs: 57_000 }),
        recap({ account: 'Start.0001', deathTimeMs: 27_000 }),
      ],
      fightIndex: 0,
      window,
      relatedPlayerKeys: [],
    });

    expect(evidence.map((item) => item.recap.account)).toEqual(['Start.0001', 'End.9999']);
  });

  it('returns no evidence for an invalid fight index', () => {
    expect(buildEventDeathEvidence({
      deathRecaps: [recap({})],
      fightIndex: -1,
      window,
      relatedPlayerKeys: ['Player.1234'],
    })).toEqual([]);
  });
});
