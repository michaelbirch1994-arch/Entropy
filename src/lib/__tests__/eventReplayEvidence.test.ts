import { describe, expect, it } from "vitest";
import type { ReplayFightEntry } from "../../types/report";
import { buildEventReplaySnapshotEvidence } from "../intelligence/eventReplayEvidence";

function fight(): ReplayFightEntry {
  return {
    fightId: "fight-a",
    fightName: "Fight A",
    data: {
      durationMs: 20_000,
      bounds: { minX: 0, maxX: 800, minY: 0, maxY: 300 },
      map: null,
      mechanics: [],
      skillMeta: {
        1001: { name: "Push Skill" },
        1002: { name: "Follow-up Skill" },
      },
      players: [
        {
          account: "Commander.1234",
          name: "Commander",
          profession: "Guardian",
          inSquad: true,
          isCommander: true,
          points: [
            { t: 0, x: 0, y: 0 },
            { t: 10_000, x: 0, y: 0 },
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
            { t: 10_000, x: 200, y: 0 },
            { t: 20_000, x: 300, y: 0 },
          ],
          downIntervals: [[9_000, 11_000]],
          deadIntervals: [],
          facings: [],
          casts: [
            { t: 7_499, skillId: 999 },
            { t: 7_500, skillId: 1001 },
            { t: 10_500, skillId: 1002 },
            { t: 12_501, skillId: 1002 },
          ],
        },
        {
          account: "Support.1234",
          name: "Support",
          profession: "Tempest",
          inSquad: true,
          isCommander: false,
          points: [
            { t: 0, x: 230, y: 0 },
            { t: 10_000, x: 230, y: 0 },
            { t: 20_000, x: 230, y: 0 },
          ],
          downIntervals: [],
          deadIntervals: [],
          facings: [],
          casts: [],
        },
        {
          account: "Backline.1234",
          name: "Backline",
          profession: "Mesmer",
          inSquad: true,
          isCommander: false,
          points: [
            { t: 0, x: 750, y: 0 },
            { t: 10_000, x: 750, y: 0 },
            { t: 20_000, x: 750, y: 0 },
          ],
          downIntervals: [],
          deadIntervals: [],
          facings: [],
          casts: [],
        },
      ],
      enemies: [
        {
          id: "enemy-1",
          name: "Enemy",
          points: [
            { t: 0, x: 50, y: 50 },
            { t: 10_000, x: 50, y: 50 },
            { t: 20_000, x: 50, y: 50 },
          ],
          downIntervals: [[9_500, 10_500]],
          deadIntervals: [],
          facings: [],
        },
        {
          id: "enemy-2",
          name: "Far Enemy",
          points: [
            { t: 0, x: 900, y: 0 },
            { t: 10_000, x: 900, y: 0 },
            { t: 20_000, x: 900, y: 0 },
          ],
          downIntervals: [],
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
    expect(snapshot?.squadAlive).toBe(4);
    expect(snapshot?.squadDown).toBe(1);
    expect(snapshot?.enemiesAlive).toBe(2);
    expect(snapshot?.enemiesDown).toBe(1);
    expect(snapshot?.commanderAccount).toBe("Commander.1234");
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

  it("describes linked-player local squad/enemy context without turning proximity into causation", () => {
    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [fight()],
      fightId: "fight-a",
      timestampMs: 10_000,
      relatedPlayerKeys: ["Frontline.1234"],
    });

    const player = snapshot?.linkedPlayers[0];
    expect(player?.nearbySquadWithin240).toBe(2);
    expect(player?.nearbySquadWithin600).toBe(3);
    expect(player?.trackedEnemiesWithin600).toBe(1);
    expect(player?.nearestSquadmates.map((candidate) => candidate.account)).toEqual([
      "Support.1234",
      "Commander.1234",
      "Backline.1234",
    ]);
    expect(player?.nearestSquadmates.map((candidate) => Math.round(candidate.distance))).toEqual([30, 200, 550]);
  });

  it("keeps only replay-backed damaging casts inside the bounded +/-2.5s context window", () => {
    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [fight()],
      fightId: "fight-a",
      timestampMs: 10_000,
      relatedPlayerKeys: ["Frontline.1234"],
    });

    expect(snapshot?.linkedPlayers[0].recentCasts).toEqual([
      { timestampMs: 7_500, offsetMs: -2_500, skillId: 1001, skillName: "Push Skill" },
      { timestampMs: 10_500, offsetMs: 500, skillId: 1002, skillName: "Follow-up Skill" },
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

  it("leaves commander-relative distance unknown when the commander is dead", () => {
    const input = fight();
    input.data.players[0].deadIntervals = [[5_000, 20_000]];

    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [input],
      fightId: "fight-a",
      timestampMs: 10_000,
      relatedPlayerKeys: ["Frontline.1234"],
    });

    expect(snapshot?.commanderAccount).toBeNull();
    expect(snapshot?.averageSquadDistanceToCommander).toBeNull();
    expect(snapshot?.linkedPlayers[0].distanceToCommander).toBeNull();
  });

  it("does not manufacture local-distance counts when the linked player has no valid position", () => {
    const input = fight();
    input.data.players[1].points = [];

    const snapshot = buildEventReplaySnapshotEvidence({
      replayFights: [input],
      fightId: "fight-a",
      timestampMs: 10_000,
      relatedPlayerKeys: ["Frontline.1234"],
    });

    expect(snapshot?.linkedPlayers[0]).toEqual(expect.objectContaining({
      x: null,
      y: null,
      nearbySquadWithin240: null,
      nearbySquadWithin600: null,
      trackedEnemiesWithin600: null,
      nearestSquadmates: [],
    }));
  });
});
