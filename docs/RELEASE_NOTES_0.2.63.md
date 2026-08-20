# Entropy v0.2.63

Entropy v0.2.63 is a desktop-focused replay and Intelligence release.

## Fight Replay

- Fixed stale actor positioning outside valid EI replay tracks so actors no longer remain frozen as timeline effects continue.
- Rebuilt Replay around a larger tactical workspace with improved ultrawide scaling and a persistent Tactical State rail.
- Added exact-time boon and condition state inspection for tracked players.
- Improved squad, enemy, commander, selected-player, downed, and tactical marker presentation.
- Preserved existing map imagery, mechanics, casts, facing, zoom/pan, follow-focus, bomb detection, scrubbing, playback speed, and clip export.

## Replay Intelligence

- Added evidence-backed Intelligence replay anchors mapped to exact fights and exact timestamps.
- Added bidirectional live Intelligence around the replay playhead, including a full-fight event track and nearby-event awareness.
- Added previous/next Intelligence event navigation.
- Replay anchors now resolve linked players against the exact replay roster and automatically open Tactical State where a proven identity match exists.
- Critical Events can preserve multiple tracked participants and provide direct Tactical State access for each proven participant.
- Added exact aligned-event detection and map highlighting for all proven event participants while the playhead is within the Intelligence alignment window.

## Integrity

- Replay/Intelligence linking does not invent timestamps or identities.
- Participant resolution uses exact replay-fight roster matches.
- No new detector families, scoring changes, or speculative causal claims are introduced in this release.

## Verification

The release branch must pass TypeScript checking, the production build, and the full test suite before merge.
