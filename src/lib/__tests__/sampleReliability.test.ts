import { describe, expect, it } from "vitest";
import { getSampleReliability } from "../sampleReliability";

describe("sample reliability", () => {
  it("flags isolated and low-coverage results as low sample", () => {
    expect(getSampleReliability(1, 12).level).toBe("low");
    expect(getSampleReliability(3, 20).level).toBe("low");
  });

  it("keeps developing samples distinct from broad session coverage", () => {
    expect(getSampleReliability(4, 6).level).toBe("moderate");
    expect(getSampleReliability(8, 20).level).toBe("moderate");
  });

  it("requires both enough fights and enough session coverage for a strong sample", () => {
    const sample = getSampleReliability(9, 12);
    expect(sample.level).toBe("strong");
    expect(sample.coverage).toBeCloseTo(0.75);
  });

  it("downgrades broad fight coverage when tracked combat time is very short", () => {
    const sample = getSampleReliability(9, 12, 120_000);
    expect(sample.level).toBe("low");
    expect(sample.label).toBe("Short sample");
    expect(sample.detail).toContain("rate metrics may be highly volatile");
  });

  it("keeps a short but usable duration sample in the developing tier", () => {
    const sample = getSampleReliability(9, 12, 8 * 60_000);
    expect(sample.level).toBe("moderate");
    expect(sample.detail).toContain("Active combat");
  });

  it("retains strong reliability when both coverage and tracked duration are broad", () => {
    expect(getSampleReliability(9, 12, 18 * 60_000).level).toBe("strong");
  });

  it("normalizes malformed counts without producing an invalid coverage value", () => {
    const sample = getSampleReliability(-2, 0);
    expect(sample.level).toBe("low");
    expect(sample.coverage).toBe(0);
  });
});
