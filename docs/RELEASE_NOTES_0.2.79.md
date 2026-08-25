# Entropy v0.2.79

## Bulk raw-log imports

- Multi-file imports now expose batch progress, active work, per-file cancellation and retry, and a one-click `Combine All` action after parsing finishes.
- Raw-log uploads are queued to avoid overwhelming dps.report, while parsed-report fetches use bounded parallel work so one slow response does not freeze the rest of the batch.
- Upload and fetch requests now have finite timeouts, bounded retry behavior for transient service responses, and clearer errors when a log cannot be completed.
- A production acceptance batch of 12 real `.zevtc` files reached 100%, with all 12 fights parsed and combined successfully and no retries or failures.

## Commander Stats & Highlights

- Commander Stats and Highlights now share one focused workspace with `Stats` and `Highlights` views.
- Reports with multiple commanders provide direct commander selection and commander-scoped led-fight totals, duration, force context, trade metrics, tag survivability, and fight ledger evidence.
- Commander highlights are scoped to the selected commander's fights. MVP down contribution is displayed as an absolute contribution value rather than a percentage.
- Empty states remain explicit when a commander has no qualifying recorded highlights.

## Hosted report sharing

- Entropy can publish versioned JSON report artifacts through the guarded production upload endpoint and open the resulting unlisted report in the hosted viewer.
- Hosted uploads require the owner key, accept only bounded JSON report paths, and issue short-lived upload authorization. The owner key is not bundled into the desktop or web application.
- Shared report artifacts load through the canonical Entropy production viewer without changing the report's analytics or combat semantics.

## Verification

- TypeScript checking, the production Vite build, all 78 test files and 455 tests, and lint completed successfully. Lint reported no errors; existing advisory warnings remain.
- Pull-request CI and both Vercel checks passed before the implementation changes were merged.
- Production desktop-width and mobile-width acceptance passed for Commander Stats & Highlights, the shared six-fight artifact, and Replay Intelligence idle and selected-evidence states, with no page overflow or browser-console errors.
- The upload endpoint rejected an invalid owner key with `401 Unauthorized`, and Vercel reported no production runtime errors.
- Native installers and updater artifacts are built and signed by the repository's established multi-platform release workflow after the release tag is published.

No combat calculations, metric definitions, Elite Insights interpretation, aggregation formulas, or Intelligence scoring changed in this release.
