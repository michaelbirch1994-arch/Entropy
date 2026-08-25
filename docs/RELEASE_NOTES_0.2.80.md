# Entropy v0.2.80

## Overview MVP styling

- The Bronze tier inside both Overview MVP cards now uses the Obsidian Gold theme surface instead of the legacy cool slate panel.
- Bronze retains its ranking label and divider, while hover and keyboard-focus feedback now use the shared theme tokens.
- MVP ranking, account navigation, analytics, and combat calculations are unchanged.

## Verification

- TypeScript checking and the production Vite build completed successfully.
- All 78 test files and 455 tests passed.
- Lint completed with no errors; existing advisory warnings remain.
- Pull-request CI and both Vercel preview checks passed before merge.
- The installed v0.2.79 desktop app was inspected to confirm the reported Bronze surface mismatch before the targeted correction.

Native installers and updater artifacts are built and signed by the repository's established multi-platform release workflow after the release tag is published.
