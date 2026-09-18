# September 12 capture findings

Input: entropy-20260912-022744-39384-264699218.jsonl, collector 0.1.1.
Local inspection only; the capture itself is not a public asset.

## Integrity

- 134,218,014 bytes; collector file limit reached.
- 2,138,211 attempted callbacks; 259,997 written (12.16%).
- 1,878,214 discarded by the writer; zero queue drops and no reported write failure.
- Footer written total matches the file. A shutdown footer does not mean full recording coverage.
- Retention measures callback attempts, not elapsed time, fight coverage or AI certainty.

## Retained observations

Area stream only, without summing potentially overlapping local callbacks:

- 68,286 buff applications, 2,498 duration changes.
- 62,863 single-stack removals and 13,531 all-stack removals.
- 4,047 animation starts and 4,228 stops.
- 47 down and 118 death observations, not necessarily distinct players.
- 10 squad starts and 9 ends. These are not verified report encounter matches.
- 21,338 extension records (state 49) remain uninterpreted. Do not label these healing without validated extension decoding.

## Product changes

Raw now exposes retention prominently and provides area-only signal filters.
Insight receives structured retention and signal counts with strict scope limitations.
No existing report metrics or parser behavior changes.

## Next priorities

1. Collector file rotation with bounded total disk usage, explicit segment continuity and loss accounting. Raising the cap alone only postpones loss.
2. Match original zevtc/EI encounter clocks and scoped actor identities before joining these events to Insight timelines.
3. Validate extension decoding to determine whether it adds healing/barrier evidence; never infer its meaning from state 49 alone.
4. Join buff intervals and completed/interrupted casts around mechanical events, keeping absence and unknown observations distinct.

Missing callbacks cannot be recovered from this file. Matching original combat logs may retain some of the omitted observations.
