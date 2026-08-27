import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/Styles/GrandLanding.css", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

describe("grand landing motion styles", () => {
  it("keeps the desktop signal field animated as a phased cascade", () => {
    expect(css).toContain("animation: signalFracture 3.6s");
    expect(css).toContain("animation-delay: calc(var(--signal-phase) * -74ms)");
    expect(css).toContain("@keyframes signalFracture");
    expect(css).toContain("transform: scaleY(0.34)");
    expect(css).not.toContain("scale: 1 0.38");
    expect(app).toContain('"--signal-phase": index');
    expect(app).not.toContain("animationDelay:");
  });

  it("preserves the cascade phase when reduced motion is reported", () => {
    expect(css).toContain("animation: signalFractureReduced 5.2s");
    expect(css).toContain("animation-delay: calc(var(--signal-phase) * -108ms) !important");
    expect(css).toContain("animation: signalSweepReduced 10s");
    expect(css).toContain("@keyframes signalFractureReduced");
    expect(css).toContain("animation-iteration-count: infinite !important");
  });

  it("starts the cinematic copy after the landing has painted", () => {
    expect(app).toContain("window.requestAnimationFrame");
    expect(app).toContain('landingReady ? " is-ready" : ""');
    expect(css).toContain(".theme-cinematic-landing.is-ready .theme-cinematic-mark");
    expect(css).toContain(".theme-cinematic-landing.is-ready .theme-cinematic-letter");
    expect(css).toContain(".theme-cinematic-landing.is-ready .theme-cinematic-declaration");
    expect(css).toContain("animation: logoReducedMarkResolve 900ms");
  });
});
