import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBuilder } from "../../lib/axiforge/builderModel";
import type { SavedBuilderBuild } from "../../types/buildEditor";
import BuildSummaryCard from "./BuildSummaryCard";

describe("BuildSummaryCard", () => {
  it("renders a saved build as an openable compact summary", () => {
    const state = createEmptyBuilder();
    state.name = "Support Troub";
    state.professionId = "Mesmer";
    state.role = "Heal support";
    state.equipment.statPackage = "Minstrel's";
    state.equipment.weapons.mainhand1 = "sword";
    state.equipment.weapons.offhand1 = "shield";
    const build: SavedBuilderBuild = {
      id: "build-1",
      name: state.name,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      shareCode: "",
      state,
    };

    const markup = renderToStaticMarkup(
      <BuildSummaryCard build={build} onOpen={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onCopy={vi.fn()} onShare={vi.fn()} specsById={new Map()} slotCount={2} />,
    );

    expect(markup).toContain("Support Troub");
    expect(markup).toContain("Heal support / Minstrel&#x27;s / sword + shield");
    expect(markup).toContain("Squad x2");
    expect(markup).toContain('title="Open Support Troub"');
    expect(markup).toContain('aria-label="Actions for Support Troub"');
    expect(markup).toContain("Duplicate");
    expect(markup).toContain("Copy Entropy code");
    expect(markup).toContain("Copy share link");
    expect(markup).toContain("Delete");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Draft");
  });
});
