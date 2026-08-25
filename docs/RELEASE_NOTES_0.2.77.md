# Entropy v0.2.77

## Regression hotfix

This release is intentionally narrow. It addresses the two release-blocking problems reported after v0.2.76 without changing combat metrics, stat methodology, Elite Insights interpretation, aggregation formulas, or Intelligence scoring.

## Raw log uploads

- Raw `.zevtc` / `.evtc` imports keep requiring a reusable dps.report permalink before a fight can enter Entropy.
- A generated report is no longer rejected solely because dps.report also returned a non-fatal warning; dps.report documents that reports may still be generated when its `error` field is populated.
- Upload and parsed-JSON retrieval can fall back to the API-documented HTTPS alternate `b.dps.report` when the primary service cannot provide a usable response.
- The native Tauri CSP now explicitly permits that alternate HTTPS service.
- Cancellation and dps.report rate limiting are still respected and are not bypassed through the alternate domain.

## Fight Replay

- Replay actor painting now moves each active ally/enemy through one stable SVG group transform instead of rewriting every child circle, icon, clip path, label, and facing coordinate on every visual frame.
- Player clip geometry remains actor-local and uses collision-safe IDs.
- Enemy, mechanic, and cast markers use the same local-coordinate painting pattern.
- Replay position interpolation, coordinate transforms, track validity, discontinuity limits, event timing, and Intelligence handoff behavior are unchanged.
- New regression coverage verifies that rendered frames contain only the current actor transforms and do not carry the previous frame's actor positions in the generated SVG structure.

## Verification

- The upload hotfix passed TypeScript/build and the full frontend test suite; its runtime-changing commit also produced a READY Vercel preview before the project hit its daily preview-build quota.
- The Replay hotfix was rebased onto the upload hotfix and passed TypeScript/build and the full frontend test suite on the combined application state.
- Native desktop visual acceptance of the reported Replay paint-retention symptom remains the final real-world verification step for this hotfix build; the release notes do not claim an eyes-on WebView test that was not performed.