# Entropy ArcDPS capture prototype

Development prototype 0.1.2, not a released addon. This produces a Windows x64 DLL
and a synthetic native test executable. Rotation has not yet been validated inside GW2.

## What it captures

- Local and area callbacks in distinct streams, including null-event agent metadata.
- An owned copy of the 64 raw event bytes for revision 1, callback IDs, sequence
  numbers, receipt ticks and bounded copies of agent identity fields.
- Queue loss, unsupported revisions, output discards and a normal-shutdown footer.

Unknown event revisions are counted and skipped without interpreting their bytes.
Events are copied into a fixed 4096-slot pool using Windows interlocked SLists. A
worker performs serialization and file I/O. Each segment is limited to approximately
128 MiB plus one record and its footer. Up to 16 segments (approximately 2 GiB)
are created per DLL session; later records are counted as discarded. This is a
per-session limit, not a directory-wide quota. Previous recordings are never deleted.
Keep all numbered parts together. The header contains sessionId and segment; the
footer has scope=segment, per-file written, continued, and cumulative session counters.
Intermediate counters can include queued work; only the final footer reconciles
attempts with sessionWritten, queueDropped, unsupportedRevision and writerDiscarded.
If opening the next file fails, the preceding continued=true footer identifies an
incomplete chain. Final loss counters may be unavailable after filesystem failure.
Raw currently inspects individual parts and marks full-session retention unknown;
multi-part validation is still required before claiming complete session coverage.
No network calls, game-memory scanning or input automation are implemented.

Version 0.1.1 removes the shared-lock contention drop path seen in the first
in-game recording. The footer separates capacityDropped and shutdownDropped;
queueDropped remains their combined count. Detached batches are reversed by
the consumer; publication order still does not imply timestamp/sequence order.
The writer waits for active callbacks before its final drain. No per-event heap
allocation is used. Capacity exhaustion can still lose records and remains visible.
Tests include concurrent consumers/producers, unique sequence checks, full slot
recovery and zero-loss concurrent bursts below capacity. New in-game validation
is required to measure improvement over the original 8.2% loss.

Agent names are UTF-8 bytes encoded as hex so arbitrary names cannot break JSON.
IDs are strings to preserve 64-bit precision. Callbacks may arrive out of order;
file order and receipt ticks must not be treated as encounter timestamps. Retain
the ArcDPS ID and raw event fields for subsequent normalization. ID zero means
unordered. Do not deduplicate local and area observations blindly.

## Build and synthetic verification

Use a portable Zig 0.15.2 Windows x64 compiler obtained from the official Zig
download index with its SHA-256 verified, then run:

```powershell
./companion/native/build.ps1 -ZigPath C:/path/to/zig.exe
```

The default compiler path is the project-local `.tmp/native-tools` installation.
Output is in `.tmp/companion-native`. Build uses warnings as errors. The test
harness checks owned event copies, null metadata, unknown revisions, overflow,
concurrent producers, writer draining and shutdown. The script validates the
produced JSON lines as well. Nothing is copied into a game installation.

## Opt-in capture for a future controlled test

Initialization requires `ENTROPY_CAPTURE_DIR` to name an existing writable
directory inherited by the game process. Without it initialization fails with
an explicit message. Each load creates a new file and does not overwrite an old
capture. The build script sets this only for its synthetic child process and
restores the previous value afterward.

The signature 0x45545031 is provisional and must be checked for collisions before
distribution. The API table layout is compile-time checked. No ImGui callbacks
are installed. Release drains the worker outside DllMain; the host must stop new
callback dispatch before releasing the module. Validate this lifecycle in a
controlled game session before wider use.

## Next integration

This raw JSONL is intentionally not an Insight companion recording yet. It lacks
verified encounter anchors and a binding to the completed original log. Build a
normalizer after comparing a real capture with its EVTC and EI JSON. Preserve
pre-fight events, gaps, clock wraps and recorder identity; account for game state
events whose time field is overloaded. A missing footer means capture completion
is unknown, and disk failure may prevent even the footer from being persisted.

Raw callbacks do not establish direct cooldown, ammunition or endurance access.
These capabilities remain unverified. Validate actual exposed fields before
adding any snapshots to the Insight interchange format.

References reviewed 2026-09-10:
- https://www.deltaconnected.com/arcdps/api/README.txt
- https://www.deltaconnected.com/arcdps/evtc/README.txt
- https://ziglang.org/download/index.json
