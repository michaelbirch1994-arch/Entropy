import { describe, expect, it } from "vitest";
import type { EngagementSegment } from "../engagementTypes";
import { buildCombatEpisodes } from "../combatEpisodes";
import type { CriticalEvent } from "../types";

function event(id: string, overrides: Partial<CriticalEvent> = {}): CriticalEvent {
  return {
    id,
    fightId: "fight-1",
    timestampMs: 10_000,
    category: "positioning",
    kind: "squad-separation",
    summary: id,
    relatedEvents: [`raw:${id}`],
    relatedPlayers: [],
    confidence: "high",
    ...overrides,
  };
}

function segment(eventIds: string[], overrides: Partial<EngagementSegment> = {}): EngagementSegment {
  return {
    id: "segment-1",
    fightId: "fight-1",
    index: 0,
    start: { timestampMs: 8_000, reason: "critical-event-cluster", evidence: [] },
    end: { timestampMs: 20_000, reason: "critical-event-cluster", evidence: [] },
    durationMs: 12_000,
    state: "active",
    confidence: "high",
    criticalEventIds: eventIds,
    combatEventIds: [],
    participantKeys: [],
    downs: 0,
    deaths: 0,
    evidence: [],
    ...overrides,
  };
}

describe("buildCombatEpisodes", () => {
  it("uses persisted segment membership without inventing causality", () => {
    const events = [
      event("a", { timestampMs: 10_000 }),
      event("b", { timestampMs: 18_000, kind: "failed-recovery", category: "defense", confidence: "medium" }),
    ];

    const episodes = buildCombatEpisodes(events, [segment(["a", "b"])]);

    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      basis: "persisted-segment",
      eventIds: ["a", "b"],
      startTimestampMs: 10_000,
      endTimestampMs: 18_000,
      confidence: "medium",
    });
  });

  it("groups unsegmented events only when explicit evidence overlaps inside the window", () => {
    const events = [
      event("a", { relatedPlayers: ["Player.1234"], timestampMs: 10_000 }),
      event("b", { relatedPlayers: ["Player.1234"], timestampMs: 16_000 }),
      event("c", { relatedPlayers: ["Other.5678"], timestampMs: 17_000 }),
    ];

    const episodes = buildCombatEpisodes(events, []);

    expect(episodes).toHaveLength(1);
    expect(episodes[0].basis).toBe("shared-evidence-window");
    expect(episodes[0].eventIds).toEqual(["a", "b"]);
  });

  it("does not group events across fights or by proximity alone", () => {
    const events = [
      event("a", { timestampMs: 10_000 }),
      event("b", { timestampMs: 10_500, relatedEvents: ["unrelated:b"] }),
      event("c", { fightId: "fight-2", timestampMs: 10_100, relatedEvents: ["raw:a"] }),
    ];

    expect(buildCombatEpisodes(events, [])).toEqual([]);
  });

  it("keeps output deterministic when input order changes", () => {
    const a = event("a", { relatedPlayers: ["Player.1234"], timestampMs: 10_000 });
    const b = event("b", { relatedPlayers: ["Player.1234"], timestampMs: 12_000 });

    expect(buildCombatEpisodes([b, a], [])).toEqual(buildCombatEpisodes([a, b], []));
  });
});
