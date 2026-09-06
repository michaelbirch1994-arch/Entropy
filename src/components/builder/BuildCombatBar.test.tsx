import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBuilder } from "../../lib/axiforge/builderModel";
import BuildCombatBar from "./BuildCombatBar";

describe("BuildCombatBar", () => {
  it("renders the selected weapon set, health, and empty skill states", () => {
    const builder = createEmptyBuilder();
    builder.equipment.weapons.mainhand1 = "sword";
    builder.equipment.weapons.offhand1 = "shield";

    const markup = renderToStaticMarkup(
      <BuildCombatBar
        builder={builder}
        profession={null}
        specsById={new Map()}
        skillsById={new Map()}
        legends={[]}
        pets={[]}
        health={11645}
        weaponSet={1}
        onSwap={vi.fn()}
        onInspect={vi.fn()}
        onInspectPet={vi.fn()}
      />,
    );

    expect(markup).toContain('aria-label="Combat skill bar, weapon set I"');
    expect(markup).toContain('aria-label="11,645 health"');
    expect(markup).toContain('aria-label="Show weapon set II skills"');
    expect(markup).toContain("sword + shield");
    expect(markup.match(/<button/g)).toHaveLength(11);
  });
});
