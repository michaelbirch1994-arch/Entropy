import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkillSourceRows } from "./SquadStatsView";

const skill = { id: 1, name: "A long skill name that must remain completely visible", damage: 568, downContribution: 0, hits: 2, icon: "/skill.png" };

describe("Squad source presentation", () => {
  it("keeps full skill names and all pressure evidence", () => {
    const html = renderToStaticMarkup(<SkillSourceRows kind="pressure" rows={[skill]} />);
    expect(html).toContain(skill.name);
    expect(html).toContain("0 <small>down</small>");
    expect(html).toContain("568 dmg");
    expect(html).toContain("2 hits");
    expect(html).toContain('aria-label="pressure skill sources, 1 skills"');
    expect(html).toContain('src="/skill.png"');
    expect(html).not.toMatch(/truncate|line-clamp/);
  });

  it("preserves the incoming metric and zero hits without artwork", () => {
    const html = renderToStaticMarkup(<SkillSourceRows kind="incoming" rows={[{ ...skill, icon: undefined, hits: 0 }]} />);
    expect(html).toContain("568 <small>dmg</small>");
    expect(html).toContain("0 hits");
    expect(html).not.toContain("<img");
  });

  it("does not fabricate sources for an empty group", () => {
    expect(renderToStaticMarkup(<SkillSourceRows kind="healing" rows={[]} />)).toBe("");
  });
});
