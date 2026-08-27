import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/Styles/GrandLanding.css", "utf8");

describe("grand landing motion styles", () => {
  it("keeps the desktop signal field animated with transform-compatible keyframes", () => {
    expect(css).toContain("animation: signalFracture 3.6s");
    expect(css).toContain("@keyframes signalFracture");
    expect(css).toContain("transform: scaleY(0.38)");
    expect(css).not.toContain("scale: 1 0.38");
  });

  it("keeps a calm signal animation when reduced motion is reported", () => {
    expect(css).toContain("animation: signalFractureReduced 5.2s");
    expect(css).toContain("animation: signalSweepReduced 10s");
    expect(css).toContain("@keyframes signalFractureReduced");
    expect(css).toContain("animation-iteration-count: infinite !important");
  });
});
