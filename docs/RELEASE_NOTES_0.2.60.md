# Entropy v0.2.60

## Intelligence → Fight Replay exact evidence seeking

- Intelligence mechanic evidence can now open the exact Fight Replay moment it references.
- Fight Replay resolves the requested fight and exact millisecond timestamp, pauses playback on arrival, and visibly marks the Intelligence evidence target.
- The linked player is preserved when available so the selected moment keeps its evidence context.
- Users can scrub away from the linked moment and return directly to the Intelligence anchor.
- Invalid fight identities are rejected instead of silently opening the wrong replay.
- Requested timestamps are clamped safely to the authoritative replay duration.
- Focused regression coverage protects exact timestamps, zero-second events, wrong-view/source navigation, out-of-range timestamps, and invalid fight identity.

## Existing viewer preserved

- Fight Replay interpolation, map rendering, mechanics, casts, facing, bomb detection, zoom/pan, clip export, and existing playback controls remain authoritative and unchanged in purpose.
- This release strengthens the Intelligence nervous-system by connecting evidence to the existing replay rather than recreating combat calculations.

## Release principle

Entropy continues to treat detailed viewer data as authoritative. Intelligence connects forensic evidence across existing views while preserving source-data limits and avoiding unsupported causal claims.
