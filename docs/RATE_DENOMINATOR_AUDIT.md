# Cross-view rate denominator audit

Date: 2026-08-19

## Goal

Verify that rate metrics shown for individual players/builds use the duration of the player/build being measured, rather than a squad-wide/session-wide clock that would distort partial attendance.

## Findings

### Offensive

- Player rate-aware columns use the shared `rateByActiveMs` helper.
- The denominator is the player's tracked active/fight duration.
- Rate-mode sorting uses the same value that is displayed, avoiding total-vs-rate ordering mismatches.

### Defensive / Support / Healing

- `DefensiveView` uses `metricSortValue(value, activeMs, perSecond)` for player-row sorting.
- Support and healing rows use each player's `activeMs`.
- Defensive incoming-damage rows use each player's `totalFightMs`.
- Summary cards aggregate both numerator and the corresponding population's active seconds. These are squad/population throughput summaries, not individual-player rates.
- The local helper is semantically equivalent to the shared player-rate helper. Consolidating it would be code cleanup, not a correctness fix, so this audit does not change behavior merely for uniformity.

### Squad Stats

- Per-player DPS is `damage / (player.totalFightMs / 1000)`.
- This correctly preserves partial-attendance context rather than dividing every player by the full session duration.

### Rotations

- Casts/min uses the selected account+profession/build active time, preserving build-specific attendance when a player swaps profession/build.

### Top Skills / Healing Sources

- Per-active-minute context uses contributor/affected active time rather than a single report duration.

### Overview

- `/s` leader cards use the leading player's tracked `totalMs`.

### Commander

- Commander per-minute metrics use the duration of fights actually led by that commander.

## Important non-change

Do **not** force every squad/session summary into `/s`. Some aggregate cards combine activity from multiple players whose active windows overlap. There is no single honest wall-clock denominator for those values unless the metric is explicitly defined as squad throughput. Existing population-throughput summaries should remain clearly scoped rather than being presented as if they were an individual-player rate.

## Conclusion

The player/build rate paths inspected in this audit use player-specific or build-specific tracked duration where rate comparison depends on participation. No remaining case was found where a partial-attendance player's visible rate is divided by the full squad/session duration.

The remaining performance work is separate: Firefox large-log profiling must use a representative combined raid and should not be marked complete from static inspection alone.
