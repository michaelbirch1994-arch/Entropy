import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RankedMetricList from "./RankedMetricList";

describe("Ranked metric presentation", () => {
  it("preserves supplied order, full identities, exact values and proportional bars", () => {
    const html = renderToStaticMarkup(<RankedMetricList metric="Damage" onOpen={() => {}} entries={[
      { account: "A-very-long-player-account.1234", profession: "Firebrand", value: 150000 },
      { account: "Another-player.5678", profession: "Reaper", value: 300000 },
    ]} />);
    expect(html.indexOf("A-very-long-player-account.1234")).toBeLessThan(html.indexOf("Another-player.5678"));
    expect(html).toContain("150,000");
    expect(html).toContain("300,000");
    expect(html).toContain("--ranked-fill:50%");
    expect(html).toContain("--ranked-fill:100%");
    expect(html).toContain('aria-label="View A-very-long-player-account.1234 for Damage"');
    expect(html).toContain('data-profession-family="guardian"');
    expect(html.match(/<button /g)).toHaveLength(2);
    expect(html).not.toMatch(/truncate|line-clamp/);
  });

  it("renders a zero-length bar for a recorded zero", () => {
    const html = renderToStaticMarkup(<RankedMetricList metric="Boon strips" onOpen={() => {}} entries={[
      { account: "Player.1234", profession: "Guardian", value: 0 },
    ]} />);
    expect(html).toContain("--ranked-fill:0%");
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).toContain("Player.1234");
  });

  it("distinguishes no records from zero-valued records", () => {
    const html = renderToStaticMarkup(<RankedMetricList metric="Boon strips" onOpen={() => {}} entries={[]} />);
    expect(html).toContain("No recorded boon strips.");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<ol");
  });
});
