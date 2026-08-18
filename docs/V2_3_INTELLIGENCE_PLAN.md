# Entropy v2.3 — Intelligence Release Plan

Entropy v2.3 is the first release where the CombatEvent foundation becomes visible as actual WvW intelligence rather than only internal plumbing.

## Non-negotiable product rule

Preserve the existing detailed fight viewer. v2.3 adds an intelligence layer beside the current analytics; it does not replace, simplify, or hide the detailed metric views.

## Current baseline on `main`

Already shipped and validated:

- Phase 3 CombatEvent foundation and intelligence types.
- Incoming damage normalizer.
- Enemy spike detector.
- Boon-loss normalizer for Stability/Aegis loss.
- Defensive-failure detector.
- Existing detailed views remain untouched.

Not safely present on GitHub at the start of v2.3:

- Squad Separation detector. A prior Codespace session appears to have authored and tested it, but no pushed branch or PR exists in GitHub. Treat it as missing until it is reintroduced and validated.

## v2.3 release goal

A commander should be able to open a fight and see the first evidence-backed intelligence layer:

- What critical events happened?
- Which events clustered into the same engagement?
- Which engagement was strongest or weakest?
- What evidence supports each claim?

No 0–100 composite scores yet. Evidence first, scores later.

## Scope for v2.3

### 1. Finish Phase 4 Tier 4: Squad Separation

Add a conservative detector that uses existing positioning data to surface squad members who were meaningfully separated from commander/squad during critical windows.

Rules:

- Reuse `positioning.ts`; do not duplicate continuous replay tracking into CombatEvent.
- Require full replay/positioning data when needed.
- Return no findings rather than guessing when positioning coverage is unavailable.
- Emit evidence-backed `CriticalEvent` objects.
- Keep thresholds named and configurable.

### 2. Engagement segmentation

Group CombatEvents and CriticalEvents into meaningful fight segments.

Initial segment signals:

- damage activity windows;
- down/death clusters;
- existing critical events;
- inactivity/regroup gaps;
- positioning evidence where available.

The first implementation should be conservative and deterministic. It should produce segment boundaries and evidence, not prose explanations.

### 3. Segment-level summaries

For each segment, compute:

- start/end/duration;
- critical events inside the segment;
- downs/deaths;
- known damage activity where available;
- participating player keys where available;
- confidence/coverage notes.

Do not duplicate the whole metrics engine.

### 4. First Finding Engine

Convert clusters of segment evidence into simple `IntelligenceFinding` objects.

Allowed finding examples:

- Defensive failure cluster.
- Squad separation before downs.
- Spike followed by mass down.
- Failed recovery cluster.

Every finding must contain evidence and related event references.

### 5. Minimal Intelligence debug surface

Add a developer/user-facing debug surface only after deterministic data exists.

This can be small and unpolished:

- list critical events;
- list engagement segments;
- list findings;
- show evidence and related event ids.

Do not restructure the whole navigation yet.

## Out of scope for v2.3

- AxiForge integration.
- Historical pattern detection.
- AI coaching.
- 0–100 Squad Intelligence scores.
- Full Command Center redesign.
- Large navigation restructure.
- Replacing existing views.

## Acceptance criteria

v2.3 is ready when:

1. Existing detailed fight viewer still works.
2. `npm run build` passes.
3. Full test suite passes.
4. Squad separation is implemented or explicitly deferred with a documented reason.
5. Engagement segmentation has real tests and at least one real-fixture honesty check.
6. Findings are evidence-backed and contain related event references.
7. Missing coverage is represented as unavailable/unknown, never as zero.
8. No unsupported life-steal damage classification is introduced.
9. No `overstackValueUnverified` interpretation is introduced.
10. The new intelligence output is additive and does not remove any existing metric access.

## Recommended implementation order

1. Reintroduce/validate Squad Separation detector.
2. Add engagement segment types/config.
3. Implement conservative segmentation over existing events.
4. Add segment-level summaries.
5. Add finding synthesis from existing CriticalEvents.
6. Add a small debug/inspection view or panel.
7. Run build and full test suite.
8. Open PR and merge only when green.

## Version framing

v2.3 should be marketed internally as:

> The release where Entropy begins grouping combat facts into evidence-backed WvW engagements.

Not yet:

> The full AI commander coach.

That comes after deterministic segmentation and findings are proven.
