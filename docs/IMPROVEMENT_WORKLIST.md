# Entropy Improvement Worklist

This worklist tracks correctness, performance, readability, interaction, and longer-term raid intelligence work. Correctness and reproducible evidence take priority over presentation.

## P0 — Data correctness

- [x] Use stable account identity across combined fights, professions, characters, roles, and subgroup changes.
- [x] Keep one Squad Roster Overview row per player while preserving profession history.
- [x] Audit damage, healing, barrier, cleanses, strips, downs, and participation for stable account-level aggregation; retain account+profession rows only where build-specific context is required (damage modifiers and per-fight rotations).
- [x] Keep fight duration from being counted twice when one player has multiple EI entries in one fight.
- [x] Make Death Recap sorting cycle descending → ascending → default without row corruption.
- [x] Add mixed-specialization, changed-character, partial-attendance, and sorting regression fixtures.

## P1 — Performance and compatibility

- [x] Remove the page-level slide/exit animation that mounted two heavy report views during sidebar tab changes and caused a visible layout jerk.
- [ ] Profile a genuinely large combined raid in Firefox and compare it with Chrome and Edge.
- [ ] Memoize expensive report derivations that currently occur during render.
- [ ] Audit chart animation, blur, shadow, gradient, and large-table costs.
- [ ] Virtualize only tables whose measured DOM/render cost justifies it.
- [ ] Run a browser compatibility pass and document graceful fallbacks.

## P1 — Participation and statistical context

- [x] Add active combat time, fights participated, total fights, and participation percentage to Squad Roster Overview.
- [x] Add fights joined, session coverage, active combat time, and sample-reliability labels to Top Players.
- [x] Add fight coverage, contributor counts, per-fight ranges, and low-sample warnings to Top Skills and Healing Sources.
- [x] Extend the same participation context to the remaining player tables where sample size changes interpretation.
  - [x] Add shared fight coverage, active time, and reliability labels to Offensive, Support, Healing, Defensive Stats, Buffs, and Buff Generation tables.
  - [x] Make per-second sorting in Support, Healing, Defensive Stats, and Offensive use the same player-specific duration as the displayed rate.
  - [x] Add profession/build-specific attendance before showing sample labels on Damage Modifiers and per-fight Rotations; account-wide attendance would be misleading when a player swaps builds. New reports persist fight coverage and EI active time by account+profession, while archived reports display coverage as unavailable instead of inventing it.
- [ ] Base rate metrics on the appropriate active/combat duration.
  - [x] Core offense/defense/support/healing tables use player-specific tracked duration rather than one squad-wide clock.
  - [x] Offensive rate-aware columns now sort by the same player-specific `/s` values shown in the table, and headers make those rate units explicit.
  - [x] Rotation casts per minute use the selected account+profession's EI active time and expose session coverage for that exact build.
  - [x] Overview `/s` cards divide each leading player's value by that player's tracked `totalMs`, not by fight count/log count.
  - [x] Top Skills / Healing Sources per-active-minute context uses contributor/affected active time.
  - [x] Commander damage/barrier per-minute values use the duration of fights actually led by that commander.
  - [ ] Finish the remaining cross-view denominator audit before marking the parent complete; do not force squad-summary totals into `/s` where there is no single honest denominator.
- [x] Flag low-duration and low-fight samples instead of presenting them as equally reliable.
  - [x] Core performance tables now flag low/developing/strong fight samples and preserve an explicit unavailable state for legacy reports.
  - [x] Downgrade otherwise broad fight samples when total or per-fight active combat time is too short for a stable rate comparison.
- [ ] Hide unsupported Siege/NPC Damage and other permanently empty columns.
  - [x] Offensive only shows the Siege/NPC/Gate proxy when EI all-damage exceeds player damage for at least one player.
  - [x] Offensive no longer renders a placeholder Group column on a data path that does not carry subgroup identity.
  - [x] Fight Breakdown gates Healing and Sustain independently so one available metric does not force the other column to render as empty.
  - [ ] Finish the broader table audit for other source-dependent fields before closing this parent item.

## P1 — Signal vs. noise across raids

- [ ] Add multi-raid player trends segmented by account, role, profession/build, squad size, and fight outcome.
- [ ] Separate repeatable signal from meter padding using sample size, confidence, and role-aware baselines.
- [ ] Compare each player against their own history and an appropriate role cohort, not one universal squad average.
- [ ] Build pad-resistant contribution measures around outcome-linked windows such as damage into downs, strips before kills, healing/barrier during enemy pressure, cleanses during condition spikes, and resurrection value.
- [ ] Add positioning consequence analysis instead of treating average distance to tag as inherently good or bad.
  - Detect time spent materially ahead of, behind, or separated from the commander.
  - Link that state to downs/deaths in a following time window.
  - Record whether the commander was alive, whether the squad was engaging or disengaging, and whether support resources were diverted.
  - Example finding: `Repeatedly 200+ units ahead of tag in the 5 seconds before a down`, with fight links and sample count.
- [ ] Distinguish isolated events from patterns with minimum sample thresholds and confidence labels.
- [ ] Explain findings verbally and show the exact fights/events supporting each conclusion.
- [ ] Avoid global “good/bad player” labels; describe observable strengths, risks, consistency, and confidence.

## P2 — Interaction and workflow

- [x] Make Overview cards real, keyboard-accessible navigation targets or remove button-like hover treatment. MVP and per-second metric cards now navigate to Top Players with native button semantics, visible focus treatment, and accessible labels.
- [x] Standardize pointer cursors and visible focus states for interactive elements. Native controls, links, summaries, and role-based buttons now share a high-contrast neon focus ring and honest pointer/disabled cursors.
- [x] Add Reload Current, Replace Logs, Add Logs, and Clear Logs actions while preserving drag-and-drop ingestion.
  - [x] Header now separates Add Logs from Replace Logs and keeps Clear Logs explicit while preserving the raw-log drag/drop intake.
  - [x] Header now includes Reload Current, which rebuilds reports from stored dps.report fight links when available and explains when a one-off upload cannot be reloaded automatically.
- [x] Keep the web ingestion path as direct as the desktop path.
  - [x] Web users now get explicit guidance that drag/drop and dps.report links still work when folder watching is unavailable.

## P2 — Visual polish

- [x] Give Fight Replay enemies stable instance identities, reject implausible position jumps, keep markers screen-sized, and re-center zoom on the commander/squad.
- [x] Replace the Scorched Earth presentation layer with a graphite mechanical command theme, workspace-aware cyan/emerald/amber/rose/violet signals, brighter chart series, and metric-aware neon underglows on player cards.
- [x] Improve accent foreground contrast and define explicit theme foreground tokens. The shared theme now exposes dark on-accent/on-warning/on-danger colors and high-contrast focus treatment.
- [x] Remove fractional/tiny typography and text-container transforms that blur at 1080p. Shared and view-specific legacy labels now have an 11px floor, Builder microcopy follows the same floor, and comparison surfaces no longer shift text with decorative transforms.
- [x] Remove profession-icon clipping, retain normal antialiasing, and optically center glyphs.
- [x] Verify every profession icon at each production size on desktop and web builds. All 45 mapped assets are present at 384×384, the complete 14/16/24/32/48px contact sheet is readable, and the Builder renders the local assets without fractional transforms.
- [x] Keep metric content aligned while decorative asymmetry remains clearly intentional. Table cells now share vertical alignment and tabular figures, while Builder spec, library, party, and landing readout rows no longer carry staggered content offsets.
- [x] Add a brighter futuristic command polish layer with multi-color workspace signals, stronger neon player-card underglows, mechanical panel trims, and reduced hover movement so shared report surfaces feel less monotone without changing analytics behavior.
- [x] Smooth sidebar tab swaps by removing max-height accordion animation from navigation groups and using a short opacity transition instead.

## P2 — Top Skills context

- [x] Add minimum, average, maximum, and sample size where meaningful.
- [ ] Expose the player, fight, and event context behind extremes.
  - [x] Top Skills and Healing Sources now attach player and fight context to biggest-hit and peak per-fight values for newly built reports.
  - [ ] Add event/timestamp context only where EI exposes enough timing evidence to support it without estimation.
- [ ] Prefer ranked extremes when a single outlier would be misleading.
  - [x] Top Skills and Healing Sources now flag spike-heavy sources where the peak fight is far above the average.
  - [ ] Add ranked extreme context (for example top/bottom 3) where it materially improves interpretation.
- [x] Include combat-time and participation context in skill comparisons.
  - [x] Top Skills and Healing Sources now show contributor/affected active time and per-active-minute rates for newly built reports.

## P2 — Buff generation clarity

- [x] Replace percentage-first Buff Generation values with total generated seconds so this page answers a different question from Buff Uptime and Party Boons.
  - [x] Show total generated effect time for each player/buff using Entropy's normalized EI generation data.
  - [x] Prefer a duration format such as `2m 34s` for readability while preserving the raw numeric value for sorting/tooltips.
  - [x] Keep percentage uptime on Buffs and Party Boons rather than repeating the same representation here.
- [x] Add wasted/reapplied generation duration only where the underlying EI field can be validated as true wasted generation.
  - [x] EI `Wasted` was validated independently and is converted back to duration.
  - [x] EI `Overstack` remains separate because the current EI export includes generation in that normalized field; Entropy does not relabel it as wasted seconds.
- [x] Verify generation totals across multiple fights, subgroup changes, profession changes, and partial attendance, and make sorting use the displayed duration values.
  - [x] Regression coverage verifies stable account aggregation, subgroup/squad recipient counts, generated duration, wasted duration, and partial attendance across multiple fights.
- [x] Make intensity-stacking buff units explicit in presentation: generated/wasted values for Might, Stability, etc. are stack-seconds/effect-seconds rather than unweighted wall-clock seconds.
  - [x] Duration-stacking boons keep compact h/m/s formatting; intensity-stacking effects are explicitly rendered as `stack-s`, including chart/tooltips and wasted/reapplied values.

## P2 — Fight Replay inspection

- [x] Add paused-replay hover inspection for allied player markers.
  - [x] Only show the detailed hover card when playback is paused so the UI remains usable during motion.
  - [x] Identify the player by name, account, and profession at the selected replay timestamp.
  - [x] Show boons active at that timestamp, including stack count where the parsed buff timeline supports it.
  - [x] Show conditions active at that timestamp using the same evidence rules as boons.
  - [x] Show condition-based control state where derivable; hard-CC state remains explicitly unavailable when EI does not provide a complete timestamped hard-CC timeline.
  - [x] Keep the inspection card anchored to the hovered marker without covering the replay controls.
- [x] Reuse timestamped EI combat-state/buff data rather than estimating state from aggregate uptime percentages.
- [x] Gracefully mark state as unavailable for archived reports or logs that do not persist the timestamp-level data required for the hover card.
- [x] Add replay regression coverage for timestamp boundaries, missing buff-state data, stacked boons/conditions, control transitions, and effect expiry.

## Definition of done for this feedback round

1. Multi-profession players aggregate correctly everywhere that claims to show combined statistics.
2. Death Recap sorting remains stable through repeated header clicks.
3. Firefox remains responsive with a large combined raid.
4. Player tables expose combat-time and participation context.
5. Unsupported columns do not render as unexplained blanks.
6. Typography and profession icons remain readable at native 1080p.
7. Hover and focus behavior accurately communicates interaction.
8. Logs can be reloaded or replaced directly.
9. Cross-raid intelligence ties findings to outcomes, samples, confidence, and supporting fights.
10. Buff Generation presents generated duration clearly without duplicating uptime-focused views or inventing unsupported waste values.
11. Paused Fight Replay exposes evidence-backed per-player state at the selected timestamp when the report contains the required timeline data.
