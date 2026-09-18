# Squad Readiness: First Measurement Slice

Updated 2026-09-12. Available locally in Insight's Squad execution mode.

This is an additive replay-state analysis. It does not alter parsing, metric
totals, existing Intelligence findings, Raw capture, or replay behavior.

## Measurement

Select a fight and analysis timestamp. This is an explicitly user-selected
moment, not an automatically detected engage. The denominator is the replay's
recorded squad roster, not verified time-local participation or subgroup makeup.

Opening snapshots cover Stability, Protection, Aegis, and Swiftness. They use
the latest recorded boon-state transition at or before the selected timestamp.
Missing tracks, ambiguous duplicate tracks, invalid/conflicting latest states,
and time before the first transition are unknown. Values greater than zero mean
present. Explicit zero means absent. Fight-end and invalid selections are not
measured. State interpretation is limited by the source's recording coverage.

For P present, A absent, U unknown and N = P + A + U:

- Known-state presence = P / (P + A).
- Evidence coverage = (P + A) / N.
- Possible roster presence = [P / N, (P + U) / N].

Empty denominators produce no percentage, not zero. Displayed percentages are
rounded; underlying evidence retains unrounded fractions and counts.

## Continuity

Choose 1, 3, or 5 seconds on each side. Windows clip to the fight boundaries.
Before is [start, selected); after is [selected, end). Transitions are integrated
at their actual timestamps, not sampled or smoothed. A gain at the selected
instant contributes only to after. Unknown intervals remain in the denominator
of possible bounds, never in measured absence.

Sum present, absent, and unknown milliseconds over roster members. Calculate the
same coverage/bounds formulas using these player-time totals. A window clipped
to zero length is labeled No interval. Last states carry to the window's end
under the source's transition model; unrepresented capture gaps cannot be
detected from this schema and remain an explicit limitation.

The strips show present (mint), absent (peach), and unknown (striped gray), with
a marker at the selected moment. Exact intervals are also available as text.
These are descriptive durations, not provider rankings, causal judgments, or
probabilities that an ally could have prevented a death.

## AI and Verification

W1 includes the snapshot measures and selected boon's before/after totals,
fractions, bounds, actual clipped windows, method version readiness-v2, and
limitations. Asking about a moment stages this evidence in the existing AI
investigation; it does not automatically call the provider. Individual context
remains available but must not substitute aggregate totals for timeline states.

Unit tests cover point/window boundaries, unknown initial states, contradictory
transitions, duplicate tracks, empty/invalid windows, precise duration integration,
and conservation of player-time. The local synthetic browser check covers
time/window controls, desktop/mobile overflow, exact interval expansion, and
handoff to the existing investigation UI. It does not validate live model quality
or certify the completeness of real uploaded timelines.

Next gates: real-source continuity audit, time-local participant identity and
coverage, then engagement-boundary reuse/validation. Until these pass, do not
promote this view into an automatic preparation grade or subgroup assessment.
