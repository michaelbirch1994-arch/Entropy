import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/Styles/UXPolish.css", "utf8");
const view = readFileSync("src/views/TopPlayersView.tsx", "utf8");

describe("top player detail motion styles", () => {
  it("keeps spacing inside the animated height region", () => {
    expect(css).toMatch(/\.theme-player-card-row-group \{\r?\n  gap: 0;/);
    expect(css).toMatch(/\.theme-player-source-details-motion \{\r?\n  display: grid;/);
    expect(css).toContain(".theme-player-source-details-inner");
    expect(css).toMatch(/\.theme-player-source-details-spacer \{\r?\n  height: 1rem;/);
    expect(view).toContain('gridTemplateRows: reduceMotion || revealed ? "1fr" : "0fr"');
    expect(view).toContain('exit={{ gridTemplateRows: "0fr", opacity: 0 }}');
    expect(view).toContain("window.requestAnimationFrame");
    expect(view).toContain("window.setTimeout(() => setRevealed(true), 32)");
    expect(view).toContain('className="theme-player-source-details-inner"');
    expect(view).toContain('className="theme-player-source-details-spacer"');
  });
});
