# Collector 0.1.1 in-game validation

Capture: entropy-20260910-192620-24276-153015156.jsonl.
Examined 2026-09-10 against eight user-supplied ZE VTC archives (zevtc).
Original inputs were read only; decompressed copies are in .tmp/capture-validation-v011.

## Integrity

- Collector version 0.1.1; normal shutdown footer present.
- 42,812 attempted and written callbacks; 42,812 unique sequences and no gaps.
- Zero capacity drops, shutdown drops, unsupported revisions or writer discards.
- No reported file-size cap or write failure.
- All JSON lines parsed. All 42,759 non-null raw records contain 64 bytes.
- 53 metadata-only callbacks; no truncated agent names detected.
- Local stream: 1,743 callbacks. Area stream: 41,069 callbacks.
- Receipt timestamp span: 723.703 seconds, not an inferred fight duration.

The previous 0.1.0 run dropped 1,110 of 13,606 attempted callbacks (8.16%).
This run lost zero callbacks within the collector's accounted callback stream.
Different encounters and workloads prevent treating this as a controlled benchmark.
These counts do not establish completeness of what ArcDPS itself observes.

## Exact byte comparisons

| Log basename | EVTC records | Local matches | Area matches |
| --- | ---: | ---: | ---: |
| 20260910-152730 | 14,217 | 33 | 1,346 |
| 20260910-152804 | 21,611 | 39 | 2,660 |
| 20260910-152845 | 15,004 | 33 | 1,851 |
| 20260910-152919 | 5,062 | 26 | 270 |
| 20260910-153012 | 30,922 | 87 | 2,406 |
| 20260910-153155 | 3,518 | 28 | 138 |
| 20260910-153447 | 13,801 | 40 | 3,090 |
| 20260910-153700 | 21,245 | 79 | 4,880 |

All eight logs have matching raw events. Stream counts may overlap and are not
coverage percentages. EVTC-only records and differences in callback/file fields
remain to be resolved. This session includes logs from two character folders;
identity changes still need semantic validation rather than assumptions based
on filenames. No exact cooldown/endurance access is demonstrated by this audit.

## Next gate

### Recorder identity and boundary diagnostic

scripts/match-capture-encounters.mjs reads the EVTC point-of-view record and
resolves it against the agent table. All eight supplied files identify the same
recording account, with the expected change from Twenty One Salvagee to I Put
That On God. Capture metadata independently records those two character names.
The actor ID 2000 is reused across this change, so it must not become a global
identity key across a whole capture session.

Strict boundary-byte pairing is unresolved for all eight logs. For the final
log, its squad-start timestamp matches callbacks in both streams, but the EVTC
source field contains bytes for `arc` while the callback contains integer 1.
The saved squad-end timestamp has no same-tick callback in this comparison.
Do not silently remove fields or apply a guessed offset to force a match.
The matcher reports unresolved results instead of generating invalid timelines.
Two tests cover exact synthetic pairs, missing/duplicate boundaries, player
resolution and malformed binary input. Actual EI phase alignment remains pending.

Follow-up: a narrowly scoped start-anchor rule now accepts the observed source
marker replacement (file uint64 0x637261, callback uint64 1) only when all other
bytes match. Duplicate candidates within a stream reject the anchor. All eight
logs satisfy this rule. No timestamp offset is introduced. The latest matcher
has three tests, including rejection of different clock fields and unknown
source markers.

Nearby end callbacks precede saved end timestamps by 330, 277, 277, 286, 263,
248, 275 and 272 ms respectively in chronological file order. These are measured
differences, not an inferred universal correction. They remain diagnostic
candidates; file ends and callback ends are stored separately. Start anchoring
does not establish the Elite Insights phase-zero timestamp or event ownership
in the short intervals where saved-file scopes overlap.

### Semantic inventory (initial supported subset)

scripts/decode-capture.mjs now streams the capture and decodes documented
revision-1 animation, buff, survival and squad-boundary events. Three focused
tests verify field offsets, large-ID preservation and unknown-type handling.
It reproduced all 42,812 callback records and matched the footer count.

Area stream contains 1,425 animation starts, 1,557 animation stops, 11,043
buff applications, 5,543 buff duration changes, 8,267 single-stack removals,
2,206 all-stack removals, 235 weapon swaps, 9 downs and 59 deaths. These are
record counts, not deduplicated player outcomes or confirmed completed skills.

Local stream contains 913 combat records, 13 combat enters and 13 exits.
State 49 (extension-combat) appears 146 times in each stream; its payload and
extension signature are not yet decoded. This is not proof of extra healing.

There are 87 squad-boundary observations across streams: 22 starts and 22 ends
locally, and 22 starts and 21 ends in area. They are not assumed to represent
87 distinct fights or uniquely paired with the eight supplied files. Unsupported
event time fields remain uninterpreted because some event types overload them.

Run `node scripts/decode-capture.mjs <capture.jsonl>` for the inventory.
Run `node --test scripts/decode-capture.test.mjs` for decoder checks.

Normalize supported event types with explicit recorder identity and encounter
anchors, then compare against EI output. Preserve local versus area provenance
and do not count identical events twice. Continue treating unsupported event
types and missing observations as unknown. Raw capture is not yet an Insight
companion import and does not alter production metric totals.
