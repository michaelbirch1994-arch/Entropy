# Replay evidence acceptance criteria

- Replay evidence is sourced from existing `ReplayFightEntry` data only.
- Unknown or unavailable replay state is not converted to zero or false certainty.
- Event timestamps are clamped to the source replay bounds.
- Fight identity is matched explicitly by `fightId`.
- Linked player state is limited to accounts/names already referenced by Intelligence evidence.
- Positioning measurements are descriptive and never labeled as causal on their own.
- The core Fight Replay view remains authoritative and unchanged.
