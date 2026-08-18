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

  it("normalizes malformed counts without producing an invalid coverage value", () => {
    const sample = getSampleReliability(-2, 0);
    expect(sample.level).toBe("low");
    expect(sample.coverage).toBe(0);
  });
});
