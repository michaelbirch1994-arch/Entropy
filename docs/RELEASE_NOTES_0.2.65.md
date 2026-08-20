# Entropy v0.2.65

## Replay stability and signal quality

This patch release focuses on making Fight Replay calmer and more useful during dense, fast WvW fights.

### Replay workspace stability

- Live Intelligence and Tactical State now keep a stable viewport height during playback instead of continuously resizing as events, boons, conditions, and recent casts change.
- Changing live content scrolls inside those surfaces rather than pushing the surrounding Replay layout up and down.
- Boon/condition and recent-cast areas reserve local space to reduce rapid visual reflow.
- Replay transitions no longer animate geometry properties that can contribute to layout jumping.

### Squad separation formation gate

- Squad-separation events are now suppressed until each player has first established formation near commander/tag.
- Formation is proven independently per player, using sustained proximity rather than an arbitrary global "ignore the first N seconds" rule.
- Default formation requirement: within 600 units of tag for 1 second.
- Once formation is established, the existing sustained-separation threshold and event timing remain unchanged.
- This removes noisy 0:00 separation events from players who begin the replay far from tag while preserving legitimate early separations after a player has actually joined formation.

## Verification

- TypeScript and production build passed in CI for both changes.
- Full test suite passed in CI for both changes.
- New regression tests cover startup-far players, players who never form, late formation, sustained formation requirements, and legitimate early separation.
- A Vercel validation build containing the exact current-main tree completed successfully before this release cut.

## Scope

No new detector family, predictive scoring, AI commander advice, or causal claims were added in this release.
