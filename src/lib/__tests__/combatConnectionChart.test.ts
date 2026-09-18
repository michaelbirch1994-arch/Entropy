import { describe, expect, it } from "vitest";
import { buildCombatChartGeometry, nearestCombatChartPoint } from "../insight/combatConnectionChart";

describe("combat connection chart", () => {
  const points = [
    { time: 0, dps: null, peers: null },
    { time: 1_000, dps: 10, peers: 5 },
    { time: 2_000, dps: 20, peers: null },
    { time: 3_000, dps: null, peers: 15 },
    { time: 4_000, dps: 5, peers: 10 },
  ];

  it("preserves missing samples as visible breaks", () => {
    const geometry = buildCombatChartGeometry(points, 4_000, true);
    expect(geometry.maximum).toBe(20);
    expect(geometry.dpsPath).toContain("M250");
    expect(geometry.dpsPath).toContain("L500");
    expect(geometry.dpsPath).toContain("M1000");
    expect(geometry.peerPath.match(/M/g)).toHaveLength(2);
  });

  it("does not let a hidden comparison series change the player scale", () => {
    const geometry = buildCombatChartGeometry([
      { time: 0, dps: 10, peers: 1_000 },
      { time: 1_000, dps: 20, peers: 1_000 },
    ], 1_000, false);
    expect(geometry.maximum).toBe(20);
    expect(geometry.peerPath).toBe("");
  });

  it("selects the nearest recorded second and clamps outside the chart", () => {
    expect(nearestCombatChartPoint(points, 4_000, 0.51)?.time).toBe(2_000);
    expect(nearestCombatChartPoint(points, 4_000, -1)?.time).toBe(0);
    expect(nearestCombatChartPoint(points, 4_000, 2)?.time).toBe(4_000);
  });
});
