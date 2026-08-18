# Entropy Intelligence Roadmap

Living status doc for the Intelligence Layer effort. Update this file at the
start/end of each phase rather than keeping status only in chat history.

## Status

| Phase | Name | Status |
|---|---|---|
| 1 | Feature audit | Done |
| 2 | (folded into Phase 1 plan) | - |
| 3 | CombatEvent foundation + Intelligence types | Done, verified, pushed |
| 4 | Critical Event Engine + Correlation | Planned (this doc) |
| 5 | Engagement segmentation | Not started |
| 6 | Entropy Intelligence page | Not started |
| 7 | AxiForge expected-vs-observed | Not started |
| 8 | Historical intelligence | Not started |
| 9 | Command Center | Not started |
| 10 | AI coaching | Not started |

## Phase 3 retrospective (what's actually true on `main` right now)

- `CombatEvent.ts`: `down`/`death` added to `CombatCategory`, taxonomy docs added. Verified via `tsc --noEmit` and the full pinned test suite (87/87 passing).
- `normalizeDeaths.ts`: emits real-timestamp down/death events, gated on `classifyDegree() === 'full'` (same gate the existing Fight Replay view uses). Verified against the repo's one real fixture, `wvw-modern-ei.json` — that log is `coarse` degree (no full positional replay), so it correctly returns `confidence: 'none'` with zero events. **This means down/death timing has not yet been exercised end-to-end against real non-empty data.** If most real WvW logs lack full replay, Phase 4 features built on top of down/death timing will have limited real-world coverage until that's characterized further.
- `agentIdentity.ts` / `resolveAgentIdentityKey()`: stable identity keys distinct from `eventIdentity()`. 11 tests passing.
- `timeWindow.ts`: `eventsInWindow`, `eventsBetween`, `eventsBefore`, `eventsAfter`, `sortByTime`, `timestamped` — generic correlation primitives, no domain logic. This is the foundation Phase 4's correlation engine builds on.
- `intelligence/types.ts`: `IntelligenceFinding`, `CriticalEvent`, `Correlation`, `Pattern`, `Recommendation` types exist; zero detection logic yet (by design).
- `inspector.ts`: debug/inspection helpers, not wired into any UI yet.
- No normalizer exists yet for **damage** or **boons** as event streams — `bridge-metrics` has aggregates for both, but there's no flat timestamped stream the way `normalizeDeaths.ts` provides for down/death or `normalizeHealing.ts` provides for healing. This gates part of Phase 4 (see tiering below).

## Phase 4 plan: Critical Event Engine + Correlation

Per the spec: build the event timeline, detect critical events with evidence
chains, build the correlation engine, all before touching engagement
segmentation, the Intelligence page, or scores.

### Ordering rule

Do not write a detector against data that doesn't exist as a normalized
stream yet. Build normalizers first, tier by tier, and only implement
detection logic once real events are flowing.

### Tier 1 — buildable now (down/death events already exist)

New file: `src/lib/intelligence/criticalEvents.ts`

- **Mass Down** — N downs within a short window (`eventsInWindow` over `downEvents()`).
- **Kill Conversion** — for each down with a linked death, walk `timeWindow` around it to see if pressure (more downs/deaths on the same or nearby players) continued; classify down-only vs down-into-kill.
- **Failed Recovery** — down with a linked death and a `timeToDeathMs` above some threshold (rally window passed, no rally happened).

New file: `src/lib/intelligence/correlation.ts` — generic relationship
helpers on top of `timeWindow.ts`: `withinSeconds(a, b, windowMs)`,
`beforeEvent(a, b)`, `afterEvent(a, b)`, `sameTarget(a, b)`, `samePlayer(a, b)`,
`affectsAtLeast(events, n)`. No detector-specific logic lives here.

Caveat carried over from Phase 3: on logs without full replay data, Tier 1
detectors will correctly find nothing (empty, not fabricated) rather than
silently degrade to guessing.

### Tier 2 — needs a new normalizer first: incoming damage stream

Before "Enemy Spike" can be built, `src/lib/combat/normalizeDamage.ts` needs
to exist, reusing `bridge-metrics/damageTaxonomy.ts` conventions (the same
place Life Siphon's damage-side ambiguity is already documented) so this
normalizer inherits the existing "don't fabricate a classification the
source doesn't support" rule rather than re-litigating it.

Only after that: **Enemy Spike** detection (sudden incoming-damage increase,
affected player count, peak, duration, concentration, resulting downs/deaths).

### Tier 3 — needs a new normalizer first: boon uptime/loss stream

Before "Defensive Failure" can be built, a boon-loss normalizer needs to
exist (Stability/Aegis loss events, timestamped). `boonGeneration.ts` in
bridge-metrics has aggregate boon uptime; nothing currently exposes boon
state transitions as discrete events.

Only after that: **Defensive Failure** detection (Stability loss, Aegis/
defensive coverage loss, barrier collapse, major incoming burst, defensive
cooldown availability where data exists).

### Tier 4 — needs full replay data (same gate as down/death)

**Squad Separation** — distance from squad/commander, isolated player count,
duration separated, whether separation preceded damage/down/death. Reuses
`positioning.ts`'s existing distance-from-commander data rather than
duplicating position tracking into CombatEvent, per the "positioning stays
continuous samples, not discrete events" rule from
`COMBAT_EVENT_ARCHITECTURE.md`. Subject to the same `full`-degree-only
availability caveat as down/death timing.

### Evidence chain requirement (non-negotiable, per spec)

Every `CriticalEvent`/`IntelligenceFinding` must carry `relatedEvents` that
resolve back to real `CombatEvent`s via `eventIdentity()` — this is already
enforced structurally by the Phase 3 types (`intelligenceTypes.test.ts`
proves a Finding can reference a real event identity), but Phase 4 detectors
must actually populate it for every field, not just the id.

### Suggested implementation order for Phase 4

1. `correlation.ts` (pure functions over existing `CombatEvent[]`, no new normalizers needed) + tests
2. Tier 1 detectors (`criticalEvents.ts`: mass down, kill conversion, failed recovery) + tests against both synthetic fixtures and the real `wvw-modern-ei.json` fixture (documenting expected empty/non-empty results honestly)
3. `normalizeDamage.ts` + tests, reusing `damageTaxonomy.ts` conventions
4. Enemy Spike detector + tests
5. Boon-loss normalizer + tests
6. Defensive Failure detector + tests
7. Squad Separation detector (Tier 4, lowest priority given real-data coverage caveat)

### Explicitly out of scope for Phase 4

Engagement segmentation, the Entropy Intelligence page/UI, 0-100 scores,
AxiForge integration, Command Center, AI coaching. Per the user's own
sequencing (Phase 5 onward) and the existing "no scores yet" rule from
Phase 3.
