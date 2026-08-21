# Entropy Improvement Worklist

This worklist tracks correctness, performance, readability, interaction, and longer-term raid intelligence work. Correctness and reproducible evidence take priority over presentation.

## Active delivery sequence — reconciled after v0.2.66

This sequence incorporates the current full-app screenshot audit, the Intelligence nervous-system direction, the Replay world-space handoff, and the existing correctness/performance backlog. It is the authoritative order for upcoming cuts.

1. **Readability foundation** — calm the shared palette and visual hierarchy without changing any metric or report contract.
2. **Evidence navigation** — make Mechanics Timeline and Death Recap exact-time entry points into Fight Replay.
3. **Density and overflow** — replace unbounded walls of rows/text with professional summaries and accessible drill-down regions.
4. **Intelligence integration** — carry the same selected fight, player, timestamp, and evidence across Intelligence, Mechanics, Death Recap, and Replay.
5. **Replay geography** — finish the verified WvW objective-coordinate pipeline before adding objective visuals or spatial narrative.
6. **Cross-raid signal** — build role-aware, sample-aware trends and pad-resistant outcome analysis.
7. **Desktop/web parity** — verify shared viewer behavior while keeping native-only features explicit and gracefully unavailable on the web.

### Non-negotiable guardrails

- Presentation changes must not alter parsing, normalization, aggregation, scoring, or metric methodology.
- A verbal finding must identify the exact persisted evidence that supports it; unknown context remains unknown.
- No spatial relationship, objective position/ownership, boon state, causal explanation, or player judgment is inferred merely to make a view feel complete.
- Older archived reports must continue to load and must disclose when timestamp-level or source-specific evidence is unavailable.
- Motion must help users follow selection or navigation; it must not shift layout, delay input, or keep decorative effects running over dense data.
- Profession identity remains available through profession icons/chips, but page/workspace colors must not compete with semantic metric colors.

## P0 — Data correctness

- [x] Use stable account identity across combined fights, professions, characters, roles, and subgroup changes.
- [x] Keep one Squad Roster Overview row per player while preserving profession history.
- [x] Audit damage, healing, barrier, cleanses, strips, downs, and participation for stable account-level aggregation; retain account+profession rows only where build-specific context is required (damage modifiers and per-fight rotations).
- [x] Keep fight duration from being counted twice when one player has multiple EI entries in one fight.
- [x] Make Death Recap sorting cycle descending → ascending → default without row corruption.
- [x] Add mixed-specialization, changed-character, partial-attendance, and sorting regression fixtures.

## P1 — Performance and compatibility

- [x] Remove the page-level slide/exit animation that mounted two heavy report views during sidebar tab changes and caused a visible layout jerk.
- [~] Firefox-specific large-log profiling is deferred by product decision and is not a v0.2.59 release gate.
- [ ] Memoize expensive report derivations only where measured or code-reviewed evidence shows repeated work during render.
- [ ] Audit chart animation, blur, shadow, gradient, and large-table costs only when a concrete performance regression justifies it.
- [ ] Virtualize only tables whose measured DOM/render cost justifies it.
- [ ] Run a general browser compatibility pass when practical; obsolete-browser support is not a priority.

## P1 — Participation and statistical context

- [x] Add active combat time, fights participated, total fights, and participation percentage to Squad Roster Overview.
- [x] Add fights joined, session coverage, active combat time, and sample-reliability labels to Top Players.
- [x] Add fight coverage, contributor counts, per-fight ranges, and low-sample warnings to Top Skills and Healing Sources.
- [x] Extend the same participation context to the remaining player tables where sample size changes interpretation.
  - [x] Add shared fight coverage, active time, and reliability labels to Offensive, Support, Healing, Defensive Stats, Buffs, and Buff Generation tables.
  - [x] Make per-second sorting in Support, Healing, Defensive Stats, and Offensive use the same player-specific duration as the displayed rate.
  - [x] Add profession/build-specific attendance before showing sample labels on Damage Modifiers and per-fight Rotations; account-wide attendance would be misleading when a player swaps builds. New reports persist fight coverage and EI active time by account+profession, while archived reports display coverage as unavailable instead of inventing it.
- [x] Base rate metrics on the appropriate active/combat duration.
  - [x] Core offense/defense/support/healing tables use player-specific tracked duration rather than one squad-wide clock.
  - [x] Offensive rate-aware columns now sort by the same player-specific `/s` values shown in the table, and headers make those rate units explicit.
  - [x] Rotation casts per minute use the selected account+profession's EI active time and expose session coverage for that exact build.
  - [x] Overview `/s` cards divide each leading player's value by that player's tracked `totalMs`, not by fight count/log count.
  - [x] Top Skills / Healing Sources per-active-minute context uses contributor/affected active time.
  - [x] Commander damage/barrier per-minute values use the duration of fights actually led by that commander.
  - [x] Cross-view denominator audit completed; squad-summary totals are intentionally not forced into `/s` where overlapping participation leaves no single honest denominator.
- [x] Flag low-duration and low-fight samples instead of presenting them as equally reliable.
  - [x] Core performance tables now flag low/developing/strong fight samples and preserve an explicit unavailable state for legacy reports.
  - [x] Downgrade otherwise broad fight samples when total or per-fight active combat time is too short for a stable rate comparison.
- [x] Hide unsupported Siege/NPC Damage and other permanently empty/source-dependent columns.
  - [x] Offensive only shows the Siege/NPC/Gate proxy when EI all-damage exceeds player damage for at least one player.
  - [x] Offensive no longer renders a placeholder Group column on a data path that does not carry subgroup identity.
  - [x] Fight Breakdown gates Healing and Sustain independently so one available metric does not force the other column to render as empty.
  - [x] Broader source-dependent column audit completed; supported-but-missing individual values use explicit unavailable states rather than unexplained permanent blanks.

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

## P1 — Readability, density, and cinematic restraint

- [~] Establish a calmer shared visual foundation with neutral graphite surfaces, restrained workspace accents, clearer text contrast, quieter borders, and softer player-card underglows.
  - [x] Implement the presentation-only token and shared primitive changes on `feature/readability-foundation`.
  - [x] Verify the production build, all tests, changed-file lint, and a presentation-only diff boundary.
  - [ ] Complete desktop and hosted-web visual review before marking the foundation merged/released.
- [ ] Run a view-by-view color-role audit so each screen has one structural accent while success, warning, danger, healing, barrier, damage, profession, and evidence colors retain distinct meanings.
- [~] Replace unbounded walls of text/rows with professional progressive disclosure without hiding data.
  - [x] Add one reusable, labelled, keyboard-focusable bounded-data region with visible focus treatment and overscroll containment.
  - [x] Contain long Intelligence critical-event, action, timeline, and findings collections while preserving their summary counts and show-all controls.
  - [x] Contain Mechanics occurrence evidence, Death Recap card collections, squad rotations, and per-player cast lists without truncating their underlying data.
  - [x] Avoid nested scroll traps in the completed pass; full analytics tables retain page scrolling when comparison across many rows is the primary task.
  - [x] Standardize the remaining long skill-source, profession-presence, and distance-to-tag collections on the same accessible treatment.
  - [ ] Complete desktop/web visual acceptance with a representative multi-fight report before marking this slice complete.
- [ ] Standardize dense table readability across 1080p desktop and hosted web: sticky context where useful, stable row height, tabular figures, honest horizontal overflow, and readable selected/hover states.
- [ ] Add cinematic but useful transitions only at meaningful moments: evidence selection, Replay seek, inspector reveal, and workspace entry.
  - Respect reduced-motion preferences.
  - Never animate chart values or report rows in a way that implies changing data.
  - [x] Prevent live Replay evidence changes from changing the map/page height or jerking the playhead.
- [ ] Complete a visual acceptance matrix for Overview, Squad/Roster, Performance, Combat Log, Intelligence, Archive/Compare, and Entropy Builder in desktop and hosted-web builds.

## P1 — Intelligence nervous system across evidence views

- [x] Make Intelligence critical events selectable and preserve exact fight, timestamp, player, and event identity in its event inspector.
- [x] Link supported Intelligence evidence into Fight Replay and Death Recap without duplicating metric calculations.
- [x] Add a compact Intelligence evidence layer to Mechanics Timeline.
  - [x] Each timestamped mechanic occurrence can seek to that exact fight/time in Replay.
  - [x] Each timestamped mechanic occurrence can open Intelligence with the same fight, player, timestamp, and mechanic label.
  - [x] Intelligence selects only a persisted nearby event inside the explicit ±15 second window and keeps the source moment visible when no event exists.
  - [x] Carry the affected player when the mechanic resolves to a squad account.
  - [x] Keep severity and occurrence counts descriptive; do not equate EI severity with causal impact.
- [x] Add a compact Intelligence evidence layer to Death Recap.
  - [x] Each death can seek to the exact death timestamp in Replay with that player selected.
  - [x] Each death can open Intelligence with the exact fight, player, timestamp, and Death Recap context.
  - [x] Preserve an explicit no-nearby-event state instead of synthesizing a CriticalEvent for the death.
  - [x] Preserve the existing hit breakdown as the authoritative damage evidence.
  - [x] Make unavailable Replay coverage explicit instead of disabling a control without explanation.
- [x] Keep cross-view navigation reversible and stable: users can return to their source view with fight/player/time context intact.
- [x] Add synchronized before/event/after evidence presentation using only persisted timestamp-level state.
  - [x] The Intelligence event inspector remains authoritative when a persisted nearby event is selected.
  - [x] The source fight/time/player remain visible and Replay-addressable when no persisted event exists nearby.
- [x] Enrich per-fight Intelligence with concise commander-readable narration.
  - [x] Present deterministic What happened, Likely issue, and What to improve summaries for the selected fight.
  - State what happened, what changed before the event, and which response could be reviewed.
  - Phrase improvement opportunities as evidence-backed review prompts, not fabricated coaching conclusions.
  - [x] Expose supporting fights/events, sample count, confidence, and counter-evidence consistently in every narration card.
    - Each card now states its supporting fight, evidence-reference, and sample counts without inventing missing support.
    - Counter-evidence is explicit when the fight result limits a failure claim, and unavailable counter-evidence is labeled as an evidence boundary rather than assumed absent.
- [x] Group related critical events into inspectable combat episodes without hiding the underlying event stream.
  - Persisted engagement-segment membership remains authoritative.
  - Unsegmented events group only when explicit player/event evidence overlaps inside a short review window; proximity alone is insufficient.
  - Episode cards seek into the existing event inspector while the complete filterable Critical Events feed remains visible and unchanged.

## P1 — Replay world-space and tactical workspace

- [x] Complete Replay death/release separation correctness and prevent post-death separation findings.
- [x] Prevent teleport/respawn discontinuities and implausible movement interpolation.
- [x] Persist optional Replay world-space metadata while preserving legacy-report compatibility.
- [~] Prove the EI Replay-pixel ↔ GW2 map ↔ continent coordinate bridge for the four supported WvW maps.
  - Draft PR #160 changes only the coordinate module/tests and CI is green.
  - [ ] Audit and merge the coordinate slice before any objective rendering.
- [ ] Ingest authoritative WvW objective data and prove objective projection with tests before UI work.
- [ ] Render a restrained objective overlay only after projection is proven across Eternal Battlegrounds, both Alpine Borderlands, and Desert Borderlands.
- [ ] Investigate higher-resolution official map imagery/tiles after objective alignment is correct.
- [ ] Add spatial Intelligence only when map/objective evidence is trustworthy; never infer geography from fight names or approximate pixels.
- [~] Build the expanded/pop-out Replay workspace without splitting the evidence model.
  - [x] Add a web-and-desktop in-app Focus Mode that reuses the live Replay components and maximizes the tactical workspace.
  - [x] Preserve the selected fight, playhead, player inspector, and live Intelligence evidence while entering/exiting Focus Mode.
  - [x] Move exact-time Intelligence evidence into a stable, internally scrolling inspector drawer beside the map.
  - [x] Bound visual playback to 30 FPS, derive it from one monotonic clock anchor, and throttle expensive tactical/Intelligence analysis to 5 FPS.
  - [~] Profile a representative large multi-fight report after this stabilization slice and extract the SVG stage into its own render boundary if frame time remains high.
    - [x] Extract the animated SVG map/marker stage into a memoized render boundary so evidence-drawer and workspace-state updates do not rebuild every marker while paused.
    - [ ] Capture a representative large-report performance trace on desktop and hosted web before claiming the remaining frame-time problem is solved.
  - [ ] Add a true Tauri secondary Replay window only after the shared Focus Mode workspace is accepted; keep hosted web on the expanded in-page workspace.

## P2 — Entropy Builder and desktop/web product boundaries

- [~] Preserve the current Entropy Builder build/library/squad workspaces while auditing usability separately from combat analytics.
- [ ] Finish a dedicated Builder visual and workflow audit: profession/spec selection, trait/skill discovery, equipment density, validation, library actions, squad assignment, and code round trips.
- [ ] Keep Builder and combat analytics navigation visually separated while sharing the same readable theme primitives.
- [ ] Document and test the capability boundary between desktop and hosted web.
  - Shared: report viewing, direct uploads/links, analytics, Intelligence, Builder, static/shared artifacts where supported.
  - Desktop-only when required: folder watching, native file-system workflows, native updater, and secondary Replay windows.
- [ ] Verify Vercel/static-host routing, asset paths, refresh behavior, report-size limits, browser storage limits, and graceful handling of native-only controls before treating web as release-parity.

## P2 — Top Skills context

- [x] Add minimum, average, maximum, and sample size where meaningful.
- [ ] Expose the player, fight, and event context behind extremes.
  - [x] Top Skills and Healing Sources attach player and fight context to biggest-hit and peak per-fight values for newly built reports.
  - [ ] Add event/timestamp context only where EI exposes enough timing evidence to support it without estimation.
- [ ] Prefer ranked extremes when a single outlier would be misleading.
  - [x] Top Skills and Healing Sources flag spike-heavy sources where the peak fight is far above the average.
  - [x] Add a tested analytics-layer helper that deterministically ranks observed per-fight samples into highest/lowest groups without fabricating missing values.
  - [ ] Persist enough observed per-fight evidence in new reports to truthfully render Top/Bottom ranked extremes.
  - [ ] Show ranked extreme context in the existing expandable Top Skills/Healing Sources panels without adding another page.
- [x] Include combat-time and participation context in skill comparisons.
  - [x] Top Skills and Healing Sources show contributor/affected active time and per-active-minute rates for newly built reports.

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
3. Player tables expose combat-time and participation context.
4. Unsupported columns do not render as unexplained blanks.
5. Typography and profession icons remain readable at native 1080p.
6. Hover and focus behavior accurately communicates interaction.
7. Logs can be reloaded or replaced directly.
8. Cross-raid intelligence ties findings to outcomes, samples, confidence, and supporting fights.
9. Buff Generation presents generated duration clearly without duplicating uptime-focused views or inventing unsupported waste values.
10. Paused Fight Replay exposes evidence-backed per-player state at the selected timestamp when the report contains the required timeline data.

Firefox-specific profiling is intentionally deferred and is not part of this feedback-round definition of done.
