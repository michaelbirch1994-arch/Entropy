import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/Styles/BuilderVisualFoundation.css", "utf8");
const view = readFileSync("src/views/AxiForgeLabView.tsx", "utf8");

describe("builder viewer theme styles", () => {
  it("scopes the black-gold palette to the portaled viewer", () => {
    expect(css).toMatch(/\.theme-builder-root,\r?\n\.theme-builder-viewer \{/);
    expect(css).toContain(".theme-builder-viewer .theme-builder-tactical-card.is-primary");
    expect(css).toContain(".theme-builder-viewer .theme-builder-preview-equipment-heading");
    expect(css).toContain(".theme-builder-viewer .theme-builder-inspector");
    expect(css).toContain(".theme-builder-viewer .theme-builder-link:hover");
  });

  it("keeps the compact Builder shell and narrow section strip", () => {
    expect(css).toContain(".theme-builder-catalog-state");
    expect(css).toMatch(/@container \(max-width: 42rem\)[\s\S]*?\.theme-builder-mode-toggle \{[\s\S]*?overflow-x: auto;/);
    expect(css).toMatch(/\.theme-builder-command-deck \{[\s\S]*?min-height: 3\.65rem;/);
  });

  it("presents Overview as one loadout canvas with a compact role menu", () => {
    expect(view).toContain('theme-builder-loadout-canvas theme-builder-overview-canvas');
    expect(view).toContain('<select className="theme-builder-input" aria-label="Build role"');
    expect(css).toContain(".theme-builder-overview-canvas .theme-builder-professions");
  });

  it("uses one icon-led picker surface for each editable utility slot", () => {
    expect(view).toContain('emptyIcon={<Plus className="h-4 w-4" aria-hidden="true" />}');
    expect(view).not.toContain('className="theme-builder-skill-icon"');
    expect(css).toMatch(/\.theme-builder-loadout-canvas \.theme-builder-skill-slot \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
  });

  it("uses one equipment identity header and keeps the active set explicit", () => {
    expect(view).toContain('theme-builder-loadout-canvas theme-builder-equipment-workspace');
    expect(view).toContain('Equipment loadout · {builder.gameMode.toUpperCase()}');
    expect(view).not.toContain('className="theme-builder-equipment-board-head"');
    expect(view).toContain('builder.activeWeaponSet === set && <> <b>Active</b></>');
    expect(css).toMatch(/\.theme-builder-equipment-workspace \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  });

  it("keeps equipment summaries aligned with their editor sections", () => {
    expect(view).toMatch(/section === "upgrades"[\s\S]*?Armor runes[\s\S]*?Weapon sigils[\s\S]*?<\/section>/);
    expect(view).toMatch(/section === "consumables"[\s\S]*?<small>Relic<\/small>[\s\S]*?<small>Food<\/small>/);
  });

  it("keeps trinket artwork compact in the embedded preview and expanded viewer", () => {
    expect(css).toMatch(/\.theme-builder-preview-trinket-card > img,[\s\S]*?width: 2\.2rem;[\s\S]*?height: 2\.2rem;/);
    expect(css).not.toContain(".theme-builder-viewer .theme-builder-preview-trinket-card > img");
  });
});
