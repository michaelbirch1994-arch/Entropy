import { describe, expect, it } from "vitest";
import { hasNonPlayerObjectiveDamage, nonPlayerObjectiveDamage } from "../offenseColumns";

describe("offense column visibility", () => {
  it("hides non-player objective damage when EI only provides player damage", () => {
    const rows = [
      { offenseTotals: { damage: 1000 } },
      { offenseTotals: { damage: 500 } },
    ];

    expect(hasNonPlayerObjectiveDamage(rows)).toBe(false);
    expect(nonPlayerObjectiveDamage(rows[0])).toBe(0);
  });

  it("hides non-player objective damage when all damage matches player damage", () => {
    const rows = [
      { offenseTotals: { damage: 1000, damageAll: 1000 } },
      { offenseTotals: { damage: 500, damageAll: 500 } },
    ];

    expect(hasNonPlayerObjectiveDamage(rows)).toBe(false);
    expect(nonPlayerObjectiveDamage(rows[0])).toBe(0);
  });

  it("shows non-player objective damage when all damage exceeds player damage", () => {
    const rows = [
      { offenseTotals: { damage: 1000, damageAll: 1250 } },
      { offenseTotals: { damage: 500, damageAll: 500 } },
    ];

    expect(hasNonPlayerObjectiveDamage(rows)).toBe(true);
    expect(nonPlayerObjectiveDamage(rows[0])).toBe(250);
  });

  it("never reports negative objective damage if sparse exports disagree", () => {
    const row = { offenseTotals: { damage: 1000, damageAll: 900 } };

    expect(hasNonPlayerObjectiveDamage([row])).toBe(false);
    expect(nonPlayerObjectiveDamage(row)).toBe(0);
  });
});

