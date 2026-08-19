# Entropy v0.2.58

v0.2.58 is the feedback/correctness release following the recovered v0.2.57 mainline. It focuses on trustworthy combined-log statistics, clearer participation context, better log workflow, and evidence-backed drilldowns.

## Correctness

- Stable account-level aggregation across fights, profession swaps, character swaps, role changes, subgroup changes, and partial attendance.
- Squad Roster Overview keeps one player row while preserving profession history.
- Healing, cleanses, strips, damage, downs, and participation follow consistent identity rules.
- Death Recap sorting cycles predictably without detaching row details.
- Player-specific active/combat time is used for rate calculations where an honest player denominator exists; squad summary totals are not forced into misleading `/s` values.
- Unsupported/source-dependent columns are gated instead of appearing as unexplained blanks.

## Statistical context

- Combat/active time, fights joined, total fights, participation coverage, and sample reliability are exposed across the major performance views.
- Low-duration and low-fight samples are flagged instead of being presented as equally reliable.
- Top Skills and Healing Sources include min/average/max per-fight context, sample size, peak-fight context, active-time rates, and spike-heavy warnings.

## Buff Generation

- Buff Generation now answers how much boon generation was produced instead of duplicating uptime percentages from Buffs and Party Boons.
- Duration-stacking boons display generated duration in readable time units.
- Intensity-stacking effects such as Might and Stability explicitly display stack-seconds/effect-seconds.
- EI `Wasted` is shown as wasted/reapplied generation duration only after validating its semantics.
- EI `Overstack` remains separate and is not mislabeled as wasted seconds.
- Multi-fight regression coverage includes profession changes, subgroup changes, squad recipient counts, and partial attendance.

## Fight Replay

- When replay is paused, hovering an allied marker can show player/account/profession plus timestamp-backed boon and condition state.
- Stack counts are shown where the persisted EI timeline supports them.
- Condition-based control state is shown when derivable; unsupported hard-CC state is reported as unavailable rather than guessed.
- Archived reports without the necessary timestamp data degrade explicitly instead of fabricating state.

## Workflow and UI

- Add Logs, Replace Logs, Reload Current, and Clear Logs are distinct actions while drag-and-drop remains intact.
- Overview metric/MVP cards use real button semantics, navigation, focus treatment, and consistent pointer behavior.
- 1080p typography/contrast and profession-icon clipping/alignment received a cleanup pass.
- Decorative asymmetry remains intentional while metric/table content stays aligned.

## Deferred / not a v0.2.58 gate

- Firefox-specific large-log profiling is intentionally deferred by project decision.
- Cross-raid intelligence remains a separate larger roadmap item rather than being rushed into this maintenance release.
- Ranked Top/Bottom extreme lists and event/timestamp attribution in Top Skills remain future refinements where the underlying EI evidence supports them.
