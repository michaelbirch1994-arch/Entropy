/**
 * Unified CombatEvent model — a normalized layer over every combat data source.
 *
 * ---------------------------------------------------------------------------
 * SCOPE RULE — READ BEFORE EXTENDING
 * ---------------------------------------------------------------------------
 * This is an ADDITIVE layer. It does not replace the existing analytics engine,
 * and nothing in `bridge-metrics/` or the fight viewer depends on it. Existing
 * metrics keep working exactly as they do today; calculations migrate here one at
 * a time, only once an equivalent has been validated against the old path.
 *
 * Do not refactor existing views to consume CombatEvent wholesale. The failure
 * mode that rule exists to prevent is a half-migrated application where the old
 * fight viewer quietly breaks.
 *
 * ---------------------------------------------------------------------------
 * DESIGN PRINCIPLE — NEVER DISCARD THE RAW CLASSIFICATION
 * ---------------------------------------------------------------------------
 * Every event keeps the classification its source gave it (`subcategory`), the
 * pipeline that produced it (`origin`), and how much that pipeline could be
 * trusted (`confidence`, `coverage`). That way Entropy can reinterpret events
 * later — new taxonomy, new correlation, new intelligence rule — without
 * reparsing the original log.
 *
 * A concrete example of why this matters: `conversion` healing is the life-siphon
 * bucket today. If a future GW2 patch splits that mechanic, events already stored
 * as `{category: 'healing', subcategory: 'conversion', origin: 'healingStats'}`
 * can be re-bucketed from the existing data. Had we normalized it to a generic
 * "healing" number, that information would be gone.
 *
 * ---------------------------------------------------------------------------
 * CATEGORY TAXONOMY — WHAT EXISTS, WHAT'S DEFERRED, AND WHY
 * ---------------------------------------------------------------------------
 * Implemented, with a normalizer: `damage` (partial — see damageTaxonomy.ts for
 * what's classifiable), `healing`, `barrier` (normalizeHealing.ts), `down` and
 * `death` (normalizeDeaths.ts).
 *
 * Investigated but deliberately NOT added this phase, because no normalizer
 * exists yet to populate them and an empty category is worse than no category:
 *   - `boon` / `condition` — real EI data exists (buffUptimes, conditions
 *     distributions) but normalizing it is separate follow-on work.
 *   - `res` — EI's res-related stats exist per-player but haven't been mapped
 *     to discrete timestamped events.
 *   - `positioning` — deliberately excluded as a CombatEvent category. Position
 *     samples are continuous (one point per poll tick, not discrete
 *     occurrences), so forcing them into a discrete-event model would be the
 *     "artificial classification" the architecture explicitly warns against.
 *     positioning.ts's own `PositioningSummary`/`PositioningFigure` remain the
 *     source of truth for position data; time-correlate against them directly
 *     rather than duplicating positions into CombatEvent.
 *   - `objective` — no normalizer exists; WvW siege/objective data is tracked
 *     elsewhere in the app (see MechanicsView) and hasn't been evaluated for
 *     what a normalized event would even look like yet.
 */

import type { AttributionConfidence, AttributionSource } from '../bridge-metrics/allyIndex';
import type { HealingCoverage } from '../../types/report';

/** Top-level event kind. Deliberately coarse; nuance lives in `subcategory`. */
export type CombatCategory =
  | 'damage'
  | 'healing'
  | 'barrier'
  | 'boon'
  | 'condition'
  | 'crowdControl'
  | 'down'
  | 'death'
  | 'other';

/**
 * Source-assigned classification, preserved verbatim.
 *
 * Only values the source data actually supports appear here. Notably absent:
 * `lifeSteal` under damage — arcdps logs life-steal damage as ordinary strike
 * damage with no distinguishing flag, so emitting that subcategory would be
 * fabrication. See damageTaxonomy.ts.
 */
export type CombatSubcategory =
  // damage
  | 'strike'
  | 'conditionTick'
  | 'breakbar'
  // healing — these three are the addon's own scaling classification
  | 'healingPower'
  | 'conversion'
  | 'hybrid'
  | 'downed'
  | 'regeneration'
  // barrier
  | 'barrierApplied'
  | 'barrierAbsorbed'
  // fallback
  | 'unknown';

/** Which pipeline produced this event. */
export type CombatOrigin =
  | 'eliteInsights'
  | 'healingStats'
  | 'nativeEvtc'
  | 'axiBridge'
  | 'dpsReport'
  | 'combined';

/** What kind of agent an endpoint is. Minions/NPCs are never collapsed into players. */
export type AgentKind = 'player' | 'minion' | 'npc' | 'gadget' | 'unknown';

/**
 * Explicit friendly/enemy attribution for an agent. Never inferred from
 * ambiguous fields (e.g. squad membership alone) -- normalizers must set
 * this deliberately based on how the source data distinguishes sides.
 */
export type AgentSide = 'friendly' | 'enemy' | 'unknown';

export interface CombatAgent {
  /** Character name as logged. */
  name: string;
  /** Account name where known — the stable identity across characters. */
  account?: string;
  profession?: string;
  kind: AgentKind;
  /** Explicit friendly/enemy/unknown attribution. Undefined means not yet classified by the producing normalizer -- treat as unknown, never assume friendly. */
  side?: AgentSide;
  /** EI `players[]` index when this agent is a squad player. */
  playerIndex?: number;
}

/**
 * One normalized combat event.
 *
 * Events may be aggregate rather than instantaneous — an EI distribution entry
 * covers a whole phase. `timestampMs` is null in that case rather than faked, and
 * `hits` records how many underlying occurrences were folded in.
 */
export interface CombatEvent {
  /** Ms from fight start, or null for phase-aggregate events. */
  timestampMs: number | null;
  source: CombatAgent;
  /** Absent for self-targeted or untargeted effects. */
  target?: CombatAgent;

  skillId?: number;
  traitId?: number;
  effectId?: number;
  /** Resolved display name for skill/trait/effect. */
  skillName?: string;

  category: CombatCategory;
  /** The source's own classification, kept verbatim. Never normalize this away. */
  subcategory: CombatSubcategory;

  /** Signed magnitude: positive for damage/healing/barrier dealt. Marker-type events (down/death) use 0. */
  amount: number;
  /** Underlying occurrences folded into `amount`. 1 for instantaneous events. */
  hits: number;

  origin: CombatOrigin;
  /** How far the attribution of this event can be trusted. */
  confidence: AttributionConfidence;
  /** How complete the underlying measurement is. */
  coverage: HealingCoverage;

  /**
   * Source-specific extras that do not belong in the common shape. Anything
   * unverified belongs here with an explicit name — e.g. `overstackValueUnverified`
   * — so a consumer cannot mistake it for a validated figure.
   */
  metadata?: Record<string, unknown>;
}

/**
 * A set of events plus what is known about the set as a whole.
 *
 * Kept alongside the events rather than derived from them, because "no events"
 * is ambiguous on its own: it can mean nothing happened, or that nothing was
 * observable. Those must stay distinguishable.
 */
export interface CombatEventSet {
  events: CombatEvent[];
  origin: CombatOrigin;
  confidence: AttributionConfidence;
  /** Populated whenever confidence is not `high`. Safe to show a user. */
  note?: string;
  /**
   * Magnitude known to exist but not attributable to a specific source/target
   * pair — e.g. healing onto minions occupying unidentified ally slots. Never
   * redistributed across known agents.
   */
  unattributed: number;
}

export const isDamage = (e: CombatEvent): boolean => e.category === 'damage';
export const isHealing = (e: CombatEvent): boolean => e.category === 'healing';

/** Life-siphon healing: derived from damage dealt, not the Healing Power stat. */
export const isLifeSiphonHealing = (e: CombatEvent): boolean =>
  e.category === 'healing' && e.subcategory === 'conversion';

/** Sum `amount`, optionally filtered. Ignores confidence — filter first if it matters. */
export function sumAmount(events: CombatEvent[], predicate?: (e: CombatEvent) => boolean): number {
  let total = 0;
  for (const e of events) if (!predicate || predicate(e)) total += e.amount;
  return total;
}

/**
 * Group events by a key, preserving order of first appearance.
 * Useful for "who healed me", "what killed me", per-skill rollups.
 */
export function groupBy<K>(events: CombatEvent[], key: (e: CombatEvent) => K): Map<K, CombatEvent[]> {
  const out = new Map<K, CombatEvent[]>();
  for (const e of events) {
    const k = key(e);
    const bucket = out.get(k);
    if (bucket) bucket.push(e);
    else out.set(k, [e]);
  }
  return out;
}

/**
 * Stable identity for cross-source deduplication.
 *
 * When the same heal arrives from both Elite Insights and a native EVTC parse,
 * these fields should collide. Timestamp is included only when present — folding
 * a phase-aggregate event together with an instantaneous one would be wrong, so
 * they intentionally produce different keys.
 */
export function eventIdentity(e: CombatEvent): string {
  return [
    e.category,
    e.subcategory,
    e.source.account ?? e.source.name,
    e.target?.account ?? e.target?.name ?? '-',
    e.skillId ?? '-',
    e.timestampMs ?? 'agg',
    e.amount,
  ].join('|');
}

/** Source precedence when the same event appears from multiple pipelines. */
const ORIGIN_PRIORITY: Record<CombatOrigin, number> = {
  nativeEvtc: 5, // closest to the raw log
  healingStats: 4,
  eliteInsights: 3,
  dpsReport: 2,
  axiBridge: 1,
  combined: 0,
};

/**
 * Merge event sets from several pipelines without double-counting.
 *
 * Identical events (same identity) collapse to the single highest-priority
 * origin rather than summing. Events that differ in any identity field are kept
 * separately — this deliberately does not attempt fuzzy matching, because a
 * near-miss is far more likely to be two real events than one duplicate.
 */
export function mergeEventSets(sets: CombatEventSet[]): CombatEventSet {
  const rank = { high: 3, medium: 2, low: 1, none: 0 } as const;
  const byIdentity = new Map<string, CombatEvent>();

  for (const set of sets) {
    for (const e of set.events) {
      const id = eventIdentity(e);
      const existing = byIdentity.get(id);
      if (!existing || ORIGIN_PRIORITY[e.origin] > ORIGIN_PRIORITY[existing.origin]) {
        byIdentity.set(id, e);
      }
    }
  }

  // The merged set is only as trustworthy as its weakest contributing source.
  let worst: AttributionConfidence = 'high';
  let note: string | undefined;
  for (const set of sets) {
    if (rank[set.confidence] < rank[worst]) {
      worst = set.confidence;
      note = set.note;
    }
  }

  return {
    events: [...byIdentity.values()],
    origin: sets.length === 1 ? sets[0].origin : 'combined',
    confidence: sets.length === 0 ? 'none' : worst,
    note,
    unattributed: sets.reduce((s, x) => s + x.unattributed, 0),
  };
}

export type { AttributionConfidence, AttributionSource, HealingCoverage };
