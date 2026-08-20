import { describe, expect, it } from "vitest";
import type { ReplayData, ReplayPlayerTrack } from "../parseReplayData";
import { buildReplayPreEventChanges } from "../replayPreEventChanges";
import type { ReplayIntelligenceAnchor } from "../replayIntelligenceAnchors";

function track(account: string, xBefore: number, xAt: number, options: Partial<ReplayPlayerTrack> = {}): ReplayPlayerTrack {
  const points = Array.from({ length: 21 }, (_, index) => ({ t: index * 1_000, x: index < 10 ? xBefore : xAt, y: 0 }));
  return { account, name: account, profession: "Guardian", inSquad: true, isCommander: false, points, downIntervals: [], deadIntervals: [], facings: [], effects: [], casts: [], ...options };
}

function anchor(accounts: string[], timestampMs = 10_000): ReplayIntelligenceAnchor {
  return { id: "event-1", fightId: "fight-1", fightIndex: 0, fightName: "Fight 1", timestampMs, kind: "mass-down", category: "defense", summary: "event", confidence: "high", accounts };
}

function replay(players: ReplayPlayerTrack[]): ReplayData {
  return {
    durationMs: 20_000,
    bounds: { minX: 0, maxX: 1200, minY: 0, maxY: 100 },
    players,
    enemies: [
      { id: "enemy-1", name: "Enemy 1", points: Array.from({ length: 21 }, (_, i) => ({ t: i * 1_000, x: i < 10 ? 1000 : 300, y: 0 })), downIntervals: [], deadIntervals: [], facings: [] },
      { id: "enemy-2", name: "Enemy 2", points: Array.from({ length: 21 }, (_, i) => ({ t: i * 1_000, x: i < 10 ? 1000 : 320, y: 0 })), downIntervals: [], deadIntervals: [], facings: [] },
    ],
    map: null,
    worldSpace: { mapId: null, wvwMapData: null },
    mechanics: [],
    skillMeta: {},
  };
}

describe("buildReplayPreEventChanges", () => {
  it("compares exact event state to the fixed 5 second lookback", () => {
    const commander = track("Commander.1", 0, 0, { isCommander: true });
    const first = track("Player.2", 150, 700, { effects: [{ id: 1122, name: "Stability", classification: "Boon", states: [[0, 1], [9_000, 0]] }], downIntervals: [[9_800, 12_000]] });
    const second = track("Player.3", 180, 720, { effects: [{ id: 1122, name: "Stability", classification: "Boon", states: [[0, 1], [9_500, 0]] }] });
    const nearby = track("Ally.4", 160, 1000);
    const result = buildReplayPreEventChanges(replay([commander, first, second, nearby]), anchor(["Player.2", "Player.3"]));
    expect(result?.beforeTimestampMs).toBe(5_000);
    const byKey = new Map(result?.metrics.map((metric) => [metric.key, metric]));
    expect(byKey.get("downOrDead")).toEqual(expect.objectContaining({ before: 0, atEvent: 1, delta: 1 }));
    expect(byKey.get("beyond600FromTag")).toEqual(expect.objectContaining({ before: 0, atEvent: 2, delta: 2 }));
    expect(byKey.get("stability")).toEqual(expect.objectContaining({ before: 2, atEvent: 0, delta: -2 }));
    expect(byKey.get("nearbySquad240")?.delta).toBeLessThan(0);
    expect(byKey.get("nearbyEnemies600")?.delta).toBeGreaterThan(0);
  });

  it("omits metrics whose position/effect coverage is unavailable at either endpoint", () => {
    const commander = track("Commander.1", 0, 0, { isCommander: true, points: [{ t: 10_000, x: 0, y: 0 }] });
    const player = track("Player.2", 200, 200, { points: [{ t: 10_000, x: 200, y: 0 }], effects: [] });
    const result = buildReplayPreEventChanges(replay([commander, player]), anchor(["Player.2"]));
    expect(result?.metrics.map((metric) => metric.key)).toEqual(["downOrDead"]);
  });

  it("clamps the lookback to fight start and rejects invalid input", () => {
    const player = track("Player.2", 100, 100);
    expect(buildReplayPreEventChanges(replay([player]), anchor(["Player.2"], 2_000))?.beforeTimestampMs).toBe(0);
    expect(buildReplayPreEventChanges(replay([player]), null)).toBeNull();
    expect(buildReplayPreEventChanges(replay([player]), anchor(["Player.2"]), -1)).toBeNull();
  });
});
