import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/Styles/UXPolish.css", "utf8");
const view = readFileSync("src/views/TopPlayersView.tsx", "utf8");

describe("top player detail motion styles", () => {
  it("keeps spacing inside the animated height region", () => {
    expect(css).toMatch(/\.theme-player-card-row-group \{\r?\n  gap: 0;/);
    expect(css).toMatch(/\.theme-player-source-details-spacer \{\r?\n  height: 1rem;/);
    expect(view).toContain('className="theme-player-source-details-spacer"');
  });
});
