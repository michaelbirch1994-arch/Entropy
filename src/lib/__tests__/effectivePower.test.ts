import { describe, expect, it } from "vitest";
import { calculateEffectivePower, type EffectivePowerInput } from "../effectivePower/effectivePower";

const input = (overrides: Partial<EffectivePowerInput> = {}): EffectivePowerInput => ({
  power: 3000,
  precision: 2995,
  ferocity: 1050,
  gameMode: "wvw",
  furyUptimePercent: 0,
  mightStacks: 0,
  mightUptimePercent: 0,
  vulnerabilityStacks: 0,
  bonusCriticalChancePercent: 0,
  bonusCriticalDamagePercent: 0,
  strikeDamageModifierPercent: 0,
  ...overrides,
});

describe("effective power", () => {
  it("reproduces the handoff's 100% crit example", () => {
    const result = calculateEffectivePower(input());
    expect(result.averageCriticalChancePercent).toBeCloseTo(100);
    expect(result.criticalDamagePercent).toBeCloseTo(220);
    expect(result.effectivePower).toBeCloseTo(6600);
  });

  it("reproduces the handoff's partial crit example", () => {
    const result = calculateEffectivePower(input({ power: 3200, precision: 2575, ferocity: 1350 }));
    expect(result.averageCriticalChancePercent).toBeCloseTo(80);
    expect(result.criticalDamagePercent).toBeCloseTo(240);
    expect(result.effectivePower).toBeCloseTo(6784);
  });

  it("uses the WvW and PvE fury split", () => {
    const wvw = calculateEffectivePower(input({ precision: 1000, ferocity: 0, furyUptimePercent: 100, gameMode: "wvw" }));
    const pve = calculateEffectivePower(input({ precision: 1000, ferocity: 0, furyUptimePercent: 100, gameMode: "pve" }));
    expect(wvw.averageCriticalChancePercent).toBeCloseTo(25);
    expect(pve.averageCriticalChancePercent).toBeCloseTo(30);
  });

  it("weights Might uptime as distinct combat states", () => {
    const result = calculateEffectivePower(input({ power: 1000, precision: 1000, ferocity: 0, mightStacks: 25, mightUptimePercent: 50 }));
    expect(result.averagePower).toBeCloseTo(1375);
    expect(result.effectivePower).toBeCloseTo(1375 * 1.025);
  });

  it("makes Precision locally worthless when every state is crit capped", () => {
    const result = calculateEffectivePower(input({ precision: 4000, furyUptimePercent: 100 }));
    const precision = result.marginals.find(row => row.stat === "precision")!;
    expect(precision.gain).toBeCloseTo(0);
    expect(precision.relativeToPower).toBeCloseTo(0);
    expect(result.breakpoints.withFury.excessPrecision).toBeGreaterThan(0);
  });

  it("applies target vulnerability and the build modifier after normalized EP", () => {
    const result = calculateEffectivePower(input({ vulnerabilityStacks: 25, strikeDamageModifierPercent: 10 }));
    expect(result.adjustedEffectivePower).toBeCloseTo(result.effectivePower * 1.25 * 1.1);
  });
});
