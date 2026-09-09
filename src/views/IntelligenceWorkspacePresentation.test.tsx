import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CriticalEventCard, FightSelector } from "./IntelligenceDebugView";

const fight = { id: "fight-a", index: 0, label: "Fight 1", name: "Alpine Borderlands", squadCount: 31, enemyCount: 53, downs: 24, deaths: 20 };
const totals = { downs: 24, deaths: 20, findings: 2, criticalEvents: 64 };

describe("Intelligence workspace presentation", () => {
  it("retains every fight option, its source counts, and the selected scope", () => {
    const fights = Array.from({ length: 20 }, (_, index) => ({ ...fight, id: `fight-${index}`, index, label: `Fight ${index + 1}` }));
    const html = renderToStaticMarkup(<FightSelector fights={fights} selectedFightId="fight-19" onSelect={() => {}} totals={totals} />);
    expect(html.match(/<option /g)).toHaveLength(21);
    expect(html).toContain('value="fight-19" selected=""');
    expect(html).toContain("24D / 20X");
    expect(html).toMatch(/aria-label="Next Intelligence fight"[^>]*disabled=""/);
  });

  it("disables both step controls when there are no fights", () => {
    const html = renderToStaticMarkup(<FightSelector fights={[]} selectedFightId="all" onSelect={() => {}} totals={{ downs: 0, deaths: 0, findings: 0, criticalEvents: 0 }} />);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Intelligence fight scope"');
  });

  it("keeps the full event summary, timestamp, confidence and fight context", () => {
    const summary = "Recorded pressure with a long player name and explicit evidence caveat. ".repeat(6);
    const html = renderToStaticMarkup(<CriticalEventCard selected onInspect={() => {}} fightContext={fight} event={{ id: "event-a", fightId: fight.id, timestampMs: 12500, category: "positioning", kind: "squad-separation", summary, confidence: "high", relatedEvents: [] }} />);
    expect(html).toContain(summary);
    expect(html).toContain("0:12");
    expect(html).toContain("high");
    expect(html).toContain(fight.name);
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("line-clamp");
  });
});
