# Entropy v0.2.78

## Desktop WvW upload recovery

- Raw WvW uploads now accept the reusable `wvw.report` permalink returned by the dps.report upload service.
- This restores desktop folder-watcher and manual `.zevtc` / `.evtc` intake when the service returns its WvW viewer domain instead of a `dps.report` URL.
- Raw logs still must produce a reusable permalink before a fight can enter Entropy. Cancellation, rate limiting, retry, and report-fetch behavior are unchanged.

## Legacy report compatibility

- Older reports that split one account across profession or build rows are normalized when read by Defensive Stats, Offensive Stats, Conditions, Top Players, HTML exports, and Discord leader summaries.
- Player sample context now aggregates compatible legacy rows by account.
- Stability and dodge source leaderboards use the normalized player sources already present in the report.
- These compatibility changes do not alter combat calculations, metric definitions, Elite Insights interpretation, aggregation formulas for newly built reports, or Intelligence scoring.

## Profiles and shared reports

- Reports loaded from hosted permalink collections or Entropy report artifacts are now recorded into Player Profiles in the same way as locally opened reports.

## Obsidian Gold acceptance

- The cross-view return trail now receives the shared Obsidian Gold surface, border, text, and accent tokens even when it renders beside the application shell.
- Replay Intelligence remains neutral while idle and uses restrained gold only for selected evidence and focus.
- Representative six-fight acceptance passed across the major desktop workspaces and both protected hosted previews, including mobile samples, with no page-level overflow or browser-console errors.

## Verification

- The production TypeScript and Vite build passed.
- All 74 test files and 435 tests passed.
- Lint completed without errors; the repository's existing warnings remain unchanged.
- Native installers and updater artifacts are built and signed by the repository's established multi-platform release workflow when the release tag is published.
