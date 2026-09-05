# Entropy v0.2.98

## Builder and product polish

- Entropy Builder now separates Overview, Traits & Skills, Equipment, Notes, and Preview into focused workspaces while preserving all existing build fields.
- The shared combat bar presents profession-aware weapon skills beside health and supports display-only weapon-set inspection without changing saved build state.
- Builder navigation, identity controls, equipment presentation, readiness, inspector tools, library empty states, squad composition, deletion confirmation, and mobile layouts received a complete hierarchy and usability pass.
- An AxiForge-informed visual foundation makes the Builder quieter and denser with compact black-and-gold editor chrome, restrained surfaces, readable equipment controls, and reduced decorative glow.
- Top Players card disclosure motion and shared UI surfaces were refined to reduce visual jumps and improve keyboard, focus, and screen-reader behavior.
- Defensive healing cards now use the established player-card presentation and place rank consistently in the top-right corner.

## Peak 1s damage

- Top Players includes the previously requested Peak 1s Damage leaderboard with nine entries, complete recorded-second context, source-fight attribution, participation context, and the same card structure as the other leaderboard tabs.
- Focused tests cover burst-window calculation, leaderboard normalization, panel presentation, and weapon-skill resolution.

## Guardrails

- This release packaging pass does not change report parsing, existing metric formulas, aggregation, scoring, rankings, denominators, or output meaning.
- Builder weapon swapping is display-only and does not modify report metrics, equipment selections, attribute calculations, or encoded build state.
- UI changes were limited to observed layout, interaction, accessibility, responsiveness, and consistency issues.

## Verification

- Builder browser checks passed at 390px, 768px, and 1280px with no page-level horizontal overflow or application console errors.
- TypeScript, focused Builder tests, lint, and the production Vite build passed before release preparation.
- The guarded release workflow validates matching versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` before creating the immutable release tag.

Native installers and updater artifacts are built and signed by the repository's established multi-platform release workflow after the release tag is published.
