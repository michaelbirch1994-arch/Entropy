# Entropy Intelligence Nervous System — Implementation Contract

## Core value

Entropy remains a detailed combat/log viewer first. Intelligence must deepen and connect the existing viewer; it must not replace, simplify, or fork the authoritative metrics, tables, fight breakdowns, replay, player aggregation, or source-specific coverage rules.

## Objective

Turn the existing Intelligence tab into an interactive combat-event investigation system where a commander can move continuously between:

1. raid-level findings and event clusters;
2. a specific fight;
3. a precise timestamp or time window;
4. the players/events involved;
5. the underlying Entropy views that contain the source evidence.

The system should feel like a nervous system running through Entropy, not a separate analytics product.

## Evidence hierarchy

Intelligence must preserve four distinct levels:

- **Combat evidence** — raw/normalized events and existing metrics.
- **Critical event** — a timestamped occurrence worth surfacing.
- **Finding/correlation** — an evidence-backed relationship between events.
- **Interpretation/pattern** — a higher-level claim that must expose supporting fights, samples, confidence, and counter-evidence where available.

No higher level may erase or replace the lower level.

## First implementation slice

Deepen the current Intelligence dashboard rather than creating a parallel page:

- every critical-event row becomes selectable;
- selection opens an event inspector inside the Intelligence view;
- inspector exposes exact fight context, timestamp, category/kind, confidence, involved player keys, related event identities, and the original event summary;
- inspector builds a bounded review window around the event (initially ±15 seconds unless the event/segment already supplies a narrower supported window);
- related findings and engagement segments are shown when they already exist;
- no unsupported boon, healing, positioning, CC, or damage detail is invented merely to fill the inspector;
- the inspector identifies which existing Entropy source views can support further investigation, but source-view deep links are added incrementally as those routes/selection contracts are verified.

## Navigation contract

Every inspectable Intelligence item should eventually resolve to a shared evidence reference containing only identifiers/context, not duplicated metric calculations:

- `fightId`
- `anchorTimestampMs`
- `startTimestampMs`
- `endTimestampMs`
- `playerKeys[]`
- `eventIds[]`
- optional `segmentId`
- optional `findingIds[]`
- verified source-view destinations

Existing metric calculations remain authoritative in their current analytics/data paths.

## Accuracy rules

- Missing data is unavailable, never zero by assumption.
- Healing coverage and attribution confidence remain separate.
- `overstack_value` remains unverified unless independently validated for a specific use.
- Correlation is not causation.
- Prediction is not shipped until repeated historical evidence supports it.
- Archived/legacy reports must degrade gracefully and disclose missing timestamp-level evidence.
- Event windows must use actual fight-relative timestamps; no synthetic timing presented as real evidence.

## Acceptance criteria for slice 1

1. A commander can click an existing critical event in Intelligence.
2. The selected event remains tied to the correct fight and timestamp.
3. The inspector shows all currently persisted event/player identifiers without fabricating unavailable context.
4. Related findings/segments are discoverable from the event when already supported by current data.
5. The inspector exposes a clearly labeled before/after review window around the event.
6. Existing viewer routes and metric tables are unchanged.
7. Typecheck, production build, and tests pass before merge.

## Follow-on slices

After slice 1 is proven:

1. verified deep links to Fight Replay, Death Recap, Fight Breakdown, Buffs, Defensive, Offensive, Support, and Top Skills;
2. synchronized before / event / after evidence tracks;
3. grouped combat episodes using existing engagement/critical-event infrastructure;
4. fight narratives assembled strictly from supported episode evidence;
5. cross-fight recurring patterns and historical comparisons;
6. predictive risk only after sufficient repeated observations exist.
