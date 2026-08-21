import { describe, expect, it } from "vitest";
import type { ViewNavigationTarget } from "../../../store/ViewContext";
import type { FightRow } from "../../../types/report";
import { resolveIntelligenceNavigationTarget } from "../intelligenceNavigation";
import type { CriticalEvent } from "../types";

function fight(overrides: Partial<FightRow> = {}): FightRow {
  return {
    id: "fight-a",
    label: "F1",
    fullLabel: "Detailed WvW - Alpine Borderlands",
    permalink: "https://example.test/fight-a",
    timestamp: 1,
    mapName: "Alpine Borderlands",
    duration: "1m 00s",
    isWin: false,
    squadCount: 10,
    allyCount: 10,
    enemyCount: 15,
    teamBreakdown: [],
    alliesDown: 1,
    alliesDead: 1,
    alliesRevived: 0,
    rallies: 0,
    enemyDeaths: 2,
    enemyDowns: 3,
    totalOutgoingDamage: 100,
    totalIncomingDamage: 200,
    totalOutgoingStrips: 0,
    totalIncomingStrips: 0,
    totalBoonsApplied: 0,
    incomingBarrierAbsorbed: 0,
    outgoingBarrierAbsorbed: 0,
    squadClassCountsFight: {},
    ...overrides,
  };
}

function event(overrides: Partial<CriticalEvent> = {}): CriticalEvent {
  return {
    id: "event-a",
    timestampMs: 10_000,
    fightId: "fight-a",
    category: "positioning",
    kind: "squad-separation",
    summary: "Persisted separation evidence.",
    relatedEvents: [],
    relatedPlayers: ["Player.1234"],
    confidence: "high",
    ...overrides,
  };
}

function target(overrides: Partial<ViewNavigationTarget> = {}): ViewNavigationTarget {
  return {
    source: "other",
    targetView: "intelligence",
    fightId: "fight-a",
    timestampMs: 12_000,
    ...overrides,
  };
}

describe("resolveIntelligenceNavigationTarget", () => {
  it("uses an explicitly persisted event as the authoritative timestamp", () => {
    const result = resolveIntelligenceNavigationTarget(
      [fight()],
      [event({ timestampMs: 8_500 })],
      target({ eventId: "event-a", timestampMs: 30_000 }),
    );

    expect(result).toMatchObject({
      fightId: "fight-a",
      fightIndex: 0,
      timestampMs: 8_500,
      matchedEventId: "event-a",
      matchedEventOffsetMs: 0,
    });
  });

  it.each([
    "fight-a",
    "F1",
    "Detailed WvW - Alpine Borderlands",
    "https://example.test/fight-a",
    "fight-1",
    "Alpine Borderlands-0",
    "Detailed WvW - Alpine Borderlands-0",
  ])("resolves the stable fight alias %s", (fightId) => {
    expect(resolveIntelligenceNavigationTarget(
      [fight()],
      [event()],
      target({ fightId }),
    )?.fightId).toBe("fight-a");
  });

  it("prefers nearby evidence linked to the requested player", () => {
    const result = resolveIntelligenceNavigationTarget(
      [fight()],
      [
        event({ id: "closer-other", timestampMs: 11_900, relatedPlayers: ["Other.9999"] }),
        event({ id: "player-linked", timestampMs: 17_000, relatedPlayers: ["Player.1234"] }),
      ],
      target({ account: "Player.1234" }),
    );

    expect(result).toMatchObject({
      timestampMs: 12_000,
      matchedEventId: "player-linked",
      matchedEventOffsetMs: 5_000,
    });
  });

  it("matches persisted evidence through stable fight aliases and normalized player identity", () => {
    const result = resolveIntelligenceNavigationTarget(
      [fight()],
      [event({
        id: "aliased-player-event",
        fightId: "fight-1",
        timestampMs: 17_000,
        relatedPlayers: ["player.1234"],
      })],
      target({ account: "Player.1234" }),
    );

    expect(result?.matchedEventId).toBe("aliased-player-event");
    expect(result?.matchedEventOffsetMs).toBe(5_000);
  });

  it("falls back to the nearest persisted event when none is player-linked", () => {
    const result = resolveIntelligenceNavigationTarget(
      [fight()],
      [
        event({ id: "later", timestampMs: 16_000, relatedPlayers: [] }),
        event({ id: "nearest", timestampMs: 11_000, relatedPlayers: [] }),
      ],
      target({ account: "Player.1234" }),
    );

    expect(result?.matchedEventId).toBe("nearest");
    expect(result?.matchedEventOffsetMs).toBe(1_000);
  });

  it("preserves the exact source moment when no persisted event is nearby", () => {
    const result = resolveIntelligenceNavigationTarget(
      [fight()],
      [event({ timestampMs: 40_000 })],
      target({ timestampMs: 12_000, account: "Player.1234" }),
    );

    expect(result).toMatchObject({
      fightId: "fight-a",
      timestampMs: 12_000,
      account: "Player.1234",
    });
    expect(result?.matchedEventId).toBeUndefined();
    expect(result?.matchedEventOffsetMs).toBeUndefined();
  });

  it("uses a legacy fight index only when no stable fight id was supplied", () => {
    const fights = [fight(), fight({ id: "fight-b", label: "F2" })];
    expect(resolveIntelligenceNavigationTarget(
      fights,
      [],
      target({ fightId: undefined, fightIndex: 1 }),
    )?.fightId).toBe("fight-b");

    expect(resolveIntelligenceNavigationTarget(
      fights,
      [],
      target({ fightId: "missing", fightIndex: 1 }),
    )).toBeNull();
  });

  it("rejects unrelated destinations and targets without timestamps", () => {
    expect(resolveIntelligenceNavigationTarget(
      [fight()],
      [event()],
      target({ targetView: "fight-replay" }),
    )).toBeNull();
    expect(resolveIntelligenceNavigationTarget(
      [fight()],
      [event()],
      target({ timestampMs: undefined }),
    )).toBeNull();
  });
});
