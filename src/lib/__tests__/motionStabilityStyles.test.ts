import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const globalCss = readFileSync(resolve(root, "src/Styles/Global.css"), "utf8");
const motionCss = readFileSync(resolve(root, "src/Styles/MotionPolish.css"), "utf8");
const sidebar = readFileSync(resolve(root, "src/components/layout/Sidebar.tsx"), "utf8");

describe("layout-stable report motion", () => {
  it("uses one opacity-only report view entrance", () => {
    expect(globalCss).toMatch(/@keyframes entropyViewFade\s*{[\s\S]*?opacity: 0;[\s\S]*?opacity: 1;[\s\S]*?}/);
    expect(motionCss).not.toContain("entropyWaveIn");
    expect(motionCss).not.toMatch(/\.animate-view\s*>\s*\*/);
  });

  it("does not continuously resize the chart workspace when the sidebar toggles", () => {
    expect(sidebar).not.toContain("transition-[width]");
  });
});
