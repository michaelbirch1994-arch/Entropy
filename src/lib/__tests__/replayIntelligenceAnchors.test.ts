import { describe, expect, it } from "vitest";
import type { IntelligenceDashboard } from "../intelligence/intelligenceDashboard";
import type { ReplayFightEntry } from "../../types/report";
import { buildReplayIntelligenceAnchors } from "../replayIntelligenceAnchors";

const replayFights = [
  {
    fightId: "fight-a",
    fightName: "Fight A",
    data: {
      durationMs: 10_000,
      players: [
        { account: "Alpha.1111", name: "Alpha Character" },
        { account: "Bravo.2222", name: "Bravo Character" },
      ],
    },
  },
  {
    fightId: "fight-b",
    fightName: "Fight B",
    data: {
      durationMs: 20_000,
      players: [
        { account: "Player.1234", name: "Tracked Character" },
      ],
    },
  },
] as unknown as ReplayFightEntry[];

function dashboard(): IntelligenceDashboard {
  return {
    persisted: true,
    readiness: "review",
    headline: "Reviewable pressure patterns detected.",
    summary: "summary",
    segments: [],
    findings: [],
    engagements: [],
    timeline: [],
    actions: [],
    severityCounts: { info: 0, notable: 0, significant: 0, critical: 0 },
    categoryCounts: {},
    totals: { downs: 0, deaths: 0, segments: 0, criticalEvents: 3, findings: 0 },
    coverage: { replay: true, mechanics: false, deathRecaps: true, survivalSupport: false, fightRows: true },
    criticalEvents: [
      {
        id: "event-b",
        fightId: "fight-b",
        timestampMs: 4_000,
        kind: "failed-recovery",
        category: "defense",
        summary: "Recovery failed.",
        relatedEvents: [],
        relatedPlayers: ["Player.1234"],
        confidence: "high",
      },
      {
        id: "event-a",
        fightId: "fight-a",
        timestampMs: 7_000,
        kind: "mass-down",
        category: "coordination",
        summary: "Several players went down together.",
        relatedEvents: [],
        confidence: "medium",
      },
      {
        id: "no-replay",
        fightId: "fight-c",
        timestampMs: 2_000,
        kind: "death-recap",
        category: "defense",
        summary: "No replay for this fight.",
        relatedEvents: [],
        confidence: "high",
      },
    ],
  };
}

describe("buildReplayIntelligenceAnchors", () => {
  it("maps only critical events that have exact replay fight coverage", () => {
    expect(buildReplayIntelligenceAnchors(dashboard(), replayFights)).toEqual([
      expect.objectContaining({ id: "event-a", fightIndex: 0, fightName: "Fight A", timestampMs: 7_000, accounts: [] }),
      expect.objectContaining({ id: "event-b", fightIndex: 1, fightName: "Fight B", timestampMs: 4_000, account: "Player.1234", accounts: ["Player.1234"] }),
    ]);
  });

  it("resolves a related character name to the tracked replay account for tactical-state auto-selection", () => {
    const input = dashboard();
    input.criticalEvents.push({
      id: "character-name-event",
      fightId: "fight-a",
      timestampMs: 5_000,
      kind: "separation",
      category: "positioning",
      summary: "Alpha separated from tag.",
      relatedEvents: [],
      relatedPlayers: ["Alpha Character"],
      confidence: "high",
    });

    const anchor = buildReplayIntelligenceAnchors(input, replayFights).find((item) => item.id === "character-name-event");
    expect(anchor?.account).toBe("Alpha.1111");
    expect(anchor?.accounts).toEqual(["Alpha.1111"]);
  });

  it("preserves every unique related player that is actually tracked in the replay fight", () => {
    const input = dashboard();
    input.criticalEvents.push({
      id: "multi-player-event",
      fightId: "fight-a",
      timestampMs: 6_000,
      kind: "mass-down",
      category: "coordination",
      summary: "Multiple tracked players were involved.",
      relatedEvents: [],
      relatedPlayers: ["Alpha Character", "Bravo.2222", "Alpha.1111", "Missing Character"],
      confidence: "high",
    });

    const anchor = buildReplayIntelligenceAnchors(input, replayFights).find((item) => item.id === "multi-player-event");
    expect(anchor?.account).toBe("Alpha.1111");
    expect(anchor?.accounts).toEqual(["Alpha.1111", "Bravo.2222"]);
  });

  it("does not invent a tactical-state player when the related identity is not tracked in replay", () => {
    const input = dashboard();
    input.criticalEvents.push({
      id: "untracked-player-event",
      fightId: "fight-a",
      timestampMs: 5_500,
      kind: "separation",
      category: "positioning",
      summary: "Untracked player event.",
      relatedEvents: [],
      relatedPlayers: ["Missing Character"],
      confidence: "high",
    });

    const anchor = buildReplayIntelligenceAnchors(input, replayFights).find((item) => item.id === "untracked-player-event");
    expect(anchor?.account).toBeUndefined();
    expect(anchor?.accounts).toEqual([]);
  });

  it("rejects timestamps outside the replay bounds instead of inventing a seek point", () => {
    const input = dashboard();
    input.criticalEvents.push({
      id: "outside",
      fightId: "fight-a",
      timestampMs: 11_000,
      kind: "mass-down",
      category: "coordination",
      summary: "Outside replay bounds.",
      relatedEvents: [],
      confidence: "high",
    });

    expect(buildReplayIntelligenceAnchors(input, replayFights).some((anchor) => anchor.id === "outside")).toBe(false);
  });

  it("returns an empty list when dashboard or replay data is unavailable", () => {
    expect(buildReplayIntelligenceAnchors(null, replayFights)).toEqual([]);
    expect(buildReplayIntelligenceAnchors(dashboard(), [])).toEqual([]);
  });
});
