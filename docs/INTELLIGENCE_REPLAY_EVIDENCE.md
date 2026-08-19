# Intelligence replay evidence boundary

Entropy Intelligence may inspect the existing `report.stats.replayFights` tracks at a selected event timestamp, but it must not invent state that the replay does not contain.

The replay snapshot adapter is descriptive evidence only. It may expose alive/down counts, tracked enemy state, commander identity, interpolated positions, and distance-to-commander values derived from the same replay tracks used by Fight Replay. Temporal proximity remains non-causal.

This adapter is intended to deepen the existing Intelligence event inspector and future Fight Replay deep-links without replacing or duplicating the core Fight Replay viewer.
