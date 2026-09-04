import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PeakDamagePanel from "../../../components/ui/PeakDamagePanel";
import { DamageScopeProvider } from "../../../store/DamageScopeContext";
import type { DpsGraphData } from "../../../types/report";

const data: DpsGraphData = { fights: [{
  fightId: "fixture", fightName: "Test fight", durationMs: 2000, squad: [],
  players: Array.from({ length: 12 }, (_, i) => ({
    account: `Player${i}.1234`, profession: "Soulbeast", points: [0, i * 100, i * 100],
  })),
}] };

function render(scope: "all" | "players", graph?: DpsGraphData) {
  vi.stubGlobal("localStorage", { getItem: () => scope });
  return renderToStaticMarkup(<DamageScopeProvider><PeakDamagePanel data={graph} totalFights={1} /></DamageScopeProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("PeakDamagePanel", () => {
  it("renders nine high-score cards, three podium entries, and the complete table", () => {
    const markup = render("all", data);
    expect(markup.match(/<article\b/g)).toHaveLength(9);
    expect(markup.match(/class="theme-podium-card /g)).toHaveLength(3);
    expect(markup.match(/<th scope="row"/g)).toHaveLength(12);
    expect(markup).toContain("Peak 1s Damage - Top 9");
    expect(markup).toContain("1,100");
  });

  it("does not display all-target rankings in players-only scope", () => {
    const markup = render("players", data);
    expect(markup).toContain("Switch damage scope to All targets");
    expect(markup).not.toContain("<article");
    expect(markup).not.toContain("<table");
  });

  it("shows unavailable instead of manufacturing entries for old reports", () => {
    const markup = render("all");
    expect(markup).toContain("No complete one-second damage series available.");
    expect(markup).not.toContain("<article");
  });

  it("does not pad a small roster with placeholder cards", () => {
    const markup = render("all", { fights: [{ ...data.fights[0], players: data.fights[0].players.slice(0, 2) }] });
    expect(markup.match(/<article\b/g)).toHaveLength(2);
    expect(markup.match(/class="theme-podium-card /g)).toHaveLength(2);
  });
});
