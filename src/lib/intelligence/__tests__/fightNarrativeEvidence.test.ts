import { describe, expect, it } from "vitest";
import { buildFightNarrativeEvidence } from "../fightNarrativeEvidence";
import type { IntelligenceAction, IntelligenceEngagementInsight } from "../intelligenceDashboard";
import type { CriticalEvent, IntelligenceFinding } from "../types";

const engagement: IntelligenceEngagementInsight = {
  id: "segment-1",
  label: "Pressure window",
  fightId: "fight-1",
  timestampMs: 10_000,
  pressureScore: 50,
  pressurePercent: 50,
  pressureLabel: "danger",
  priority: 1,
  state: "active",
  downs: 2,
  deaths: 1,
  criticalEvents: 2,
  findings: [],
  reviewPrompt: "Review it.",
  evidencePoints: [],
};

const event: CriticalEvent = {
  id: "event-1",
  timestampMs: 10_000,
  fightId: "fight-1",
  category: "defense",
  kind: "failed-recovery",
  summary: "Recorded event",
  relatedEvents: ["raw-1"],
  confidence: "high",
};

const finding: IntelligenceFinding = {
  id: "finding-1",
  title: "Recovery review",
  category: "defense",
  severity: "significant",
  confidence: "correlation",
  summary: "Recorded finding",
  evidence: [{ statement: "One recorded statement", relatedEvents: ["raw-1"] }],
  relatedEvents: ["event-1"],
  relatedFight: "fight-1",
};

const action: IntelligenceAction = {
  id: "action-1",
  title: "Review recovery",
  detail: "Review it.",
  basedOn: ["finding-1"],
  confidence: "correlation",
};

describe("buildFightNarrativeEvidence", () => {
  it("exposes support counts, confidence, and honest boundaries for every narrative section", () => {
    const context = buildFightNarrativeEvidence({
      result: "win",
      engagements: [engagement],
      findings: [finding],
      criticalEvents: [event],
      actions: [action],
    });

    expect(Object.keys(context)).toEqual(["what-happened", "likely-issue", "what-to-improve"]);
    expect(context["what-happened"]).toMatchObject({
      supportingFightCount: 1,
      supportingEventCount: 1,
      sampleCount: 1,
      confidence: "high data confidence",
    });
    expect(context["likely-issue"].counterEvidence).toContain("won this fight");
    expect(context["what-to-improve"]).toMatchObject({
      supportingFightCount: 1,
      supportingEventCount: 2,
      sampleCount: 1,
      confidence: "correlation",
    });
  });

  it("does not manufacture support when findings and actions are absent", () => {
    const context = buildFightNarrativeEvidence({
      result: "loss",
      engagements: [],
      findings: [],
      criticalEvents: [],
      actions: [],
    });

    expect(context["likely-issue"].confidence).toBe("insufficient-evidence");
    expect(context["likely-issue"].supportingFightCount).toBe(0);
    expect(context["likely-issue"].supportingEventCount).toBe(0);
    expect(context["what-to-improve"].supportingFightCount).toBe(0);
    expect(context["what-to-improve"].counterEvidence).toContain("No persisted finding");
  });
});
