import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/Styles/BuilderSquadUsability.css", "utf8");
const view = readFileSync("src/views/AxiForgeLabView.tsx", "utf8");

describe("builder squad composition layout", () => {
  it("uses compact five-slot subgroup rows with silent empty targets", () => {
    expect(css).toMatch(/\.theme-builder-squad-command-left \.theme-builder-party-line \{[\s\S]*?grid-template-columns: minmax\(9rem, 0\.36fr\) minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.theme-builder-squad-picker \.theme-builder-picker-field > \.theme-builder-label,[\s\S]*?\.theme-builder-squad-picker \.theme-builder-picker-trigger > \* \{[\s\S]*?display: none;/);
    expect(view).toContain("triggerAriaLabel={`Assign a saved build to ${slotLabel}`}");
  });

  it("shows elite specialization icons in assigned squad slots", () => {
    expect(view).toContain("resolveEliteSpecName(selected.state.specializationIds, specsById, selected.state.professionId)");
  });

  it("does not render the redundant tactical matrix", () => {
    expect(view).not.toContain("SquadTacticalMatrix");
    expect(view).not.toContain("AF-style squad telemetry");
  });

  it("keeps detected coverage prominent and missing effects compact", () => {
    expect(view).toContain('const coveredBoons = BOON_DISPLAY_ORDER.filter');
    expect(view).toContain('const coveredConditions = BUILDER_CONDITION_DISPLAY_ORDER.filter');
    expect(view).toContain('const coveredUtilities = BUILD_UTILITY_ORDER.filter');
    expect(view).toContain('className="theme-builder-coverage-missing"');
    expect(view).toContain('<section className="theme-builder-boon-coverage theme-builder-coverage-disclosure">');
    expect(view).not.toContain('<details className="theme-builder-boon-coverage');
    expect(css).toMatch(/\.theme-builder-coverage-disclosure \{[\s\S]*?border: 0;/);
    expect(css).toMatch(/\.theme-builder-coverage-disclosure > \.theme-builder-boon-grid \{[\s\S]*?minmax\(5\.25rem, 1fr\)/);
    expect(css).toMatch(/\.theme-builder-coverage-disclosure > \.theme-builder-utility-grid \{[\s\S]*?minmax\(7\.25rem, 1fr\)/);
  });
});
