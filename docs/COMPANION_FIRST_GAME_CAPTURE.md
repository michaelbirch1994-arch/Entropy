# First in-game collector comparison

Capture: entropy-20260910-191007-6844-152041859.jsonl, collector 0.1.0.
Examined 2026-09-10. Original files were read only; archives were decompressed
into the project's temporary validation directory without modifying originals.

## Confirmed results

- Normal shutdown footer present.
- 13,606 callbacks attempted; 12,496 written.
- 1,110 dropped by the collector queue path (8.158%).
- Zero unsupported revisions, writer discards, reported write errors or size-limit hits.
- Queue loss includes both failed nonblocking lock acquisition and capacity loss;
  this build does not distinguish them. Do not attribute all loss to queue fullness.

| Original log | EVTC records | Exact local matches | Exact area matches |
| --- | ---: | ---: | ---: |
| 20260910-151242.zevtc | 7,259 | 48 | 165 |
| 20260910-151336.zevtc | 7,196 | 59 | 209 |
| 20260910-151413.zevtc | 9,558 | 21 | 393 |
| 20260910-151639.zevtc | 61,484 | 251 | 3,626 |

Matches compare all 64 event bytes, consuming matching occurrences once per
stream within each file. Local and area counts may overlap. Matching events
demonstrate correspondence, not complete coverage or unique encounter binding.
Unmatched records are not automatically lost callbacks: file-only event types,
different scope, and transformed fields must be investigated independently.
The comparator validates revision-1 headers and agent/skill/event boundaries;
it is a diagnostic tool, not an alternative production parser.

## What this does not establish

No exact cooldown, endurance or loadout capability has been demonstrated.
No healing-timeline interpretation or EI cast alignment was performed in this
comparison. No original-to-EI parsing was requested from an external service.

## Next corrective work

1. Split queue loss counters into lock contention, capacity and shutdown races.
2. Reduce callback/writer contention with a tested queue design. Retain bounded
   memory and do not introduce blocking I/O on callback threads.
3. Capture another controlled run and compare the counters with this baseline.
4. Resolve event identity and file transformations by event type before claiming
   capture coverage; use matched combat boundaries and a generated EI report.

Tool: scripts/compare-raw-capture.mjs. It accepts the capture followed by
uncompressed EVTC paths and prints its results as JSON. Raw files remain private
in the user-provided locations and temporary workspace; this document stores counts only.
