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
- [ ] Extend the same participation context to the remaining player tables where sample size changes interpretation.
  - [x] Add shared fight coverage, active time, and reliability labels to Offensive, Support, Healing, Defensive Stats, Buffs, and Buff Generation tables.
  - [x] Make per-second sorting in Support, Healing, and Defensive Stats use the same player-specific duration as the displayed rate.
  - [ ] Add profession/build-specific attendance before showing sample labels on Damage Modifiers and per-fight Rotations; account-wide attendance would be misleading when a player swaps builds.
- [ ] Base rate metrics on the appropriate active/combat duration.
  - [x] Core offense/defense/support/healing tables use player-specific tracked duration rather than one squad-wide clock.
  - [ ] Audit remaining rate labels and cross-view denominator consistency before marking this complete.
- [x] Flag low-duration and low-fight samples instead of presenting them as equally reliable.
  - [x] Core performance tables now flag low/developing/strong fight samples and preserve an explicit unavailable state for legacy reports.
  - [x] Downgrade otherwise broad fight samples when total or per-fight active combat time is too short for a stable rate comparison.
- [ ] Hide unsupported Siege/NPC Damage and other permanently empty columns.

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
- [ ] Add Reload Current, Replace Logs, Add Logs, and Clear Logs actions while preserving drag-and-drop ingestion.
- [ ] Keep the web ingestion path as direct as the desktop path.

## P2 — Visual polish

- [x] Give Fight Replay enemies stable instance identities, reject implausible position jumps, keep markers screen-sized, and re-center zoom on the commander/squad.
- [x] Replace the Scorched Earth presentation layer with a graphite mechanical command theme, workspace-aware cyan/emerald/amber/rose/violet signals, brighter chart series, and metric-aware neon underglows on player cards.
- [x] Improve accent foreground contrast and define explicit theme foreground tokens. The shared theme now exposes dark on-accent/on-warning/on-danger colors and high-contrast focus treatment.
- [ ] Remove fractional/tiny typography and text-container transforms that blur at 1080p. Shared panel titles, subtitles, actions, stat labels, and supporting values are now at least 11px; view-specific microcopy still needs a final native-resolution audit.
- [x] Remove profession-icon clipping, retain normal antialiasing, and optically center glyphs.
- [ ] Verify every profession icon at each production size on desktop and web builds.
- [ ] Keep metric content aligned while decorative asymmetry remains clearly intentional.

## P2 — Top Skills context

- [x] Add minimum, average, maximum, and sample size where meaningful.
- [ ] Expose the player, fight, and event context behind extremes.
- [ ] Prefer ranked extremes when a single outlier would be misleading.
- [ ] Include combat-time and participation context in skill comparisons.

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
