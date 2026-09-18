# Insight: Squad Execution and Loadout Evidence

Planning revision: 2026-09-12. Refines the user's
`Entropy_Insight_Loadouts_Master_Prompt.txt`; the original is unchanged.
This is the proposed direction for subsequent Insight development, not a claim
that these features or addon capabilities are already implemented.

## 1. Product Direction

Insight should answer four questions, in this order:

1. What happened during this engagement?
2. What did the squad execute well or poorly, according to a stated measure?
3. What evidence supports that interpretation, and what is missing?
4. What is one useful adjustment to test in the next session?

Lead with squad execution. Reveal subgroup and player evidence on demand.
Preserve existing metrics, parsing, Raw, replay, Builder, and investigation tools.
Do not turn Insight into a new damage leaderboard or replace working systems.

Core principle:

> Deterministic analytics measure recorded behavior. AI explains the supported
> findings, competing explanations, and limitations. Neither proves intent or
> preventability merely by correlating events.

This is a refinement of "AI explains what analytics proved": deterministic
code can still operate on incomplete evidence or use an imperfect model.

## 2. Two Tracks, Separate Release Gates

### Track A: Useful squad coaching now

Deliver one complete vertical slice: engagement selection, boon readiness,
inspectable evidence, replay navigation, and optional AI explanation. Then add
burst/well/control alignment and recovery patterns as coverage permits.

### Track B: Loadout evidence research

Start the feasibility audit early, alongside Track A. Do not defer discovery of
the most uncertain dependency until after building a large historical database.
Do not make squad analytics depend on a new DLL or every player installing one.

Research is not permission to copy an addon, inspect undocumented memory,
intercept private traffic, or mutate existing combat logs. Select a documented,
permitted acquisition path before production integration.

## 3. Preliminary Repository Check

This is a source-level orientation, not the completed per-fixture data audit.
AVAILABLE means an existing representation/path exists; it does not promise
that every uploaded fight contains the signal.

| Signal or capability | Current starting point | Status and limit |
| --- | --- | --- |
| Fight joins, casts, mechanics, survival | `src/lib/insight/combatConnections.ts` | AVAILABLE by fight ID; coverage varies by report |
| Damage curves | Same module, `stats.dpsGraph` | PARTIAL: current consumer uses one-second cumulative points and five-second rolling rates; no demonstrated 250 ms damage resolution |
| Boon/condition states | `effectSpans`, `src/lib/parseReplayData.ts` | PARTIAL: state tracks exist; intervals before first observation remain unknown |
| Position and survival tracks | `src/lib/parseReplayData.ts` | PARTIAL: validate sampling gaps, coordinate units, membership, and encounter identity |
| Real hostile AoE footprints | Replay's cast markers | UNAVAILABLE in the inspected marker representation: its comment explicitly says cast markers are not real effect footprints |
| Healing timeline in Connections | `coverage.healingTimeline` | UNAVAILABLE in this consumer; currently false, despite available aggregate healing |
| Engagement structures | `src/lib/intelligence/engagementTypes.ts` | AVAILABLE: reuse boundaries/configuration; verify existing segmentation execution before adopting it |
| Findings and evidence | `types.ts`, `findingEngine.ts` under `src/lib/intelligence` | AVAILABLE: reuse rather than invent an unrelated findings engine |
| Raw callback capture and encounter binding | `rawCapture.ts`, `rawEncounter.ts`, `rawStory.ts` | PARTIAL: additional observations exist; identity, timing, and retention constraints still apply |
| Companion interchange | `companionRecording.ts` | AVAILABLE validation structure; acceptance of a field does not establish that the DLL can observe it |
| Loadouts-derived gear capture | Not established by this pass | UNVERIFIED: no field promised until acquisition and round-trip tests succeed |

Audit raw source -> normalizer -> report field -> actual consumer for each
signal. Record fixture hash, source/parser versions, account/time coverage,
units, sample resolution, missing intervals, and exact unsupported cases.
Older project documents contain historical status statements; verify code and
real captures rather than treating those statements as current capabilities.

## 4. Evidence Contract

Every derived metric must retain:

- Fight, engagement, actor identity, clock basis, and time range.
- Source references and source/parser/collector versions.
- Measured resolution and clock-alignment uncertainty.
- Eligible, observed, excluded, and unknown participants, with reasons.
- Known recording gaps; duplicate/conflicting-source handling.
- Algorithm version and configuration fingerprint.
- Game-facts revision when mechanics, rather than direct observations, are used.

Never promote aggregate uptime to a timestamped boon state. Never interpolate
damage to manufacture finer observations. Do not join actors by display name
alone, join fights by array index, or equate a callback address with a stable
player identity across sessions.

Recording retention is not a statistical random sample. A truncated capture
cannot justify scaling observed events into estimates of missing events.

## 5. Quantification Without False Precision

Separate these four concepts in the data contract and UI:

1. Measurement: e.g. 12/15 observed eligible players had Stability at time t.
2. Coverage: e.g. states were known for 15/20 eligible players, or 75%.
3. Uncertainty bounds: full eligible-squad coverage is 60%-85%, given five unknowns.
4. Probability: permitted only for a defined outcome backed by a calibrated,
   versioned model with held-out evaluation and a documented population.

Do not convert HIGH/MEDIUM/LOW to arbitrary 90/65/30% values. Do not call the
percentage of completed checks a probability of readiness or a successful save.
Prefer precise counts, ranges, and time offsets to vague confidence prose.
Keep observed/calculated/inferred/unknown as separate evidence status.

Severity is also separate: a large measured gap is not automatically a critical
failure, and an incomplete measurement is not a low performance score.

## 6. Engagement Windows and Participation

Reuse the existing engagement system and test whether its boundaries represent
the behavior under study. A first recorded event or first down is not necessarily
the engage. Report detection method, boundary uncertainty, and supporting events.

Attach pre-engage, initial execution, pressure, recovery, and re-engage windows
only when supported. Allow a user-selected analysis window as an explicitly
annotated override, not a silent edit to the underlying combat methodology.

Evaluate alternate boundary placements when timing uncertainty could change the
result. Mark threshold-sensitive findings rather than choosing the worst value.

Use time-local squad/subgroup membership where observed. Unknown membership
stays unknown. Show an all-squad outcome view and an actionable participant view
so excluding dead, downed, late-joining, or disconnected players does not hide
the very execution problems being investigated.

Current implementation checkpoint: newly imported replay tracks persist EI's
selected-fight subgroup value. Utility-effectiveness scopes prefer those values,
limit membership to accounts evidenced in that fight, and disclose fight-replay,
mixed, or report-aggregate subgroup provenance. Older reports remain compatible
through the aggregate fallback. This is fight-local, not time-local: EI exposes
one subgroup value for the player in that fight, so mid-fight swaps remain
unverified and must not be described as exact-moment membership.

Role estimates must be visible and correctable as analysis annotations. An elite
specialization or low damage does not prove a support build.

## 7. Initial Measures

### Opening boon readiness

Begin with Stability, Protection, Aegis, and Swiftness, individually selectable.
These are analytical defaults, not a universal mandate for every engagement.

At t, let N be eligible players, K those with known state, and P known present:

- Observed coverage = P/K, undefined when K = 0.
- Evidence coverage = K/N, undefined when N = 0.
- Full-squad possible bounds = [P/N, (P + N - K)/N].

Compute point coverage separately from readiness continuity over a window:
known boon-present player-ms / known eligible player-ms. Expose the corresponding
unknown player-ms. Distinguish present at engage from gained just after engage.
Do not use "present anywhere within +/-500 ms" as proof of pre-engage readiness.

Show Stability stack counts when observed. Absence of Aegis can follow a block;
absence of a boon does not establish that its provider failed to apply it.

### Damage synchronization

Analyze damage against the same target population and within the same execution
window. Separate enemy-player damage from other targets where the source permits.
Use un-smoothed source bins for calculations, with smoothing only for display.

For cumulative observations D(t), bin damage = D(t_next) - D(t). Missing points,
counter resets, or invalid intervals are unknown, not zero. Candidate peaks need
minimum absolute prominence and a robust local baseline; a zero median must not
cause division by zero or make negligible hits qualify as spikes.

For one assigned burst per participant per execution wave:

- Center = median participant burst time.
- Offset_i = burstTime_i - center.
- MAD = median(abs(offset_i)).
- Central spread = P95(burstTimes) - P5(burstTimes), with quantile method fixed.
- Within-window share = count(abs(offset_i) <= tolerance)/participantsWithBurst.
- Burst participation = participantsWithBurst/eligibleDamageParticipants.

Report both shares; dropping non-bursting players must not inflate the sync score.
Report sample size and uncertainty from bin width. Do not publish sub-second
judgments from one-second bins. Separate multiple waves instead of forcing two
valid pushes into one poorly synchronized cluster. Condition ticks and projectile
travel can separate cast timing from damage timing; do not infer button delay.

### Wells and control

Use one versioned skill-family registry, initially a small reviewed list, with
aliases, profession variants, activation semantics, and WvW rules where verified.
Distinguish cast start, completion, persistent-effect activation, and observed
control application. Deduplicate repeated hit/pulse records before counting casts.

Report well timing and placement independently. A caster's location is not a
ground-targeted well's center. No real footprint means no placement score.

CC alignment = eligible control casts in the verified active well window /
eligible control casts in the execution window. Keep cast attempts and observed
target control in separate measures. If active duration is unverified, report
cast-to-cast offset instead, not active-window overlap. Report whether control
leads, overlaps, or follows; intentional setup control need not be late execution.

### Recovery coordination: an added priority

Measure down-to-recovery time, overlapping downs, second downs after recovery,
and deaths during recovery windows. Separate observed revive, rally, and unknown
recovery mechanisms when the source permits; do not invent the mechanism.

Relate recovery windows to known pressure, boon coverage, positions, and recorded
support activity. A teammate's hypothetical unused skill remains a separate
experimental analysis, not the explanation for the recovery outcome.

### Cohesion and hostile AoE: gated by spatial evidence

For cohesion, show median and P90 distance to the verified commander or explicitly
labeled squad center, eligible count, and position coverage. Avoid rewarding a
tight stack universally: movement phase, split roles, and terrain matter.

AoE analysis requires verified hostile ownership, shape, active intervals,
coordinate system, and player positions. Clip exposure to valid observations;
do not interpolate through large gaps or turn visual replay decorations into hits.

Exposure duration and exit latency are different. Someone outside at activation
has no evacuation latency; someone entering later has time-since-entry exposure.
No observed exit before data ends is censored, not zero or a completed evacuation.
Track control/downstate during exposure and overlapping fields without counting
the same player-time twice in total exposure. Geometry alone is not damage proof.

## 8. Findings and AI

Extend existing `IntelligenceFinding`/`Evidence` through a narrow companion
assessment structure instead of breaking existing consumers. Proposed additions:

```ts
interface ExecutionAssessment {
  findingId: string; // Existing finding link
  engagementId: string;
  methodVersion: string;
  configHash: string;
  evidenceStatus: 'observed' | 'calculated' | 'inferred' | 'unknown';
  coverage: { eligible: number; observed: number; unknown: number };
  measures: Array<{
    id: string;
    unit: 'ms' | 'fraction' | 'count' | 'game-units';
    value: number | null;
    bounds?: [number, number];
    numerator?: number;
    denominator?: number;
    resolutionMs?: number;
  }>;
  limitations: string[];
  sourceRefs: string[];
}
```

This is a design sketch, not a replacement type or deployed API. Validate units,
ranges, identities, and references at runtime. Reuse existing reference and
confidence types where they already satisfy these needs.

AI receives selected structured findings, relevant context, and allowed evidence
references. It may summarize, contrast, explain limitations, and suggest a
testable adjustment. It may not invent percentages, skills, intent, or outcomes.

Generate numerical claims from the measures in code. Require AI citations to
resolve to the selected evidence and validate response structure and claims.
Treat names, log text, and imported descriptions as untrusted data, not prompts.
Evaluate citation correctness, unsupported causal claims, useful specificity,
and agreement with labeled reviews. Mock responses test UI, not model accuracy.

Findings and replay remain useful without an API key. Clearly distinguish local
analysis from AI explanation; never label a deterministic fallback as AI.
Send bounded, selected evidence on demand, with provider disclosure and privacy
controls. Cache by source/config/model version and invalidate stale findings.

## 9. One Cohesive Insight Workspace

Use one analysis context: report -> fight -> engagement. Do not add sidebar tabs.

- Top: a concise squad execution summary with strongest findings and successes.
- Center: a synchronized engagement timeline for boons, damage, casts, control,
  survival, and recovery, showing genuine gaps rather than continuous fiction.
- Right: one evidence inspector that changes with selection, not stacked windows.
- Bottom or expanded detail: subgroup comparisons, contributor offsets, source
  records, and replay navigation retaining the selected fight/time/player.

Each finding answers: measured result, denominator, comparison, evidence,
alternative explanations, and one suggested practice. Label examples/synthetic
data explicitly. Use existing theme, icons, and replay components; retain clear
contrast, keyboard operation, reduced motion, and responsive dimensions.

Keep existing individual investigations accessible without making them the default
squad narrative. A separate experimental marker can identify assumption-based
response checks. Preserve their implementation until replacement is validated.

## 10. Baselines and Actionable Learning

Start with descriptive numbers, not Excellent/Poor grades or a composite squad
score. Prototype 3 s pre-engage and 5 s initial-execution windows as configurable
analysis settings, not game rules. Test sensitivity before promoting defaults.

Build per-squad historical comparisons only from compatible measurement versions,
source coverage, game modes, relevant roles, and comparable encounter contexts.
Show baseline sample count and spread. Small or biased samples cannot establish
population norms. Do not rank guilds using uploads that overrepresent successes.

Track repeated findings across engages and sessions, positive execution as well
as gaps, and the next practice goal. A before/after improvement is descriptive;
it is not proof that the suggestion caused a win. Avoid a flood of correlated
alerts by grouping findings supported by the same event cluster.

## 11. Loadouts Research and Safe Transport

The named Nexus Loadouts project, its source/license, its acquisition mechanism,
field availability, and extension interoperability are UNVERIFIED in this pass.
Produce the technical research report requested by the original brief before
production collection. Audit the exact project and version, not a similarly
named addon. Verify public interfaces and current compatibility constraints.

For each field, record source, local-versus-remote visibility, timestamp semantics,
freshness, restrictions, reliability, and a reproducible observation. A saved
template or account API response is not necessarily the active in-fight loadout.
Being able to inspect the local player does not establish squad-wide visibility.

Remote loadouts require a verified permitted mechanism or explicit opt-in sharing.
Unsigned participant submissions are attributed claims, not authenticated truth.
No silent inference that Firebrand/Druid meta assumptions are equipped facts.

Prefer officially supported addon interfaces and documented extension emission.
Investigate runtime extension records that the logger writes into EVTC; do not
patch finished original ZEVTC archives in place. Keep the current JSONL sidecar
as a fallback and test harness. An explicit export bundle can carry original log,
manifest, and sidecar if embedded records are unsupported; label that alternative
honestly rather than claiming the original ZEVTC is self-contained.

Test EI with known and unknown records: parse success, treatment of the payload,
normal metric parity, and whether original records survive generated output.
If EI discards them, decode the original log separately and merge verified
identity/time associations. Never assume a report URL/JSON retains extensions.

Snapshot design must include schema/source versions, game build/mode, session and
scoped actor identity, clock basis, observed/effective times, field-level unknowns,
freshness, and provenance. Unknown, unequipped, and unchanged are distinct values.
Use stable IDs with explicit namespaces; an item ID is not a weapon-set state.

For multi-record payloads, specify framing, snapshot ID, part count/order, size
limits, checksum, duplicate/conflict handling, and missing-part rejection. A
checksum detects corruption, not sender authenticity. Never reserve an arbitrary
signature without checking the documented allocation/compatibility process.

Use a complete baseline plus validated deltas; re-emit a baseline at each log
boundary so a new file can stand alone. Missing a delta invalidates affected
state until a fresh baseline. Active weapon swaps are runtime state, not equipment
replacement. Avoid indefinite carry-forward across reconnects or capture gaps.

Prototype gate: one consenting local player, one controlled fight, available
profession/spec/traits/relic/sigils fields -> supported log records -> another
machine decodes only the resulting log -> unique matching to the EI player.
Unavailable fields stay absent; any reduced test must be labeled partial.
Test a mid-session change, dropped fragment, unknown schema, ambiguous identity,
truncation, and coexistence with other extensions before expanding scope.

Measure actual bytes/fight and callback overhead. Bounded asynchronous queues,
loss accounting, no callback disk/network work, safe unload/reconnect behavior,
transparent capture settings, and data minimization are release requirements.

## 12. Historical State, Later

Store observed IDs plus game build/mode; resolve mechanics using immutable facts
with provenance, effective ranges, and explicit unknown history. Fetch time is
not a historical effective date. Unknown historical rules cannot be silently
filled with current rules. Start with mechanics required by a small tested model,
not a speculative complete combat simulator.

Readiness needs more than last cast: charge/ammo state, activation versus recharge
start, resets, modifiers over time, profession resources, transforms, weapon-set
access, interrupted casts, and missing pre-log history. Integrate time-varying
recharge rules rather than dividing fight length by base cooldown.

For an assistance opportunity, keep separate: suitable effect, equipped/accessed,
ready, actor able to act, reach, target eligibility, reaction/cast travel time,
and observed action. Readiness does not prove line of sight, actual target choice,
or that the skill would have saved someone. Endurance should use defensible
bounds until directly validated. Promote probabilities only after calibration.

## 13. Delivery Sequence and Acceptance

1. Audit and capability map: verify real ingestion paths on representative files,
   particularly timing resolution, effect coverage, source gaps, and agent binding.
   Deliver per-signal evidence, not a theoretical API inventory.
2. Opening readiness vertical slice: reuse engagements, implement denominators and
   unknown bounds, inspect a finding, jump to replay, optionally explain with AI.
3. Burst and well timing: separate waves, participation, resolution-aware offsets,
   and role annotations; validate with real manually reviewed engagement clips.
4. Control and recovery: attempts versus effects, wave alignment, down/recovery
   timelines, and deduplicated connected findings.
5. Position/AoE: ship only metrics whose spatial inputs pass capability gates.
6. Session learning: comparable baselines, repeated patterns, and practice goals.
7. Loadout track: research can start during step 1; collector changes require the
   separate acquisition, compatibility, and round-trip gates above.
8. State reconstruction: small version-correct models, interval bounds, measured
   error, then validated individual opportunity analysis.

New code should be additive under `src/lib/insight/execution/` only where existing
modules cannot serve the purpose: capability adapter, readiness calculations,
and assessment orchestration are candidate modules, not a mandated rewrite.
Reuse `lib/intelligence`, `lib/combat`, Connections, evidence rendering, and replay.
Add registry/facts/transport modules only at the phase that needs them.

Test numerical outputs, not just copy: zero/partial/full boon observations,
boundary uncertainty, unknown initial states, empty denominators, truncated
capture, sample-resolution limits, two waves, sustained output, missing players,
duplicate pulses, control attempts without effects, censored exposure, identity
collisions, delta loss, incompatible history, and unsupported extension versions.

Keep golden existing-report totals and replay navigation tests unchanged. Verify
large-file memory/latency, canceled work, desktop/mobile layouts, accessibility,
AI failure states, and stale-analysis invalidation. Release behind an isolated
Insight feature switch until reviewed real fixtures and regressions pass.

## Immediate Next Work

Shift Insight priority from increasingly speculative individual cooldown verdicts
to the opening-readiness vertical slice. Finish the capability audit first; show
actual missing inputs and bounds. Continue Raw decoding when it supplies verified
evidence for these measures, rather than treating more raw fields as the product.

No parser changes, new collection, AI provider calls, deployment, or DLL
replacement are authorized merely by the existence of this planning document.
