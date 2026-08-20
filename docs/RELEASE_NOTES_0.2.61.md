# Entropy v0.2.61

## Intelligence forensic context deepened

- Intelligence-linked player evidence now carries local replay context at the exact event timestamp, including distance to tag, nearby squad counts, nearest squadmates, tracked-enemy proximity, and nearby damaging casts when supported by the replay data.
- The forensic inspector can open the linked player directly at the Intelligence anchor in Fight Replay.
- A dedicated Intelligence adapter now reuses Entropy's existing timestamped replay-inspection path for boons, conditions, and verified condition-backed control effects instead of duplicating state reconstruction.
- Missing positioning or timestamped state remains unknown rather than being silently converted to zero or "not present."
- Proximity, mechanics, and nearby casts remain descriptive evidence and are not promoted to causation without support.

## 4K and ultrawide workspace support

- The previous fixed-width ceiling that made Entropy look windowed on ultrawide monitors has been removed from the main analytical workspace.
- Large-display behavior now expands progressively across large desktop, 2560-class, ultrawide, and 4K/very-wide displays while preserving the established 1080p layout.
- Top Players scales to additional columns on wider displays and dense tables/charts are allowed to use the available workspace instead of leaving large unused gutters.
- No global transform/zoom scaling was introduced, preserving text and icon sharpness.

## UX hierarchy and interaction polish

- Report identity is visually prioritized while topbar utility actions are grouped into a quieter control tray on desktop.
- The first in-view filter strip stays available while scrolling long analytical views.
- Overview now reads more clearly as summary/KDR → MVPs → metric drill-downs, with destination cues on hover and keyboard focus for interactive cards.
- Top Players reads more intentionally as podium → investigation cards → full authoritative leaderboard.
- Shared card hover/press behavior, active navigation treatment, and reduced-motion support are more consistent across the app.

## Dense table readability

- Leaderboards now use stronger headers, quieter separators, restrained alternating rows, stable tabular number alignment, and subtle top-three rank accents.
- Metric, sample, and share columns keep more consistent width on large displays for faster scanning.
- Table headers use semantic column scopes and share bars expose their percentage meaning for accessibility.
- The remaining "Developing" sample label was corrected to "Moderate" with no change to the underlying reliability thresholds or calculations.

## Cross-view continuity

- Deliberate programmatic drill-downs can now preserve previous-view context through the existing ViewContext.
- A compact return trail appears only when Entropy already has navigation context, showing the originating view and relevant metric/player/fight details when available.
- Users can return directly to the originating Overview, Intelligence, or other contextual view without reconstructing their navigation path.
- Normal sidebar navigation remains clean and unchanged.

## Existing viewer and data contracts preserved

- No aggregation formulas, player identity rules, report contracts, Fight Replay calculations, or Intelligence evidence semantics were replaced by this release.
- Core numerical tables remain authoritative; the UX and Intelligence layers connect users to those existing sources rather than duplicating them.

## Release principle

v0.2.61 is a polish-and-continuity release: make Entropy feel more deliberate on 1080p through 4K ultrawide displays, strengthen the Intelligence-to-evidence nervous system without turning Intelligence into a second viewer, and improve movement through dense analytical data without changing what the underlying fight data means.
