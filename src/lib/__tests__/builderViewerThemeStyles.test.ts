import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/Styles/BuilderVisualFoundation.css", "utf8");

describe("builder viewer theme styles", () => {
  it("scopes the black-gold palette to the portaled viewer", () => {
    expect(css).toMatch(/\.theme-builder-root,\r?\n\.theme-builder-viewer \{/);
    expect(css).toContain(".theme-builder-viewer .theme-builder-tactical-card.is-primary");
    expect(css).toContain(".theme-builder-viewer .theme-builder-preview-equipment-heading");
    expect(css).toContain(".theme-builder-viewer .theme-builder-inspector");
    expect(css).toContain(".theme-builder-viewer .theme-builder-link:hover");
  });
});
