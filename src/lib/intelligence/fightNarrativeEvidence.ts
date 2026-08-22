import type {
  IntelligenceAction,
  IntelligenceEngagementInsight,
} from "./intelligenceDashboard";
import type { CriticalEvent, IntelligenceFinding } from "./types";

export type FightNarrativeSection = "what-happened" | "likely-issue" | "what-to-improve";

export interface FightNarrativeEvidenceContext {
  supportingFightCount: number;
  supportingEventCount: number;
  sampleCount: number;
  sampleLabel: string;
  confidence: string;
  counterEvidence: string;
}

export type FightNarrativeEvidence = Record<FightNarrativeSection, FightNarrativeEvidenceContext>;

export interface BuildFightNarrativeEvidenceInput {
  result?: "win" | "loss" | "unclassified";
  engagements: readonly IntelligenceEngagementInsight[];
  findings: readonly IntelligenceFinding[];
  criticalEvents: readonly CriticalEvent[];
  actions: readonly IntelligenceAction[];
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items.filter((item) => item.length > 0))];
}

function findingEvidenceReferences(finding: IntelligenceFinding | undefined): string[] {
  if (!finding) return [];
  return unique([
    ...finding.relatedEvents,
    ...finding.evidence.flatMap((evidence) => evidence.relatedEvents ?? []),
  ]);
}

/**
 * Describes the evidence boundary behind each deterministic fight narrative.
 * It does not change the narration, calculate a new score, or infer missing
 * counter-evidence.
 */
export function buildFightNarrativeEvidence({
  result,
  engagements,
  findings,
  criticalEvents,
  actions,
}: BuildFightNarrativeEvidenceInput): FightNarrativeEvidence {
  const criticalFindings = findings.filter((finding) =>
    finding.severity === "critical" || finding.severity === "significant");
  const primaryFinding = criticalFindings[0] ?? findings[0];
  const primaryAction = actions[0];
  const actionFindings = primaryAction
    ? findings.filter((finding) => primaryAction.basedOn.includes(finding.id))
    : [];
  const actionEventReferences = unique(actionFindings.flatMap(findingEvidenceReferences));
  const primaryEventReferences = findingEvidenceReferences(primaryFinding);

  return {
    "what-happened": {
      supportingFightCount: engagements.length > 0 || criticalEvents.length > 0 ? 1 : 0,
      supportingEventCount: criticalEvents.length,
      sampleCount: engagements.length,
      sampleLabel: "pressure windows",
      confidence: criticalEvents.length > 0
        ? criticalEvents.every((event) => event.confidence === "high") ? "high data confidence" : "mixed data confidence"
        : "insufficient timestamp evidence",
      counterEvidence: engagements.length <= 1
        ? "Only one pressure window is available, so recurrence inside this fight is not established."
        : `${Math.max(0, engagements.length - 1)} other pressure windows provide comparison inside this fight.`,
    },
    "likely-issue": {
      supportingFightCount: primaryFinding ? 1 : 0,
      supportingEventCount: primaryEventReferences.length,
      sampleCount: primaryFinding?.evidence.length ?? 0,
      sampleLabel: "evidence statements",
      confidence: primaryFinding?.confidence ?? "insufficient-evidence",
      counterEvidence: result === "win"
        ? "The squad won this fight, which limits any interpretation of this signal as a fight-deciding failure."
        : "No explicit counter-evidence field is persisted; compare this prompt against Replay, comp, and comms.",
    },
    "what-to-improve": {
      supportingFightCount: primaryAction ? 1 : 0,
      supportingEventCount: actionEventReferences.length,
      sampleCount: primaryAction?.basedOn.length ?? 0,
      sampleLabel: "linked findings",
      confidence: primaryAction?.confidence ?? "insufficient-evidence",
      counterEvidence: primaryAction
        ? "This is an evidence-backed review prompt, not a prediction that the suggested change guarantees a different result."
        : "No persisted finding supported a specific action, so the fallback remains a manual review prompt.",
    },
  };
}
