import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Shield } from "lucide-react";
import { MvpBlock } from "./OverviewView";
import { PlayerMetricCard } from "./TopPlayersView";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import StatCard from "../components/ui/StatCard";
import type { LeaderboardEntry, MvpCard } from "../types/report";

const player: LeaderboardEntry = { rank: 2, account: "A-very-long-player-account.1234", profession: "Firebrand", professionList: ["Firebrand"], value: 50000, count: 6 };
const sample = { fights: 6, totalFights: 8, combatTimeMs: 240000 };
const mvp: MvpCard = { ...player, score: 3.8, reason: "Participation", topStats: [{ name: "Down Contribution", val: "171,254", ratio: 0.98, rank: 2 }, { name: "Boon Strips", val: "197", ratio: 0.7, rank: 3 }] };

describe("Player and metric presentation", () => {
  it("keeps the MVP score and original supporting values without truncation", () => {
    const html = renderToStaticMarkup(<MvpBlock mvp={mvp} silver={mvp} bronze={mvp} accent="amber" label="Offensive MVP" onOpen={() => {}} />);
    expect(html).toContain('<small>MVP score</small><strong>3.8</strong>');
    expect(html).toContain('<span>Down Contribution</span><strong>171,254</strong>');
    expect(html).toContain('<span>Boon Strips</span><strong>197</strong>');
    expect(html.match(/<button /g)).toHaveLength(3);
    expect(html).toContain('data-profession-family="guardian"');
    expect(html).toContain("View A-very-long-player-account.1234 in Top Players for Offensive MVP");
    expect(html).not.toMatch(/truncate|line-clamp/);
  });

  it("preserves rank, metric, participation, comparison and source controls", () => {
    const html = renderToStaticMarkup(<PlayerMetricCard entry={player} index={1} max={100000} metricLabel="Healing" glowClass="neon-healing" sample={sample} expanded={false} onToggle={() => {}} controlsId="source-panel" triggerId="source-trigger" />);
    expect(html).toContain(player.account);
    expect(html).toContain(">#2</span>");
    expect(html).toContain("50,000");
    expect(html).toContain('style="width:50%"');
    expect(html).toContain("6/8 fights");
    expect(html).toContain("4:00 active");
    expect(html).toContain("75% participation");
    expect(html).toContain("Moderate sample");
    expect(html).toContain('aria-expanded="false" aria-controls="source-panel"');
    expect(html).toContain("Show source breakdown");
    expect(html).toContain('class="entropy-player-watermark" aria-hidden="true"');
    expect(html).not.toContain("truncate");
  });

  it("retains the existing zero-value meter and expanded action", () => {
    const html = renderToStaticMarkup(<PlayerMetricCard entry={{ ...player, value: 0 }} index={1} max={0} metricLabel="Healing" glowClass="neon-healing" sample={sample} expanded onToggle={() => {}} controlsId="source-panel" triggerId="source-trigger" />);
    expect(html).toContain('style="width:4%"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Hide source breakdown");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("renders one decorative selection plate without changing tab semantics", () => {
    const html = renderToStaticMarkup(<SegmentedControl ariaLabel="Damage scope" value="all" onChange={() => {}} options={[{ value: "all", label: "All damage" }, { value: "player", label: "Player damage" }]} />);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html.match(/entropy-selection-indicator/g)).toHaveLength(1);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("All damage");
    expect(html).toContain("Player damage");
  });

  it("leaves instrument values, labels, tone and provenance literal", () => {
    const html = renderToStaticMarkup(<StatCard label="Barrier" value="928.48" sub="Chewy.5329 / 6 logs" tone="warning" icon={<Shield />} />);
    expect(html).toContain("928.48");
    expect(html).toContain("Chewy.5329 / 6 logs");
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain('class="entropy-stat-watermark" aria-hidden="true"');
  });
});
