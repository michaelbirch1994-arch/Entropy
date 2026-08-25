import { describe, expect, it } from "vitest";
import { buildReportHtmlExport } from "../exportReportHtml";
import type { WvWReport } from "../../types/report";

function legacySplitReport(): WvWReport {
  return {
    meta: {
      id: "legacy-export",
      title: "Legacy Export",
      commanders: [],
      dateStart: "2026-08-15T00:00:00.000Z",
      dateEnd: "2026-08-15T01:00:00.000Z",
      dateLabel: "Aug 15, 2026",
      generatedAt: "2026-08-15T01:00:00.000Z",
      appVersion: "legacy",
    },
    stats: {
      total: 3,
      wins: 0,
      losses: 0,
      unclassified: 3,
      avgSquadSize: 20,
      offensePlayers: [
        {
          account: "Player.1234",
          profession: "Guardian",
          professionList: ["Guardian"],
          offenseTotals: { damage: 1200, downContribution: 40 } as any,
          offenseRateWeights: {},
          totalFightMs: 60_000,
        },
        {
          account: "Player.1234",
          profession: "Necromancer",
          professionList: ["Necromancer"],
          offenseTotals: { damage: 1800, downContribution: 60 } as any,
          offenseRateWeights: {},
          totalFightMs: 40_000,
        },
      ],
      healingPlayers: [
        {
          account: "Player.1234",
          profession: "Guardian",
          professionList: ["Guardian"],
          healingTotals: { healing: 1000, barrier: 300 } as any,
          activeMs: 60_000,
          hasHealAddon: true,
          healingCoverage: "full",
        },
        {
          account: "Player.1234",
          profession: "Necromancer",
          professionList: ["Necromancer"],
          healingTotals: { healing: 500, barrier: 200 } as any,
          activeMs: 40_000,
          hasHealAddon: true,
          healingCoverage: "full",
        },
      ],
      supportPlayers: [
        {
          account: "Player.1234",
          profession: "Guardian",
          professionList: ["Guardian"],
          supportTotals: { condiCleanse: 2, boonStrips: 3 } as any,
          activeMs: 60_000,
          logsJoined: 2,
        },
        {
          account: "Player.1234",
          profession: "Necromancer",
          professionList: ["Necromancer"],
          supportTotals: { condiCleanse: 5, boonStrips: 7 } as any,
          activeMs: 40_000,
          logsJoined: 1,
        },
      ],
      generalPlayers: [
        {
          account: "Player.1234",
          profession: "Guardian",
          professionList: ["Guardian"],
          totalFightMs: 60_000,
          squadActiveMs: 55_000,
          totalDist: 0,
          distCount: 0,
          logsJoined: 2,
          stackedLogCount: 0,
        },
        {
          account: "Player.1234",
          profession: "Necromancer",
          professionList: ["Necromancer"],
          totalFightMs: 40_000,
          squadActiveMs: 35_000,
          totalDist: 0,
          distCount: 0,
          logsJoined: 1,
          stackedLogCount: 0,
        },
      ],
    } as any,
  };
}

describe("buildReportHtmlExport", () => {
  it("exports one complete account row for a legacy profession swap", () => {
    const html = buildReportHtmlExport(legacySplitReport());

    expect(html).toContain('<td>Player.1234</td><td>Guardian</td><td class="num">3</td>');
    expect(html).toContain('<td class="num dmg">3.0K</td>');
    expect(html).toContain('<td class="num heal">1.5K</td>');
    expect(html).toContain('<td class="num">500</td><td class="num">100</td><td class="num">7</td><td class="num">10</td>');
    expect((html.match(/Player\.1234/g) ?? [])).toHaveLength(1);
  });
});
