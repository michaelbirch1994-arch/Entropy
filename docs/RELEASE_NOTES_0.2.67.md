# Entropy v0.2.67

## Replay workspace and Intelligence evidence

This release makes Fight Replay calmer under load and connects Entropy's evidence surfaces into a more coherent review workflow.

### Fight Replay stability

- Replay now starts at 1x speed and advances through a monotonic playback clock.
- Visual position updates are capped separately from heavier Intelligence and tactical-state updates to reduce unnecessary work during playback.
- Live Intelligence, tactical state, and player evidence stay inside stable, internally scrolling inspector surfaces instead of resizing the surrounding page.
- Focus Mode provides a larger in-page Replay workspace without changing the underlying replay data or controls.
- The replay map is isolated in a memoized stage so evidence-drawer changes do not rebuild the SVG while the replay is paused.

### Evidence navigation

- Mechanics Timeline and Death Recap entries can open the relevant moment in Fight Replay or Intelligence.
- Navigation carries exact fight and timestamp context and preserves a reversible return path to the originating view.
- Intelligence keeps the complete critical-event feed while adding conservative fight-level summaries for what happened, likely issues, and evidence-backed improvements.
- Supporting fights, supporting events, sample counts, confidence, and counter-evidence remain visible so summaries do not overstate the available evidence.

### Dense-data readability

- Long drill-down regions use a consistent bounded presentation with local scrolling.
- Classes, Death Recap, Distance to Tag, Intelligence, Mechanics, Rotations, and Squad Stats retain their complete data while avoiding unbounded page growth.

## Verification

- TypeScript passed.
- Changed-file lint passed.
- Production web build passed.
- Full test suite passed: 56 files and 357 tests.
- New tests cover the playback clock, Intelligence navigation, combat episodes, and narrative evidence.

## Scope

No report parsing, normalization, combat metric formulas, scoring methodology, or source data was changed in this release.
