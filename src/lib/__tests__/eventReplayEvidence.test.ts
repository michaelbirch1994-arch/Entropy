import { describe, expect, it } from "vitest";
import type { ReplayFightEntry } from "../../types/report";
import { buildEventReplaySnapshotEvidence } from "../intelligence/eventReplayEvidence";

function fight(): ReplayFightEntry {
  return {
    fightId: "fight-a",
    fightName: "Fight A",
    data: {
      durationMs: 20_000,
      bounds: { minX: 0, maxX: 300, minY: 0, maxY: 300 },
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
          points: [{ t: 0, x: 0, y: 0 }, { t: 20_000, x: 0, y: 0 }],
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
          points: [{ t: 0, x: 100, y: 0 }, { t: 20_000, x: 300, y: 0 }],
          downIntervals: [[9_000, 11_000]],
          deadIntervals: [],
          facings: [],
          casts: [],
        },
      ],
      enemies: [
        {
          id: "enemy-1",
          name: "Enemy",
          points: [{ t: 0, x: 50, y: 50 }, { t: 20_000, x: 50, y: 50 }],
          downIntervals: [[9_500, 10_500]],
          deadIntervals: [],
          facings: [],
        },
      ],
    },
  };
}

describe("buildEventReplaySnapshotEvidence", () => {
  it("builds an exact-time replay snapshot from existing replay tracks", () => {
    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [fight()],
      fightId: "fight-a",
      timestampMs: 10_000,
      relatedPlayerKeys: ["Frontline.1234"],
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.squadAlive).toBe(2);
    expect(snapshot?.squadDown).toBe(1);
    expect(snapshot?.enemiesAlive).toBe(1);
    expect(snapshot?.enemiesDown).toBe(1);
    expect(snapshot?.commanderAccount).toBe("Commander.1234");
    expect(snapshot?.averageSquadDistanceToCommander).toBeCloseTo(200);
    expect(snapshot?.linkedPlayers).toEqual([
      expect.objectContaining({
        account: "Frontline.1234",
        isDown: true,
        isDead: false,
        x: 200,
        y: 0,
        distanceToCommander: 200,
      }),
    ]);
  });

  it("keeps fight scope strict and returns null when replay evidence is unavailable", () => {
    expect(buildEventReplaySnapshotEvidence({
      replayFights: [fight()],
      fightId: "other-fight",
      timestampMs: 10_000,
    })).toBeNull();
  });

  it("clamps timestamps to the replay bounds rather than extrapolating beyond the fight", () => {
    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [fight()],
      fightId: "fight-a",
      timestampMs: 99_000,
      relatedPlayerKeys: ["Frontline"],
    });

    expect(snapshot?.timestampMs).toBe(20_000);
    expect(snapshot?.linkedPlayers[0]).toEqual(expect.objectContaining({ x: 300, y: 0 }));
  });
});
