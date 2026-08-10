import { describe, expect, it } from "vitest";
import { buildIntelligenceDashboard } from "../intelligence/intelligenceDashboard";
import type { EngagementSegment } from "../intelligence/engagementTypes";
import type { CriticalEvent, IntelligenceFinding } from "../intelligence/types";
import type { WvWReport } from "../../types/report";

const event = (kind: string, id = kind): CriticalEvent => ({
  id,
  timestampMs: 12000,
  fightId: "fight-1",
  category: kind === "squad-separation" ? "positioning" : "defense",
  kind,
  summary: `${kind} happened`,
  relatedEvents: [`combat:${kind}`],
  relatedPlayers: ["player:Alice.1"],
  confidence: "high",
});

const segment = (criticalEventIds: string[], overrides: Partial<EngagementSegment> = {}): EngagementSegment => ({
  id: "engagement:fight-1:0:1000-5000",
  fightId: "fight-1",
  index: 0,
  start: { timestampMs: 1000, reason: "fight-boundary", evidence: [] },
  end: { timestampMs: 5000, reason: "combat-activity-end", evidence: [] },
  durationMs: 4000,
  state: "wipe",
  confidence: "high",
  criticalEventIds,
  combatEventIds: ["combat:1"],
  participantKeys: ["player:Alice.1"],
  downs: 3,
  deaths: 1,
  evidence: [],
  note: "Fight 1",
  ...overrides,
});

const baseReport = (stats: Record<string, unknown>): WvWReport =>
  ({
    meta: {
      id: "report-1",
      title: "Test Report",
      commanders: [],
      dateStart: "2026-08-09T00:00:00.000Z",
      dateEnd: "2026-08-09T00:10:00.000Z",
      dateLabel: "Today",
      generatedAt: "2026-08-09T00:10:00.000Z",
      appVersion: "test",
    },
    stats: {
      fightBreakdown: [],
      ...stats,
    },
  }) as unknown as WvWReport;

describe("buildIntelligenceDashboard", () => {
  it("uses persisted intelligence fields and creates an action queue from findings", () => {
    const criticalEvents = [event("defensive-failure"), event("mass-down")];
    const engagementSegments = [segment(criticalEvents.map((criticalEvent) => criticalEvent.id))];
    const intelligenceFindings: IntelligenceFinding[] = [
      {
        id: `finding:defensive-collapse:${engagementSegments[0].id}`,
        title: "Defensive collapse",
        category: "defense",
        severity: "critical",
        confidence: "correlation",
        summary: "Defensive evidence clustered with downs.",
        evidence: [{ statement: "Mass downs occurred near defensive failure." }],
        relatedEvents: ["combat:1"],
        relatedFight: "fight-1",
      },
    ];

    const dashboard = buildIntelligenceDashboard(
      baseReport({
        criticalEvents,
        engagementSegments,
        intelligenceFindings,
        replayFights: [{ id: "fight-1" }],
        deathRecaps: [{ id: "death-1" }],
      }),
    );

    expect(dashboard.persisted).toBe(true);
    expect(dashboard.readiness).toBe("high-risk");
    expect(dashboard.actions[0].title).toBe("Audit defensive call timing");
    expect(dashboard.timeline[0].detail).toBe("Defensive collapse");
    expect(dashboard.coverage.replay).toBe(true);
    expect(dashboard.coverage.deathRecaps).toBe(true);
  });

  it("falls back to legacy fight rows without inventing critical events", () => {
    const dashboard = buildIntelligenceDashboard(
      baseReport({
        fightBreakdown: [
          {
            id: "legacy-1",
            timestamp: 1000,
            alliesDown: 2,
            alliesDead: 1,
            enemyDowns: 3,
            enemyDeaths: 2,
            label: "Legacy Fight",
          },
        ],
      }),
    );

    expect(dashboard.persisted).toBe(false);
    expect(dashboard.totals.segments).toBe(1);
    expect(dashboard.totals.criticalEvents).toBe(0);
    expect(dashboard.totals.findings).toBe(0);
    expect(dashboard.headline).toContain("Legacy report");
  });
});
