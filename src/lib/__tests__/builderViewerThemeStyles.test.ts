import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/Styles/BuilderVisualFoundation.css", "utf8");
const view = readFileSync("src/views/AxiForgeLabView.tsx", "utf8");
const combatBar = readFileSync("src/components/builder/BuildCombatBar.tsx", "utf8");
const sidebar = readFileSync("src/components/layout/Sidebar.tsx", "utf8");

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
    expect(sidebar).toContain('activeView === "axiforge-lab"');
  });

  it("uses a compact Axiforge-style combat hierarchy", () => {
    expect(combatBar).toMatch(/is-utility[\s\S]*?theme-builder-mechanic-skills[\s\S]*?theme-builder-combat-label/);
    expect(css).toMatch(/\.theme-builder-combat-group\.is-utility \.theme-builder-mechanic-skills \{[\s\S]*?justify-content: flex-start;/);
    expect(view).toContain("<h4>Combat bar</h4>");
    expect(view).toContain("<h4>Specializations</h4>");
    expect(view).not.toContain("Specialization matrix");
  });

  it("presents Overview as one loadout canvas with a compact role menu", () => {
    expect(view).toContain('theme-builder-loadout-canvas theme-builder-overview-canvas');
    expect(view).toContain('<select className="theme-builder-input" aria-label="Build role"');
    expect(css).toContain(".theme-builder-overview-canvas .theme-builder-professions");
  });

  it("uses one icon-led picker surface for each editable utility slot", () => {
    expect(view).toContain('emptyIcon={<Plus className="h-4 w-4" aria-hidden="true" />}');
    expect(view).not.toContain('className="theme-builder-skill-icon"');
    expect(view).not.toContain('"Open searchable picker"');
    expect(css).toMatch(/\.theme-builder-loadout-canvas \.theme-builder-skill-slot \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
  });

  it("uses one equipment identity header and keeps the active set explicit", () => {
    expect(view).toContain('theme-builder-loadout-canvas theme-builder-equipment-workspace');
    expect(view).toContain('Equipment loadout · {builder.gameMode.toUpperCase()}');
    expect(view).not.toContain('className="theme-builder-equipment-board-head"');
    expect(view).toContain('builder.activeWeaponSet === set && <b>Active</b>');
    expect(css).toMatch(/\.theme-builder-equipment-workspace \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  });

  it("renders each equipment item once in its image-led editor", () => {
    expect(view).not.toContain("EquipmentLoadoutSheet");
    expect(view).not.toContain('aria-label="Current equipment loadout"');
    expect(view).toContain('emptyIcon={<EquipmentArtwork src={BUILDER_ARMOR_SLOT_ICONS[slot]}');
    expect(view).toContain('emptyIcon={<EquipmentArtwork src={BUILDER_TRINKET_SLOT_ICONS[trinketSlot]}');
  });

  it("keeps equipment navigation to one compact row until phone widths", () => {
    expect(css).toMatch(/\.theme-builder-equipment-nav button \{[\s\S]*?min-height: 2\.5rem;/);
    expect(css).not.toMatch(/@container \(max-width: 48rem\)[\s\S]*?\.theme-builder-equipment-nav \{[\s\S]*?grid-template-columns: repeat\(2/);
    expect(css).toMatch(/@container \(max-width: 30rem\)[\s\S]*?\.theme-builder-equipment-nav \{[\s\S]*?overflow-x: auto;/);
  });

  it("disables impossible off-hand stat overrides for two-handed weapons", () => {
    expect(view).toMatch(/id={`builder-weapon-stat-\${slot}`}[\s\S]*?disabled={offhandDisabled}[\s\S]*?disabledLabel="Unavailable with a two-handed weapon"/);
  });

  it("keeps trinket artwork compact in the embedded preview and expanded viewer", () => {
    expect(css).toMatch(/\.theme-builder-preview-trinket-card > img,[\s\S]*?width: 2\.2rem;[\s\S]*?height: 2\.2rem;/);
    expect(css).not.toContain(".theme-builder-viewer .theme-builder-preview-trinket-card > img");
  });

  it("keeps the library and saved-build viewer content-led", () => {
    expect(view).toContain('theme-builder-workspace theme-builder-library-workspace');
    expect(css).toMatch(/\.theme-builder-library-workspace \{[\s\S]*?min-height: 0;[\s\S]*?border: 0;/);
    expect(view).toMatch(/<BuildPreview[\s\S]*?compact \/>/);
    expect(view).toMatch(/<EquipmentPreview[\s\S]*?attributeTotals=\{profile\.totals\}[\s\S]*?attributeProfile=\{profile\}/);
    expect(view).toContain('className="theme-builder-analysis-details"');
    expect(css).toMatch(/\.theme-builder-viewer \{[\s\S]*?height: auto;[\s\S]*?max-height:/);
  });
});
