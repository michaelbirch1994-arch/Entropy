# CombatEvent & Intelligence Architecture

This document describes the layers Entropy's combat data passes through, from
raw log to (eventually) a recommendation a commander can act on. It exists so
future work lands in the right layer instead of leaking responsibilities
across layers — the single biggest way this kind of system rots.

```
Raw Data
   |
Existing Entropy Parsers   (parseEvtc.ts, dpsReport.ts, buildReportFromFights.ts)
   |
Metrics                    (bridge-metrics/*)
   |
CombatEvent                (lib/combat/*)
   |
Correlation                (lib/combat/timeWindow.ts + future correlation engine)
   |
Critical Events            (future: lib/intelligence/events.ts)
   |
Intelligence                (future: lib/intelligence/*, using types.ts)
   |
Recommendations            (future, built on Finding/Recommendation types)
```

## What belongs in each layer

**Parsers collect facts.** `parseEvtc.ts`, `dpsReport.ts`, and
`buildReportFromFights.ts` turn a raw log (native EVTC or an Elite Insights /
dps.report JSON payload) into the `Report` type. A parser's job ends at "what
does the log say" — it does not decide what's important.

**Metrics aggregate facts.** `bridge-metrics/*` takes a `Report` and produces
per-player, per-squad totals: damage, healing, boon uptime, positioning
summaries, role classification. This is the layer almost every existing view
(`OverviewView`, `OffensiveView`, `SquadStatsView`, etc.) reads from, and it
is not going away or being rewritten — it is the mature, validated engine.

**CombatEvent normalizes facts.** `lib/combat/*` re-reads the same `Report`
(or the same raw `details` payload) that `bridge-metrics` reads, but produces
a flat, typed, timestamped-where-possible EVENT STREAM instead of
pre-aggregated totals. This is a second, additive pass over the data — it
does not replace `bridge-metrics`, and nothing in the existing UI depends on
it. It exists because `bridge-metrics`'s aggregates cannot answer
time-relative questions ("what happened 2 seconds before this down?"); an
event stream can.

Every normalizer in this layer follows the same rule established by
`normalizeHealing.ts`: never invent data. If a source doesn't distinguish
something (life-steal damage, overheal, `overstack_value`'s true meaning),
the normalizer says so explicitly (`not-available`, `*Unverified` naming) —
it does not guess. See `damageTaxonomy.ts` and `dataIntegrity.ts` for the
established examples of this pattern; every new normalizer should read like
they do.

**Correlation connects facts.** `timeWindow.ts` (this phase) provides generic
primitives — "events near this timestamp", "events between two timestamps",
"events before/after" — that operate on any `CombatEvent[]`. It has no
opinion about what a "spike" or a "stability gap" is. A future correlation
engine will use these primitives to build those specific relationships, but
that decision logic lives one layer up.

**Intelligence interprets facts.** The types in `lib/intelligence/types.ts`
(`IntelligenceFinding`, `CriticalEvent`, `Correlation`, `Pattern`) define what
a conclusion looks like, but this phase implements no logic that produces
one. A Finding is only as good as its `evidence` array — every field on
`IntelligenceFinding` down to `evidence` must trace back to real computed
data, never to a plausible-sounding assertion.

**Recommendations explain what to do.** A `Recommendation` must reference at
least one `Finding` id via `basedOn`. There is currently no code that
constructs one automatically — that's deliberately future work, once Findings
themselves have real detection logic behind them.

## Identity: two different questions, two different answers

`eventIdentity()` (CombatEvent.ts) answers "is this the same EVENT" — used
for cross-source deduplication in `mergeEventSets`. Its behavior is pinned by
existing tests and is not changed by this phase.

`resolveAgentIdentityKey()` (`agentIdentity.ts`, new this phase) answers "is
this the same AGENT" — used for grouping everything that happened to one
player/NPC across a fight. These are different questions with different edge
cases (duplicate display names, minions/pets/gadgets with no account,
anonymous agents) and are kept as separate functions rather than one
overloaded utility.

## Confidence vs. coverage vs. pattern confidence

Three related but distinct concepts appear across this codebase — do not
conflate them:

- **`AttributionConfidence`** (`allyIndex.ts`) — how well a specific
  attribution (this healer did this much healing to this target) is
  mathematically validated against the source data. `high` / `medium` /
  `low` / `none`.
- **`HealingCoverage`** (`types/report.ts`) — how COMPLETE the underlying
  measurement is (e.g. did the target run the healing addon). `full` /
  `partial`.
- **`PatternConfidence`** (`intelligence/types.ts`, new this phase) — how
  strong a claimed RELATIONSHIP between events is, once the intelligence
  layer starts making claims. `insufficient-evidence` / `correlation` /
  `strong-correlation` / `likely-causal`. This is not implemented by any
  logic yet in this phase — only the type exists.

A Finding can be built from high-`AttributionConfidence`, `full`-coverage
data and still only warrant a `correlation`-level `PatternConfidence` claim —
the data being trustworthy does not make the pattern claim strong.

## What this phase deliberately does not do

Per the Phase 3 scope: no critical-event detection algorithms, no engagement
segmentation, no squad scoring, no Command Center UI, no AxiForge
integration, no historical pattern learning, no AI coaching. Those are later
phases that consume the types and primitives built here.
