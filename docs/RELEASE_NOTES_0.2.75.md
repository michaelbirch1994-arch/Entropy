# Entropy v0.2.75

## Reliable shared reports

- Raw EVTC uploads are accepted only when dps.report returns a reusable permalink, preventing reports that later fail with “No dps.report link.”
- Transient dps.report rate-limit and service failures retry safely, while rejected or malformed uploads now show a clear error instead of entering the report.
- Multi-file uploads are processed in order to reduce rate-limit pressure, and the import queue shows each saved permalink.

## Complete gw2skills.net Builder import

- Entropy Builder can import a complete public `gw2skills.net/editor` URL alongside existing Entropy build and squad codes.
- Profession, specializations, traits, terrestrial and aquatic skills, profession-specific selections, weapons, stats, runes, sigils, relics, consumables, trinkets, enrichments, and infusions are carried into the editable Builder workspace.
- Supported upgrades are normalized to official Guild Wars 2 item IDs so they survive Entropy save/export workflows.
- Source-only upgrade names remain visible with an explicit warning when the current Entropy code format cannot represent their exact IDs.

## Safe desktop and web integration

- The Vercel viewer uses a restricted same-origin import endpoint with HTTPS host, path, redirect, and response-size validation.
- The desktop app uses a native importer with the same validation, avoiding browser cross-origin failures.
- Remote page scripts are never executed, and no attribution or author text was added.

## Verification

- TypeScript passed.
- Production build passed.
- Full frontend suite passed: 64 files and 409 tests.
- Live public gw2skills import endpoint passed against a real saved build.
- Native Rust compilation is delegated to release CI because the local environment does not include a Rust toolchain.
