# Entropy v0.2.64

## Replay Intelligence

- Added the Previous 5 Seconds evidence window for aligned Intelligence events.
- Added deterministic, evidence-based event narratives built only from proven Replay state changes.
- Preserved the descriptive-only boundary: narratives do not claim causality.
- Kept missing position and boon-state coverage unknown instead of treating missing evidence as zero.

## UX/UI polish

- Improved shared panel hierarchy and overflow behavior across analytics views.
- Clarified sidebar selected/open states, keyboard focus, search focus, and topbar utility hierarchy.
- Standardized shared analytics surfaces, table framing, numeric hierarchy, filter rhythm, and leaderboard empty states.
- Refined Replay workspace hierarchy so Event Evidence, Tactical State, and Intelligence anchors have distinct visual priority.
- Standardized restrained micro-interaction timing and active feedback while honoring reduced-motion preferences.

## Scope and compatibility

- No metric, aggregation, sorting, Replay timing, participant-resolution, Intelligence detector, or routing semantics were changed by the UX polish work.
- Firefox-specific optimization remains intentionally out of scope for this release.
- The planned multi-theme Appearance system is not included in v0.2.64; the current app still uses the existing single Entropy theme token set.

## Verification

Every merged implementation PR in this release passed the repository CI gate, including TypeScript/production build and the full test suite, before merge.
