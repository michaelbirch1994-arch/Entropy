# Execution Evidence: Captured-File Audit

Date: 2026-09-12. Scope: eight existing EI JSON files under
`.tmp/capture-validation-v011`, from 20260910-152730 through 20260910-153700.
All report parser version 3.28.0.1. No source logs or application metrics changed.

## Reproducible Check

`scripts/audit-execution-input.mjs` accepts EI JSON file paths and emits one
JSON record per file, including SHA-256, parser version and aggregate field
counts. It does not export account or character names. Synthetic tests are in
`scripts/audit-execution-input.test.mjs`.

## Results

There are 41 squad player-fight entries, not necessarily 41 distinct players.

| Signal | Entries with the field/track |
| --- | ---: |
| Replay positions | 41/41 |
| Damage1S series | 41/41 |
| Timestamped rotation casts | 40/41 |
| Stability state track | 25/41 |
| Protection state track | 32/41 |
| Aegis state track | 20/41 |
| Swiftness state track | 36/41 |
| extHealingStats.outgoingHealing1S | 0/41 |

Every detected opening-boon track has a timestamp-zero entry. That establishes
a supplied initial state, not proof of complete pre-fight recording. No malformed
numeric samples or missing Boon classifications were counted for these four
named boons. There are 21 per-player/per-boon timestamps containing distinct
values at the same timestamp. The audit does not resolve their intended order.

No track is not the same as observed zero. Missing tracks may reflect exporter
omission semantics, absence of an effect, or recording limits; these alternatives
require schema/source validation. Do not upgrade them to absence based only on
these counts. Current readiness already treats missing and contradictory states
as unknown. Different values at a shared timestamp may be ordered transitions,
not corrupt data; the conservative treatment remains until verified.

The healing result concerns exactly the inspected field, not all possible EI
healing representations. The damage result establishes a series exists, not
sample completeness, target scope, or sub-second precision. Game-build lookup
in this first audit uses `gw2Build`; null is unresolved metadata, not proof that
the source contains no game-build information under another field.

## Actual Readiness Path

`parseReplayData.ts` reads `player.buffUptimes[].states`, resolves buff metadata,
requires Boon/Condition classification, and copies transitions to replay tracks.
`readiness.ts` reads those tracks with unknown-state handling. Aggregate uptime
and `buffUptimesActive` are not substituted for missing transitions.

The existing effect parser coerces numeric inputs and drops nonfinite samples.
The current audit validates source numeric types more strictly. These files did
not reveal malformed opening-boon samples, but source-invalid transitions can
otherwise disappear before readiness sees them. Preserve this as an ingestion
coverage issue for a separately tested change, not an incidental parser rewrite.

## Engagement Boundary Gate

`src/lib/intelligence/segmentation.ts` already groups timestamped combat and
critical-event signals using inactivity gaps and segment-merging settings.
`engagementTypes.ts` supplies the existing boundary/evidence contract.

Reuse this system rather than implement a second segmenter. However, its activity
clusters are not validated engage-start labels. Before exposing automatic opening
grades, trace the event normalization feeding it, inspect segments on these same
fights, and compare starts with manually reviewed replay moments. Sparse event
streams must not create artificial disengages. Test pre-fight clipping, multiple
pushes in one fight, and uncertainty around a selected boundary.

## Next Planned Step

1. Verify same-timestamp boon transition semantics and absent-track semantics
   against the pinned EI exporter; retain unknowns until established.
2. Trace these files through the actual event normalizer and existing segmenter.
   Record which inputs and boundaries survive ingestion, not just field presence.
3. Validate target scope and sampling of Damage1S before burst synchronization.
4. Keep current manual readiness analysis available without introducing grades,
   invented probabilities, or a new collection requirement.

This completes an initial captured-source inventory, not the entire normalized
pipeline audit or a certification of combat-state completeness.

## Follow-up: Actual Persisted Segmentation Inputs

Ran `scripts/audit-execution-pipeline.test.ts` with
`ENTROPY_EXECUTION_AUDIT_DIR=.tmp/capture-validation-v011`. This opt-in local test
repeats the actual normalization/detection/segmentation calls from
`computePersistedIntelligence` in `buildReportFromFights.ts`. No player identities
are printed. One test passed across all eight files.

| File time | Normalized down/death events | Critical events | Segment windows (seconds) |
| --- | ---: | ---: | --- |
| 152730 | 0 | 1 | 32.100-32.100 |
| 152804 | 3 | 2 | 10.609-28.855 |
| 152845 | 4 | 4 | 0-18.292 |
| 152919 | 0 | 0 | None |
| 153012 | 2 | 1 | 21.630-28.697 |
| 153155 | 0 | 1 | 12.000-12.000 |
| 153447 | 0 | 6 | 4.500-4.500; 22.800-29.400 |
| 153700 | 0 | 0 | None |

The input currently contains only normalized down/death events plus mass-down,
failed-recovery and separation detections. Cast/damage streams are not passed
to this persisted segmentation call. The first segment can be labeled
fight-boundary even though its timestamp comes from the first supplied signal,
not an independently verified fight-start marker.

Conclusion: do not use these segment starts for automatic opening readiness.
Retain them for existing consumers. Next implement an additive, explicitly
labeled execution-window candidate adapter using verified cast/damage inputs,
reusing segmentation primitives only where their semantics fit. Validate against
reviewed replay before calling candidates engagement starts. Do not modify the
existing persisted methodology merely to get automatic windows into the UI.

## Follow-up: EI Boon Export Inspection

Local EI source checkout inspected at commit
`93398d8d3bc4ef9f13bd46a35fcd7635c277b730`.
`GW2EIBuilders/JsonModels/JsonActorUtilities/JsonBuffsUptimeBuilder.cs` exports
`bgm.Values` as `[segment.Start, (int)segment.Value]` in enumeration order when
RawFormatTimelineArrays is enabled. Segment ends are not included.
`BuffGraph.cs` delegates interval storage/fusion to StateGraph.

This establishes the export shape, not a proof that the final duplicate is the
correct positive-duration state for the pinned 3.28.0.1 captures. The local
checkout has not yet been matched to that binary version. Do not apply a generic
last-value-wins rule to arbitrary imported report states. Version matching and
interval/fusion semantics remain open, as do missing-track omission semantics.

## 2026-09-13: Raw Damage Activity Foundation

Added `src/lib/insight/executionActivity.ts`, an isolated raw-EI adapter, not a
replacement for report graphs or existing segmentation. Full-second deltas
require finite nonnegative cumulative values and reject resets. Missing samples,
duplicate identities and unidentified roster members prevent a bin from being
classified as complete. No squad sum padding, coercion, interpolation, or final
partial-second extrapolation is used. Unknown bins split activity candidates.

The existing graph adapter uses Number(value) || 0, so its normalized series
cannot establish whether a zero originated from an invalid source value. This
new measurement deliberately reads raw values without modifying that adapter.

Six synthetic tests and the eight-file pipeline audit passed. All full-second
bins in these particular source files had usable samples for the supplied
roster. This is not a claim of complete combat recording.

Observed candidates include 8-33s in 152730, 0-9s in 152919, and 9-51s in 153700.
The latter two fights had no persisted casualty-based segments. File 153155 had
no positive damage candidate despite a critical event. Several files also had
isolated one-second activity windows, demonstrating why any positive damage
must not be labeled a meaningful spike or engage.

Release gate: this foundation is not yet connected to UI/AI. Next verify target
scope and add meaningful local-burst prominence and cast context. Test sustained
damage and multiple waves before generating execution findings. Candidate start
precision remains one second; no sub-second synchronization claims are supported.

## Experimental Local Peaks (2026-09-13)

The inspected EI JsonActorBuilder calls GetDamageGraph with a null target and
DamageType.All when exporting damage1S. Treat this as all-target damage, not
verified enemy-player pressure. The checkout has not been established as the
exact source version that produced these captures.

executionBursts now identifies strict one-second local maxima above a median
of surrounding samples. Every sample in the surrounding window must be usable
and contiguous. Missing windows, flat peaks, and boundary windows produce no
classification. A zero baseline yields a null ratio, not an infinite score.

The opt-in audit used trial thresholds: two bins on either side, at least 1000
damage, at least 1000 above the neighboring median, and at least twice that
median. These are inspection parameters, not validated coaching standards.

| Capture | Candidate peaks |
| --- | ---: |
| 152730 | 5 |
| 152804 | 3 |
| 152845 | 4 |
| 152919 | 2 |
| 153012 | 6 |
| 153155 | 0 |
| 153447 | 4 |
| 153700 | 4 |

Total: 28 experimental peaks. For example, 152804 has 19,368 damage in 9-10s,
against a neighboring median of 1,681.5. This demonstrates local prominence,
not why the damage occurred or whether teammates synchronized their casts.

Eleven activity/peak unit tests and the eight-capture audit passed. No existing
metrics, parsing, UI, AI prompts, or engagement boundaries were changed.
Next gate: verify target-restricted data, align observed casts with these
intervals, and inspect threshold sensitivity before presenting findings.

## Master Plan Checkpoint and Target Scope (2026-09-13)

This work implements section 7's requirement to compare the same target
population, within delivery step 3. It does not replace step 2 readiness or
introduce cooldown/save probabilities. Readiness, replay context, and evidence
handoff remain the existing vertical slice; real-clip review and release gates
are still required. No automatic performance finding is released by this audit.

The EI JsonPlayer.TargetDamage1S contract is target -> phase -> cumulative
one-second sample. JsonPlayerBuilder indexes targets through Logic.Targets and
calls GetDamageGraph with the corresponding target. The new opt-in adapter
scope selects only enemyPlayer === true from the same raw file. This is an
in-file EI array contract, not a cross-file join by target index or name.

It requires phase zero to span the full fight and target dimensions to match.
Each selected target's delta is validated separately: an increase elsewhere
cannot conceal a counter reset. Missing selected tracks invalidate player bins.
No identified enemy targets means unknown, not a fabricated zero. Unknown target
classifications are counted and excluded, limiting the claimed population to
recorded explicitly classified enemy players. Default all-target behavior stays
available; existing application damage calculations are untouched.

| Capture | Recorded enemy targets | Enemy-player damage | All-target damage |
| --- | ---: | ---: | ---: |
| 152730 | 4 | 66079 | 66079 |
| 152804 | 18 | 45377 | 62761 |
| 152845 | 15 | 27778 | 28167 |
| 152919 | 7 | 37748 | 37748 |
| 153012 | 24 | 173295 | 221888 |
| 153155 | 2 | 0 | 0 |
| 153447 | 1 | 29235 | 81469 |
| 153700 | 5 | 18295 | 56938 |

These totals cover full-second bins only. All eight captures passed phase and
classification checks with no unknown measured bins; this does not establish
complete recording or exact producer-version parity. In 153447, the large gap
shows why all-target peaks cannot be relabeled as enemy-player pressure.

Validation: six new scope tests plus activity, peak, readiness, and handoff
tests (32 total), and the opt-in eight-capture audit passed. Next: preserve this
scope/provenance in peak assessments, inspect cast timing semantics, then compare
observed casts around selected peaks. Multiple-wave assignment, participant
denominators, sensitivity tests, and reviewed clips remain gates before sync
scores or AI execution judgments. No UI/provider/deployment changes in this step.

## Pressure Wave Evidence Surface (2026-09-13)

Insight now persists the experimental local-peak result alongside each compact
activity summary. It stores at most 100 candidates and never retains raw bins in
the report. Each candidate includes its one-second interval, measured damage,
surrounding median, excess damage, ratio, scope, evidence coverage, method, trial
thresholds, and limitations. Existing DPS tables and graph adapters are unchanged.

Squad Execution presents these candidates as **Measured pressure waves**. The
rail prefers the explicitly classified enemy-player scope when that scope has
candidates, otherwise it visibly falls back to all recorded targets. Selecting
a wave synchronizes the shared moment, boon readiness, combat connections,
linked event window, replay, and Player Evidence. The UI calls the result a
strict local maximum, not an engage, coordinated burst, or performance grade.

For the selected one-second interval, Entropy also counts recorded cast starts
using the half-open interval `[startMs, endMs)`. It shows the number of rotation
players who started a cast and, when `damagingSkillIds` is present, the cast
starts whose skill appeared in Elite Insights' fight damage distribution. Skill
icons and names are displayed for inspection. This is timing overlap only: a
cast can resolve after the interval, and inclusion in the damage distribution
does not attribute the measured wave to that cast.

Validation: 38 focused activity, pressure, anchor, handoff, and real-fixture
pipeline tests passed. The production build passed. Browser verification against
the real WvW fixture confirmed that selecting the 0:40 wave moved the shared
moment, damage readout, linked cast window, and surrounding evidence to 0:40.
Desktop and 390px responsive layouts rendered without console errors. The only
browser warning was the expected reduced-motion notice from Framer Motion.

Next gate: evaluate threshold sensitivity on the eight captured fights and add
role-aware cast categories before attempting wave synchronization or missed-
burst findings. Do not derive a coordination percentage from cast counts alone.
