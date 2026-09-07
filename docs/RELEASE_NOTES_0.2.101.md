# Entropy v0.2.101

## Builder presentation

- Entropy Builder now uses cleaner, more cohesive build, equipment, library, squad, and preview surfaces with restrained borders, compact icon-led controls, and more consistent hierarchy.
- Specialization tracks present each tier as a vertical trait ladder while keeping the three tiers readable from left to right.
- Build detail sheets expose utility skills, active weapon sets, selected traits, equipment artwork, and live build metadata without crowding the primary workspace.
- Equipment editing includes a live attribute panel that updates as gear, upgrades, relics, and supported consumables change.

## Builder behavior

- Utility skills and selected traits contribute their detected boon and condition access to squad coverage.
- Skill details surface detected effects and combat facts in the inspector.
- Guild Wars 2 build codes and supported gw2skills.net links import more reliably, and Entropy share links retain build state without Axiforge-facing labels.
- Builder URLs use the public `entropy-builder` route while preserving compatibility with the existing internal view identifier.

## Corrections and polish

- Squad distance summaries reject invalid coordinate readings instead of displaying impossible values.
- Builder detail panels, chart-bearing tabs, and expandable surfaces use more stable motion and responsive containment.
- Condition artwork and compact equipment previews use corrected catalog-backed imagery where available.

## Verification

- All 584 automated tests pass across 102 test files.
- TypeScript checking, focused lint, browser visual review, and the production Vite build pass.
- Version metadata is synchronized across the web package and desktop application manifests.
