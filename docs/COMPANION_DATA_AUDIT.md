# Entropy companion: first milestone

Status: interchange prototype, source-code audit and compiled native capture
prototype, 2026-09-10. No live sharing service or direct cooldown/endurance
capture is implemented. The DLL has only been tested outside the game.
The current parser and production Insight calculations are unchanged.

## Findings in the current application

| Evidence | Current consumer | Gap / next verification |
| --- | --- | --- |
| Per-fight skill casts | src/lib/insight/eventResponses.ts | Missing casts cannot establish non-use; completion and charge state unresolved. |
| Boon/condition state changes | src/lib/insight/combatConnections.ts | Explicit coverage required before treating absent states as zero. |
| Recharge estimates | src/lib/insight/supportOpportunities.ts | Historical patch, traits, resets and loadout must be resolved. |
| Endurance scenarios | src/lib/insight/endurance.ts | Conditional bounds; direct measurement has not been demonstrated. |
| Healing coverage | src/lib/insight/evidence.ts | Aggregate support exists; combatConnections explicitly lacks healing timeline coverage. Audit raw EI timestamps before adding collection. |
| Range and survival | src/lib/insight/responseReach.ts and eventResponses.ts | Two-dimensional reach does not establish line of sight, target priority or ability to act. |
| Equipped skills | eventResponses.ts meta assumptions | A prior cast or profession assumption is not a current loadout snapshot. |
| Confidence | eventResponses.ts evidenceCoverage | Percentage of completed checks is coverage, not probability of a save. |

## Prototype delivered

src/lib/insight/companionRecording.ts accepts versioned JSON with explicit
provenance, recording identity, encounter-relative milliseconds, timing
uncertainty, missing intervals and ordered point observations. It validates
loadout, charge and endurance records without asserting they can be captured.
The importer rejects unsupported versions, malformed values and oversized input.

Binding requires the SHA-256 digest of the original uploaded file, game build,
duration and an account present in that encounter. A digest identifies a file;
it does not authenticate a contributor. Different players' logs will have
different digests. Cross-recorder matching is deliberately not implemented.
Point observations are not carried forward as readiness. Uncertainty overlapping
a recorded gap suppresses the observation lookup. Imported source labels remain
unverified claims, even when labeled collector-observed.

## Next implementation sequence

### Validation tools now available

Run with Node 24 (native TypeScript support):

```sh
node scripts/audit-companion-input.mjs path/to/ei.json
node scripts/validate-companion.mjs path/to/original.zevtc path/to/ei.json path/to/companion.json 100
node --test scripts/audit-companion-input.test.mjs scripts/validate-companion.test.mjs
```

The validator streams the original file to calculate its fingerprint, checks
the companion's encounter claims, and compares explicitly observed cast events
with EI rotation timestamps in milliseconds. Matching is unique in both
directions. Ambiguous, unmatched and gap-overlapping observations are reported
separately. Match rate is agreement, not readiness confidence. The EI JSON's
relationship to the original file is still operator-supplied until we run EI
ourselves. Synthetic tests are not in-game validation.

Audited repository fixtures:

| Fixture | Players | Players with cast timestamps | Healing aggregates | Healing series | Listed healing participants |
| --- | ---: | ---: | ---: | ---: | ---: |
| wvw-modern-ei.json | 14 | 0 | 14 | 0 | 8 |
| sample-wvw-log.json | 10 | 8 | 10 | 0 | 1 |

These results describe these fixtures only; they do not establish that EI cannot
export healing timelines. The field inventory is deliberately structural.
No original EVTC/companion pair has been validated. Native C++ build tools were
not found on PATH or in the checked Visual Studio installation directory; a
compiler was subsequently provisioned as a project-local, checksum-verified
Zig 0.15.2 download. The native collector now builds and passes synthetic tests.
See companion/native/README.md and build.ps1. Its raw JSONL still requires
normalization and encounter binding before Insight import. Actual game capture
and lifecycle compatibility remain unverified.

### Remaining sequence

1. Obtain a controlled log and matching EI JSON from a participating player.
   Inventory raw event fields against normalized report fields, including healing
   extension coverage, cast completions, buff transitions and log boundaries.
2. Build a minimal ArcDPS collector using documented callbacks. Capture event
   ordering and local combat observations to disk asynchronously. Demonstrate
   what is actually observable before promising cooldown/endurance snapshots.
3. Finalize clock anchors and account mapping against the controlled recording.
   Preserve pre-fight events needed for cooldown anchors. Support truncated logs,
   reconnects and agent-ID reuse. Explicitly record clock discontinuities.
4. Add an Insight companion import control with preview, mismatch feedback,
   removal and per-player coverage. Keep companion evidence separate from metric
   totals and fit it into the existing AI evidence size budget.
5. Add observed-versus-modeled comparisons. Use point measurements to validate
   estimates; publish error rates before assigning calibrated probabilities.
6. Add an isolated EI worker behind a configurable upload provider. Compare
   existing metrics on fixtures before switching upload defaults. Pin parser and
   game-rule versions; constrain archive expansion, concurrency and retries.
7. Add opt-in post-fight sharing, followed by session sharing if useful. Require
   participant identity, replay protection, duplicate handling, retention and
   deletion controls. Reconcile conflicting recordings without double-counting.

## Acceptance gates

- One-player proof: known casts align with the source recording within a measured
  timing tolerance; missing capture is represented explicitly.
- No false upgrades: user-provided or modeled values never become observed facts.
- No regression: report totals agree with the existing pipeline on identical data.
- Collector: no networking or disk I/O on combat callbacks; bounded queue and
  dropped-event accounting; survives reconnect and clean shutdown.
- Squad: test partial participation and connection loss before wider use.
- Response analysis: skill suitability, readiness, range and outcome remain
  separate conclusions. An available skill cannot prove a preventable death.

## Reference interfaces

- ArcDPS API: https://www.deltaconnected.com/arcdps/api/README.txt
- EVTC format: https://www.deltaconnected.com/arcdps/evtc/README.txt
- Healing Stats: https://github.com/Krappa322/arcdps_healing_stats
- Elite Insights: https://github.com/baaron4/GW2-Elite-Insights-Parser

Review extension logging versus a sidecar after the collector proof. Supported
extension events are an option; do not rewrite existing raw combat events.
Never assume undocumented private state is available simply because a DLL runs.
