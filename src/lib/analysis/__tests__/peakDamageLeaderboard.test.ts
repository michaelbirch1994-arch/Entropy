import { describe, expect, it } from "vitest";
import type { DpsGraphFight, DpsGraphPlayerSeries } from "../../../types/report";
import { buildPeakDamageLeaderboard } from "../peakDamageLeaderboard";

const player = (account: string, points: number[], profession = "Soulbeast"): DpsGraphPlayerSeries =>
  ({ account, points, profession });
const fight = (fightId: string, players: DpsGraphPlayerSeries[]): DpsGraphFight =>
  ({ fightId, fightName: "Same map", durationMs: 2000, squad: [], players });

describe("buildPeakDamageLeaderboard", () => {
  it("handles absent and empty legacy graph data", () => {
    expect(buildPeakDamageLeaderboard()).toEqual([]);
    expect(buildPeakDamageLeaderboard({ fights: [] })).toEqual([]);
  });

  it("uses the best fight, not summed peaks, and keeps its profession and window", () => {
    const rows = buildPeakDamageLeaderboard({ fights: [
      fight("one", [player("A.1234", [0, 100, 110])]),
      fight("two", [player("A.1234", [0, 10, 210], "Reaper")]),
      fight("three", [player("A.1234", [0, 10, 20], "Druid")]),
    ] });
    expect(rows).toEqual([{
      account: "A.1234", profession: "Reaper", damage: 200, fight: "Fight 2: Same map",
      startMs: 1000, endMs: 2000, fights: 3, rank: 1,
    }]);
  });

  it("deduplicates a repeated fight and repeated account within a fight", () => {
    const original = fight("one", [player("A.1234", [0, 10, 30]), player("A.1234", [0, 10, 30])]);
    expect(buildPeakDamageLeaderboard({ fights: [original, original] }))
      .toMatchObject([{ account: "A.1234", fights: 1, damage: 20 }]);
  });

  it("shares ranks for ties and orders tied accounts consistently", () => {
    const rows = buildPeakDamageLeaderboard({ fights: [fight("one", [
      player("B.1234", [0, 100, 100]), player("C.1234", [0, 50, 50]), player("A.1234", [0, 100, 100]),
    ])] });
    expect(rows.map(r => [r.account, r.rank])).toEqual([["A.1234", 1], ["B.1234", 1], ["C.1234", 3]]);
  });

  it("keeps the first report-order fight when a player's peak ties", () => {
    const rows = buildPeakDamageLeaderboard({ fights: [
      fight("one", [player("A.1234", [0, 100, 110])]),
      fight("two", [player("A.1234", [0, 10, 110], "Reaper")]),
    ] });
    expect(rows[0]).toMatchObject({ profession: "Soulbeast", fight: "Fight 1: Same map", fights: 2, startMs: 0 });
  });

  it("excludes invalid series from coverage but retains real zero damage", () => {
    const rows = buildPeakDamageLeaderboard({ fights: [
      fight("one", [player("A.1234", [0, 100, 50]), player("B.1234", [0, 0, 0])]),
      fight("two", [player("A.1234", [0, 10, 20])]),
    ] });
    expect(rows.map(r => [r.account, r.damage, r.fights])).toEqual([["A.1234", 10, 1], ["B.1234", 0, 1]]);
  });

  it("never mutates source report data or truncates the full ranking to the card limit", () => {
    const data = { fights: [fight("one", Array.from({ length: 12 }, (_, i) => player(`P${i}.1234`, [0, i, i]))) ] };
    const before = JSON.stringify(data);
    const first = buildPeakDamageLeaderboard(data);
    first[0].damage = -1;
    expect(buildPeakDamageLeaderboard(data)).toHaveLength(12);
    expect(buildPeakDamageLeaderboard(data)[0].damage).toBe(11);
    expect(JSON.stringify(data)).toBe(before);
  });
});
