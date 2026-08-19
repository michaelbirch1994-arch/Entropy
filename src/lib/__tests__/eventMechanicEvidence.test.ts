import { describe, expect, it } from "vitest";
import type { ReplayFightEntry } from "../../types/report";
import type { IntelligenceEventWindow } from "../intelligence/eventInspection";
import { buildEventMechanicEvidence } from "../intelligence/eventMechanicEvidence";

function replayFight(fightId: string): ReplayFightEntry {
  return {
    fightId,
    fightName: fightId === "fight-a" ? "Fight A" : "Fight B",
    data: {
      durationMs: 30_000,
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
      players: [],
      enemies: [],
      map: null,
      skillMeta: {},
      mechanics: [
        { t: 8_000, name: "Early", severity: "Sev1", actor: "Alpha", account: "Alpha.1234" },
        { t: 10_000, name: "Anchor mechanic", severity: "Sev3", actor: "Bravo", account: "Bravo.1234" },
        { t: 12_500, name: "Nearby", severity: "Sev2", actor: "Charlie" },
        { t: 19_000, name: "Late", severity: "Sev4", actor: "Delta", account: "Delta.1234" },
      ],
    },
  };
}

const window: IntelligenceEventWindow = {
  anchorTimestampMs: 10_000,
  startTimestampMs: 8_000,
  endTimestampMs: 12_500,
  beforeMs: 2_000,
  afterMs: 2_500,
};

describe("buildEventMechanicEvidence", () => {
  it("returns only real replay mechanics inside the selected fight window", () => {
    const evidence = buildEventMechanicEvidence({
      replayFights: [replayFight("fight-a"), replayFight("fight-b")],
      fightId: "fight-a",
      window,
      relatedPlayerKeys: ["Bravo.1234"],
    });

    expect(evidence.map((item) => item.name)).toEqual(["Early", "Anchor mechanic", "Nearby"]);
    expect(evidence.map((item) => item.offsetMs)).toEqual([-2_000, 0, 2_500]);
    expect(evidence.map((item) => item.relation)).toEqual(["before", "anchor", "after"]);
    expect(evidence[1]).toEqual(expect.objectContaining({
      fightId: "fight-a",
      account: "Bravo.1234",
      linkedPlayer: true,
      severity: "Sev3",
      relation: "anchor",
    }));
  });

  it("does not treat temporal proximity as an Intelligence player link", () => {
    const evidence = buildEventMechanicEvidence({
      replayFights: [replayFight("fight-a")],
      fightId: "fight-a",
      window,
      relatedPlayerKeys: ["Unrelated.9999"],
    });

    expect(evidence.every((item) => item.linkedPlayer === false)).toBe(true);
  });

  it("returns no evidence when that fight has no replay record", () => {
    expect(buildEventMechanicEvidence({
      replayFights: [replayFight("fight-a")],
      fightId: "missing-fight",
      window,
    })).toEqual([]);
  });
});
