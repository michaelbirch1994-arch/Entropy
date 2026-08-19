# Source-dependent column audit

Date: 2026-08-19

## Goal

Verify that report tables do not render unexplained blank columns for metrics that the loaded Elite Insights data cannot actually support.

## Audited cases

### Offensive — Siege / NPC / Gate proxy

- This metric depends on EI all-target damage exceeding player-target damage.
- The column is only rendered when at least one player has meaningful non-player/objective damage.
- Logs that exclude siege/NPC/objective damage therefore do not show a permanently blank column.

### Offensive — Group

- The offensive data path does not carry subgroup identity for this table.
- The former placeholder Group column was removed rather than filling the table with unavailable values.

### Fight Breakdown — Healing and Sustain

- `totalOutgoingHealing` and `effectiveHealing` are optional/source-dependent.
- Healing and Sustain are gated independently with dataset-level availability checks.
- One available metric no longer forces the other unavailable metric to render as an empty column.
- Individual fights within a partially populated combined report may still show `-`; that is intentional missing-per-fight data under a supported column, not a permanently unsupported column.

### Healing-addon-derived player metrics

- Healing coverage is modeled explicitly as `full`, `partial`, or `none` rather than converting missing extension data into zero.
- Partial observations remain lower bounds and unavailable observations render as unavailable, preserving the existing data-integrity contract.
- These fields are therefore not treated as unexplained blanks.

### Buff Generation

- Generated and wasted/reapplied values are only labeled according to validated EI semantics.
- EI Overstack remains separately identified instead of being repurposed as a fake duration column.

### Fight Replay state inspection

- Timestamp state is shown only when the report persists the required timeline data.
- Archived/source-limited reports expose an unavailable state instead of empty or fabricated state fields.

## Result

No remaining audited report-table case was found where a source-dependent metric produces a permanently blank unexplained column. The known Siege/NPC, Offensive Group, Fight Breakdown Healing/Sustain, healing-addon coverage, Buff Generation, and replay-state cases now either:

1. hide the unsupported column,
2. gate it on real dataset availability, or
3. display an explicit unavailable/partial state where the distinction itself is analytically important.

This audit does not mean every zero is hidden. A supported metric may legitimately be zero. The rule is specifically that *unsupported or unavailable data must not masquerade as a meaningful zero or unexplained blank*.
