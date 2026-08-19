import { describe, expect, it } from "vitest";
import type { ReplayFightEntry } from "../../types/report";
import { buildEventReplaySnapshotEvidence } from "../intelligence/eventReplayEvidence";

function fight(): ReplayFightEntry {
  return {
    fightId: "fight-trend",
    fightName: "Trend Fight",
    data: {
      durationMs: 20_000,
      bounds: { minX: 0, maxX: 800, minY: 0, maxY: 100 },
      map: null,
      mechanics: [],
      skillMeta: {},
      players: [
        {
          account: "Commander.1234",
          name: "Commander",
          profession: "Guardian",
          inSquad: true,
          isCommander: true,
          points: [
            { t: 0, x: 0, y: 0 },
            { t: 5_000, x: 0, y: 0 },
            { t: 10_000, x: 0, y: 0 },
            { t: 15_000, x: 0, y: 0 },
            { t: 20_000, x: 0, y: 0 },
          ],
          downIntervals: [],
          deadIntervals: [],
          facings: [],
          casts: [],
        },
        {
          account: "Frontline.1234",
          name: "Frontline",
          profession: "Warrior",
          inSquad: true,
          isCommander: false,
          points: [
            { t: 0, x: 100, y: 0 },
            { t: 5_000, x: 150, y: 0 },
            { t: 10_000, x: 300, y: 0 },
            { t: 15_000, x: 500, y: 0 },
            { t: 20_000, x: 650, y: 0 },
          ],
          downIntervals: [[14_000, 16_000]],
          deadIntervals: [],
          facings: [],
          casts: [],
        },
        {
          account: "Support.1234",
          name: "Support",
          profession: "Tempest",
          inSquad: true,
          isCommander: false,
          points: [
            { t: 0, x: 200, y: 0 },
            { t: 5_000, x: 200, y: 0 },
            { t: 10_000, x: 200, y: 0 },
            { t: 15_000, x: 200, y: 0 },
            { t: 20_000, x: 200, y: 0 },
          ],
          downIntervals: [],
          deadIntervals: [],
          facings: [],
          casts: [],
        },
      ],
      enemies: [],
    },
  };
}

describe("event replay temporal trend evidence", () => {
  it("describes before/anchor/after movement relative to tag without asserting causation", () => {
    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [fight()],
      fightId: "fight-trend",
      timestampMs: 10_000,
      relatedPlayerKeys: ["Frontline.1234"],
    });

    const trend = snapshot?.linkedPlayers[0].trend;
    expect(trend?.before.timestampMs).toBe(5_000);
    expect(trend?.anchor.timestampMs).toBe(10_000);
    expect(trend?.after.timestampMs).toBe(15_000);
    expect(trend?.before.distanceToCommander).toBeCloseTo(150);
    expect(trend?.anchor.distanceToCommander).toBeCloseTo(300);
    expect(trend?.after.distanceToCommander).toBeCloseTo(500);
    expect(trend?.distanceToCommanderDeltaBeforeToAnchor).toBeCloseTo(150);
    expect(trend?.distanceToCommanderDeltaAnchorToAfter).toBeCloseTo(200);
    expect(trend?.after.isDown).toBe(true);
  });

  it("clamps trend samples at fight boundaries instead of extrapolating", () => {
    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [fight()],
      fightId: "fight-trend",
      timestampMs: 2_000,
      relatedPlayerKeys: ["Frontline.1234"],
    });

    const trend = snapshot?.linkedPlayers[0].trend;
    expect(trend?.before.timestampMs).toBe(0);
    expect(trend?.anchor.timestampMs).toBe(2_000);
    expect(trend?.after.timestampMs).toBe(7_000);
  });

  it("keeps trend deltas unknown when positional evidence is unavailable", () => {
    const input = fight();
    input.data.players[1].points = [];

    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [input],
      fightId: "fight-trend",
      timestampMs: 10_000,
      relatedPlayerKeys: ["Frontline.1234"],
    });

    const trend = snapshot?.linkedPlayers[0].trend;
    expect(trend?.before.distanceToCommander).toBeNull();
    expect(trend?.anchor.distanceToCommander).toBeNull();
    expect(trend?.after.distanceToCommander).toBeNull();
    expect(trend?.distanceToCommanderDeltaBeforeToAnchor).toBeNull();
    expect(trend?.distanceToCommanderDeltaAnchorToAfter).toBeNull();
  });
});
