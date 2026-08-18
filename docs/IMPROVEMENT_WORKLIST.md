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
- [ ] Extend the same participation context to other player and skill tables where sample size changes interpretation.
- [ ] Base rate metrics on the appropriate active/combat duration.
- [ ] Flag low-duration and low-fight samples instead of presenting them as equally reliable.
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

- [ ] Make Overview cards real, keyboard-accessible navigation targets or remove button-like hover treatment.
- [ ] Standardize pointer cursors and visible focus states for interactive elements.
- [ ] Add Reload Current, Replace Logs, Add Logs, and Clear Logs actions while preserving drag-and-drop ingestion.
- [ ] Keep the web ingestion path as direct as the desktop path.

## P2 — Visual polish

- [x] Give Fight Replay enemies stable instance identities, reject implausible position jumps, keep markers screen-sized, and re-center zoom on the commander/squad.
- [ ] Improve accent foreground contrast and define explicit theme foreground tokens.
- [ ] Remove fractional/tiny typography and text-container transforms that blur at 1080p.
- [x] Remove profession-icon clipping, retain normal antialiasing, and optically center glyphs.
- [ ] Verify every profession icon at each production size on desktop and web builds.
- [ ] Keep metric content aligned while decorative asymmetry remains clearly intentional.

## P2 — Top Skills context

- [ ] Add minimum, average, maximum, and sample size where meaningful.
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
