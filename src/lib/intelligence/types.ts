/**
 * Foundational types for the Entropy Intelligence engine.
 *
 * ---------------------------------------------------------------------------
 * SCOPE RULE — READ BEFORE EXTENDING
 * ---------------------------------------------------------------------------
 * This file defines STRUCTURE ONLY. It contains no scoring, no thresholds, no
 * "squad intelligence = 87" style composites, and no algorithms that decide
 * what counts as a Finding or a Pattern. Those come in later phases, once the
 * weighting/threshold questions raised in the architecture review have been
 * decided explicitly rather than baked into types.
 *
 * The one rule every one of these types exists to enforce: nothing produced
 * by the intelligence engine may assert a claim without a way to show the
 * evidence. `evidence` and `relatedEvents` are not optional decoration — they
 * are the mechanism that makes a Finding falsifiable/inspectable rather than
 * an AI assertion the user has to take on faith.
 *
 * References to events use `eventIdentity()` strings (see CombatEvent.ts)
 * rather than embedding whole CombatEvent objects, so a Finding stays small
 * and the underlying event can still be looked up on demand.
 */

import type { AttributionConfidence } from '../combat/CombatEvent';

export type { AttributionConfidence };

/**
 * How strong a claimed relationship between events is, distinct from
 * `AttributionConfidence` (which is about data trustworthiness, not about
 * whether a pattern is real). A Finding can be built from high-confidence
 * DATA and still only support a low-confidence PATTERN claim.
 */
export type PatternConfidence =
  | 'insufficient-evidence'
  | 'correlation'
  | 'strong-correlation'
  | 'likely-causal';

export type FindingSeverity = 'info' | 'notable' | 'significant' | 'critical';

export type FindingCategory =
  | 'defense'
  | 'offense'
  | 'support'
  | 'positioning'
  | 'coordination'
  | 'composition'
  | 'other';

/**
 * One piece of evidence backing a Finding. Deliberately plain-data — a
 * human-readable statement plus (optionally) the concrete numbers and event
 * references that back it, so the UI can render it directly and a developer
 * can trace it back to source data without guessing what "supports" a claim.
 */
export interface Evidence {
  /** Plain-language statement, e.g. "4 deaths occurred during Stability gaps". */
  statement: string;
  /** Raw figures the statement is built from, for display alongside it. */
  metrics?: Record<string, number | string>;
  /** `eventIdentity()` strings for the specific CombatEvents this evidence points at. */
  relatedEvents?: string[];
  /** Account keys (see agentIdentity.ts) for players this evidence concerns. */
  relatedPlayers?: string[];
}

/**
 * A timestamped occurrence worth surfacing on its own — the input to
 * correlation, not a conclusion. "4 deaths in a 3-second window" is a
 * CriticalEvent; "the squad's defensive coverage failed" (built from several
 * CriticalEvents plus evidence) is a Finding.
 */
export interface CriticalEvent {
  id: string;
  timestampMs: number;
  fightId: string;
  category: FindingCategory;
  /** Short machine-ish label, e.g. "death-cluster", "boon-gap". Not yet a fixed enum — see note below. */
  kind: string;
  summary: string;
  relatedEvents: string[];
  relatedPlayers?: string[];
  confidence: AttributionConfidence;
}

/**
 * A claimed relationship between two or more CriticalEvents/CombatEvents,
 * e.g. "stability loss preceded this spike by 1.2s". Correlation primitives
 * in timeWindow.ts answer "what happened when" — this type is where that
 * gets recorded as a specific claimed relationship, once something upstream
 * decides the relationship is worth recording. This phase does not implement
 * that decision logic.
 */
export interface Correlation {
  id: string;
  /** What kind of relationship, e.g. "precedes", "co-occurs-with", "same-player". Free-form for now. */
  relationship: string;
  subjectEventIds: string[];
  windowMs?: number;
  confidence: PatternConfidence;
  note?: string;
}

/**
 * A recurring Correlation observed across multiple fights. Left intentionally
 * light — historical pattern detection (Phase 9) is what actually builds
 * these; this phase only defines the shape they will take so Finding/
 * Recommendation types have something concrete to reference.
 */
export interface Pattern {
  id: string;
  title: string;
  description: string;
  /** Fraction of applicable fights/engagements where this pattern held, when known. */
  occurrenceRate?: number;
  confidence: PatternConfidence;
  supportingFightIds: string[];
}

/**
 * An actionable suggestion. Must be traceable to at least one Finding — a
 * Recommendation with no `basedOn` is exactly the "AI says something the user
 * cannot verify" failure mode this architecture exists to prevent.
 */
export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  /** Finding ids this recommendation is derived from. Must be non-empty. */
  basedOn: string[];
  confidence: PatternConfidence;
}

/**
 * The top-level conclusion type. Every field down to `evidence` must be
 * populated from real computed data — see the module header. `severity` and
 * `category` are descriptive labels for display grouping, not scores.
 */
export interface IntelligenceFinding {
  id: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: PatternConfidence;
  summary: string;
  evidence: Evidence[];
  relatedEvents: string[];
  relatedPlayers?: string[];
  relatedFight: string;
  recommendation?: Recommendation;
}

/** Construct a Finding, requiring at least one piece of evidence at the type level. */
export function createFinding(input: Omit<IntelligenceFinding, 'evidence'> & { evidence: [Evidence, ...Evidence[]] }): IntelligenceFinding {
  return { ...input };
}

/** Construct a Recommendation, requiring at least one supporting Finding id at the type level. */
export function createRecommendation(
  input: Omit<Recommendation, 'basedOn'> & { basedOn: [string, ...string[]] },
): Recommendation {
  return { ...input };
}
