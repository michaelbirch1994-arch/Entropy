import { describe, expect, it } from "vitest";
import type { IntelligenceDashboard } from "../intelligence/intelligenceDashboard";
import type { ReplayFightEntry } from "../../types/report";
import { buildReplayIntelligenceAnchors } from "../replayIntelligenceAnchors";

const replayFights = [
  {
    fightId: "fight-a",
    fightName: "Fight A",
    data: { durationMs: 10_000 },
  },
  {
    fightId: "fight-b",
    fightName: "Fight B",
    data: { durationMs: 20_000 },
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
      expect.objectContaining({ id: "event-a", fightIndex: 0, fightName: "Fight A", timestampMs: 7_000 }),
      expect.objectContaining({ id: "event-b", fightIndex: 1, fightName: "Fight B", timestampMs: 4_000, account: "Player.1234" }),
    ]);
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
