# Entropy v0.2.76

## Obsidian Gold final acceptance

- Fight Replay now stays visually neutral while idle and uses restrained Entropy gold only for meaningful Intelligence evidence and interaction states.
- Replay focus, evidence, layer, timeline, export, and modal chrome are consolidated into the Obsidian Gold system while preserving semantic squad, enemy, profession, severity, and combat colors.
- Sidebar navigation is split into dedicated Intelligence, Archive, and Tools groups instead of a generic Extras section.

## Intelligence and defensive clarity

- Intelligence now presents conclusions, readiness, narrative, and action review before forensic evidence tooling, making the first screen easier to read without changing detectors, findings, or Replay handoff behavior.
- Mitigated Damage now visibly discloses estimated fallback values with an approximation marker and explanatory context instead of presenting estimated mitigation as exact data.

## Legacy combined-report correctness

- Squad Roster Overview, Top DPS, and Kill Pressure now recombine older profession-split report rows by account so build swaps do not duplicate a player or drop valid fight slices.
- Top Players now normalizes legacy leaderboard and expanded source-card data across profession swaps, including recomputed combined DPS and merged skill-source breakdowns.
- Player Profile ingestion now records one stable account result from older profession-split reports, with combined totals, combined fight participation, and longest-played profession selection.
- Current one-row-per-account reports keep their existing numerical behavior; these changes are backward-compatibility corrections for archived reports.

## Release scope

- This release contains only changes already merged to `main` through the Player Profile legacy-normalization pass.
- Later compatibility fixes that are still open in pull requests are intentionally excluded from v0.2.76 and will ship in a later cut after their deployment gates clear.
