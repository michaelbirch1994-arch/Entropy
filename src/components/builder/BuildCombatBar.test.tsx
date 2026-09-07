import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBuilder } from "../../lib/axiforge/builderModel";
import type { Gw2Skill } from "../../types/buildEditor";
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
    expect(markup).toContain('class="lucide lucide-plus theme-builder-combat-empty"');
    expect(markup).not.toContain("<span>6</span>");
    expect(markup.match(/<button/g)).toHaveLength(11);
  });

  it("shows equipped healing and utility names in the build viewer", () => {
    const builder = createEmptyBuilder();
    builder.healSkillId = 101;
    builder.utilitySkillIds = [102, 103, 104];
    builder.eliteSkillId = 105;
    const skillsById = new Map<number, Gw2Skill>([101, 102, 103, 104, 105].map((id, index) => [
      id,
      { id, name: `Equipped Skill ${index + 1}` } as Gw2Skill,
    ]));

    const markup = renderToStaticMarkup(
      <BuildCombatBar
        builder={builder}
        profession={null}
        specsById={new Map()}
        skillsById={skillsById}
        legends={[]}
        pets={[]}
        health={11645}
        weaponSet={1}
        onSwap={vi.fn()}
        onInspect={vi.fn()}
        onInspectPet={vi.fn()}
        showUtilityNames
      />,
    );

    expect(markup).toContain('aria-label="Equipped healing and utility skill names"');
    expect(markup).toContain("Equipped Skill 1");
    expect(markup).toContain("Equipped Skill 5");
  });
});
