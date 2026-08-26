import { describe, expect, it } from "vitest";
import { getPlayerConditionDamage, getPlayerPowerDamage } from "../bridge-metrics/dashboardMetrics";

describe("dashboard damage splits", () => {
  it("sums condition and power damage across player targets", () => {
    const player = {
      dpsAll: [{ condiDamage: 9000, powerDamage: 12000 }],
      dpsTargets: [
        [{ condiDamage: 1200, powerDamage: 3000 }],
        [{ condiDamage: 800, powerDamage: 2000 }],
      ],
    } as any;

    expect(getPlayerConditionDamage(player)).toBe(2000);
    expect(getPlayerPowerDamage(player)).toBe(5000);
  });

  it("uses the all-target split when legacy target rows omit those fields", () => {
    const player = {
      dpsAll: [{ condiDamage: 2500, powerDamage: 7500 }],
      dpsTargets: [[{ damage: 10000 }]],
    } as any;

    expect(getPlayerConditionDamage(player)).toBe(2500);
    expect(getPlayerPowerDamage(player)).toBe(7500);
  });
});
