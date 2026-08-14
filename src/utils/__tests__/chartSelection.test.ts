import { describe, expect, it } from "vitest";
import { resolveChartSelectionIndex } from "../chartSelection";

const rows = [
  { index: 0, name: "#1", id: "fight-1" },
  { index: 1, name: "#2", id: "fight-2" },
  { index: 2, name: "#3", id: "fight-3" },
];

describe("resolveChartSelectionIndex", () => {
  it("supports the Recharts v3 activeIndex shape", () => {
    expect(resolveChartSelectionIndex({ activeIndex: "2" }, rows)).toBe(2);
  });

  it("supports numeric and string tooltip indexes", () => {
    expect(resolveChartSelectionIndex({ activeTooltipIndex: 1 }, rows)).toBe(1);
    expect(resolveChartSelectionIndex({ activeTooltipIndex: "1" }, rows)).toBe(1);
  });

  it("keeps compatibility with the older activePayload shape", () => {
    expect(resolveChartSelectionIndex({ activePayload: [{ payload: { index: 2 } }] }, rows)).toBe(2);
  });

  it("falls back to the active fight label", () => {
    expect(resolveChartSelectionIndex({ activeLabel: "#2" }, rows)).toBe(1);
  });

  it("rejects missing, fractional, and out-of-range indexes", () => {
    expect(resolveChartSelectionIndex({}, rows)).toBeNull();
    expect(resolveChartSelectionIndex({ activeIndex: "1.5" }, rows)).toBeNull();
    expect(resolveChartSelectionIndex({ activeIndex: 8 }, rows)).toBeNull();
  });
});
