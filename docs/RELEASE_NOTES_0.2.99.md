# Entropy v0.2.99

## Builder viewing and hierarchy

- Saved builds now open from Library and Squad in a focused viewer instead of silently replacing the active editing draft.
- The viewer has dedicated Build and Equipment tabs, a stable URL, browser Back support, explicit Edit and new-tab actions, focus restoration, keyboard tab behavior, and reduced-motion support.
- Desktop editing now uses the full available canvas by default, with readiness and Inspector details available through an optional side rail.
- Equipment editing is separated into Weapons, Armor & Trinkets, Upgrades, and Consumables so only relevant controls and summaries appear together.
- Import and Save remain primary actions while code copying, chat code, and sharing are grouped in a quieter Export menu.

## Build presentation and legal choices

- Traits & Skills now reads as a cohesive loadout canvas with a profession header, combat bar, compact specialization rows, and utility dock.
- Shared combat-bar and build-summary components keep Library, Squad, Preview, and viewer presentation aligned.
- Land skill choices include core profession skills plus only skills belonging to the selected elite specialization. Incompatible imported values remain visible and repairable.
- Revenant legend choices follow the selected elite specialization, and Ranger pet choices exclude aquatic-only pets while preserving valid amphibious pets.
- Profession mechanics, Ranger pets, armor slot stats, equipment icons, and weapon-set previews received verified catalog-backed presentation improvements.
- Raw imported IDs remain available in the advanced inspector without cluttering the normal workflow.

## Guardrails

- This release does not change report parsing, metric formulas, aggregation, rankings, scoring, denominators, or output meaning.
- Builder attribute formulas, boon and condition estimation, AxiCode semantics, and saved build values are unchanged by the visual restructuring.
- The work is limited to observed Builder hierarchy, interaction, accessibility, responsive layout, catalog filtering, and presentation needs.

## Verification

- The focused viewer was exercised in the running app for Library opening, Build and Equipment switching, URL state, browser Back closing, and focus restoration.
- All 537 automated tests pass across 92 test files.
- TypeScript and the production Vite build pass. Lint has no new errors; existing unrelated warnings remain.

Native installers and updater artifacts are built and signed by the repository's established multi-platform release workflow after the release tag is published.
