import { describe, expect, it } from 'vitest';
import { parseReplayData } from '../parseReplayData';
import type { RawFightLog } from '../../types/rawFight';

function replayLog(extra: Record<string, unknown> = {}): RawFightLog {
  return {
    durationMS: 1000,
    combatReplayMetaData: { pollingRate: 150 },
    players: [{
      account: 'Squad.1234',
      name: 'Squad Player',
      profession: 'Guardian',
      combatReplayData: {
        start: 0,
        positions: [[0, 0], [1, 1]],
        orientations: [],
        down: [],
        dead: [],
      },
      totalDamageDist: [[]],
      rotation: [],
    }],
    targets: [],
    ...extra,
  } as unknown as RawFightLog;
}

describe('Replay world-space persistence', () => {
  it('persists authoritative EI map identity and opaque WvW metadata in ReplayData', () => {
    const wvwMapData = {
      objectives: [{ id: 'fixture-objective', state: 'fixture-state' }],
      fixtureOnly: true,
    };

    const replay = parseReplayData(replayLog({ mapID: 38, wvwMapData }));

    expect(replay).not.toBeNull();
    expect(replay?.worldSpace).toEqual({ mapId: 38, wvwMapData });
  });

  it('keeps missing world-space evidence explicitly unknown', () => {
    const replay = parseReplayData(replayLog());

    expect(replay).not.toBeNull();
    expect(replay?.worldSpace).toEqual({ mapId: null, wvwMapData: null });
  });
});
