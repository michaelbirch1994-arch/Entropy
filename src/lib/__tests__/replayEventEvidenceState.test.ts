import { describe, expect, it } from "vitest";
import type { ReplayData, ReplayPlayerTrack } from "../parseReplayData";
import { buildReplayEventEvidenceState } from "../replayEventEvidenceState";
import type { ReplayIntelligenceAnchor } from "../replayIntelligenceAnchors";

function player(
  account: string,
  x: number,
  options: Partial<ReplayPlayerTrack> = {},
): ReplayPlayerTrack {
  return {
    account,
    name: account,
    profession: "Guardian",
    inSquad: true,
    isCommander: false,
    points: [
      { t: 0, x, y: 0 },
      { t: 20_000, x, y: 0 },
    ],
    downIntervals: [],
    deadIntervals: [],
    facings: [],
    effects: [],
    casts: [],
    ...options,
  };
}

function anchor(accounts: string[]): ReplayIntelligenceAnchor {
  return {
    id: "event-1",
    fightId: "fight-1",
    fightIndex: 0,
    fightName: "Fight 1",
    timestampMs: 10_000,
    kind: "mass-down",
    category: "defense",
    summary: "Multiple squad members went down together.",
    confidence: "high",
    accounts,
  };
}

function data(players: ReplayPlayerTrack[]): ReplayData {
  return {
    durationMs: 20_000,
    bounds: { minX: 0, maxX: 1200, minY: 0, maxY: 100 },
    players,
    enemies: [],
    map: null,
    mechanics: [],
    skillMeta: {},
  };
}

describe("buildReplayEventEvidenceState", () => {
  it("summarizes only proven event participants at the exact timestamp", () => {
    const commander = player("Commander.1", 0, { isCommander: true });
    const stable = player("Stable.2", 200, {
      effects: [{ id: 1122, name: "Stability", classification: "Boon", states: [[0, 1], [12_000, 0]] }],
    });
    const down = player("Down.3", 350, { downIntervals: [[9_000, 11_000]] });
    const farDead = player("Dead.4", 900, { deadIntervals: [[9_500, 20_000]] });

    const result = buildReplayEventEvidenceState(
      data([commander, stable, down, farDead]),
      anchor(["Stable.2", "Down.3", "Dead.4", "Missing.5"]),
      10_000,
    );

    expect(result).toEqual(expect.objectContaining({
      trackedParticipants: 3,
      activeParticipants: 1,
      downedParticipants: 1,
      deadParticipants: 1,
      untrackedParticipants: 0,
      beyond600FromTag: 1,
      stabilityPresent: 1,
      stabilityKnownFor: 1,
    }));
  });

  it("keeps unavailable position/effect evidence unknown instead of treating it as a negative", () => {
    const commander = player("Commander.1", 0, { isCommander: true });
    const untracked = player("Player.2", 200, {
      points: [{ t: 12_000, x: 200, y: 0 }],
      effects: [],
    });

    const result = buildReplayEventEvidenceState(data([commander, untracked]), anchor(["Player.2"]), 10_000);

    expect(result).toEqual(expect.objectContaining({
      trackedParticipants: 1,
      untrackedParticipants: 1,
      stabilityKnownFor: 0,
      stabilityPresent: 0,
      beyond600FromTag: 0,
    }));
  });

  it("rejects absent events and invalid timestamps", () => {
    expect(buildReplayEventEvidenceState(data([]), null, 10_000)).toBeNull();
    expect(buildReplayEventEvidenceState(data([]), anchor([]), Number.NaN)).toBeNull();
  });
});
