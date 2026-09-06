# Entropy v0.2.100

## Builder workspace

- Entropy Builder now uses a quieter, more focused workspace hierarchy across Overview, Traits & Skills, Equipment, Library, Squad, Notes, and Preview.
- Saved builds open in a dedicated viewer with stable URL state, browser Back behavior, accessible tabs, explicit editing and sharing actions, and responsive inspector controls.
- Squad composition uses compact visual assignment slots, clearer subgroup structure, keyboard-accessible move controls, improved empty states, and denser boon and condition coverage.
- Utility skills, profession mechanics, weapon sets, specialization choices, and equipment summaries use consistent icon-led controls and focused searchable pickers.

## Equipment and imports

- Armor, weapons, trinkets, upgrades, infusions, relics, and consumables now use compact catalog-backed artwork throughout editing and preview surfaces.
- Equipment stat selectors offer the curated level-80 WvW combinations supported by the Builder instead of low-level API prefixes such as Mighty, Precise, Mending, and Penetrating.
- Raw Guild Wars 2 build template codes and complete public gw2skills.net editor links now import through the Builder, including local Vite development.
- Land weapon-skill resolution prefers the correct terrestrial skill set for weapons such as Guardian spear.
- Trinket artwork remains compact in both embedded and expanded previews.

## Interface polish

- Top Players detail cards open and close with smoother, layout-stable motion and improved focus behavior.
- Fight Replay restores its map background when map imagery is available.
- Shared panel headings no longer inherit card chrome, removing unintended boxes around titles and descriptive text across report tabs.
- Builder surfaces received responsive containment, overflow, reduced-motion, focus-trap, and mobile action refinements.

## Guardrails

- This release does not change report parsing, metric formulas, aggregation, rankings, scoring, denominators, or output meaning.
- Builder equipment filtering and presentation do not alter saved metric data or report calculations.

## Verification

- All 560 automated tests pass across 98 test files.
- TypeScript, focused lint, desktop and mobile browser checks, and the production Vite build pass.
- The guarded release workflow verifies matching versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` before creating the immutable release tag.

Native installers and updater artifacts are built and signed by the repository's established multi-platform release workflow after the release tag is published.
