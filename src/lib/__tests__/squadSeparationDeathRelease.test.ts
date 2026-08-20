import { describe, expect, it } from 'vitest';
import { detectSquadSeparations } from '../intelligence/squadSeparation';
import type { ParsedReport } from '../bridge-metrics/positioning';

function fullReplayReport(players: any[]): ParsedReport {
  return {
    details: {
      players,
      combatReplayMetaData: { pollingRate: 1000, inchToPixel: 1, sizes: [1000, 1000] },
      durationMS: 12000,
    },
  } as ParsedReport;
}

const commander = {
  name: 'Tag',
  account: 'Tag.1234',
  hasCommanderTag: true,
  combatReplayData: {
    positions: Array.from({ length: 12 }, () => [0, 0] as [number, number]),
    start: 0,
  },
};

function trackedPlayer(
  positions: Array<[number, number]>,
  dead: Array<[number, number]> = [],
) {
  return {
    name: 'Alice',
    account: 'Alice.9999',
    profession: 'Guardian',
    notInSquad: false,
    combatReplayData: { positions, start: 0, down: [], dead },
  };
}

const options = {
  distanceThreshold: 1200,
  minDurationMs: 3000,
  formationDistanceThreshold: 600,
  formationMinDurationMs: 1000,
};

describe('detectSquadSeparations death/release lifecycle', () => {
  it('does not classify a dead or released player at spawn as squad separation', () => {
    const report = fullReplayReport([
      commander,
      trackedPlayer(
        [
          [0, 0],
          [0, 0],
          [0, 0],
          [1600, 0],
          [1600, 0],
          [5000, 0],
          [5000, 0],
          [5000, 0],
          [5000, 0],
        ],
        [[3000, 8000]],
      ),
    ]);

    const events = detectSquadSeparations(report, 'fight-death-spawn', undefined, options);

    expect(events).toHaveLength(0);
  });

  it('requires formation to be re-established after respawn before later separation is eligible', () => {
    const report = fullReplayReport([
      commander,
      trackedPlayer(
        [
          [0, 0],
          [0, 0],
          [0, 0],
          [5000, 0],
          [5000, 0],
          [5000, 0],
          [5000, 0],
          [0, 0],
          [0, 0],
          [1500, 0],
          [1500, 0],
          [1500, 0],
        ],
        [[3000, 5000]],
      ),
    ]);

    const events = detectSquadSeparations(report, 'fight-respawn-reform', undefined, options);

    expect(events).toHaveLength(1);
    expect(events[0].timestampMs).toBe(9000);
  });

  it('preserves a valid separation that completed before death while suppressing post-release distance', () => {
    const report = fullReplayReport([
      commander,
      trackedPlayer(
        [
          [0, 0],
          [1500, 0],
          [1500, 0],
          [1500, 0],
          [5000, 0],
          [5000, 0],
          [5000, 0],
          [5000, 0],
        ],
        [[4000, 7000]],
      ),
    ]);

    const events = detectSquadSeparations(report, 'fight-predeath-separation', undefined, options);

    expect(events).toHaveLength(1);
    expect(events[0].timestampMs).toBe(1000);
    expect(events[0].summary).toMatch(/3.0s/);
  });
});
