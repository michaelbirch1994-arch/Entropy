# Entropy v0.2.97

## UX/UI audit polish

- Navigation shell, topbar menus, compact sidebar labels, and no-report sidebar scoping were tightened so report-only destinations stay out of the way until report data exists.
- Builder controls now expose clearer keyboard, tab, picker, selected-state, import, notice, library, squad, trait, and form-control semantics.
- Import, archive, compare, replay, raw fight viewer, and report form controls now expose explicit accessible names where they previously relied on icons, titles, placeholders, or nearby visual context.
- Defensive healing MVP cards now use the shared player-card structure, including Top Players-style top-right rank placement.
- Shared product chrome, Intelligence panels, tables, modals, cards, and analytical surfaces received a cohesion pass to reduce visual drift.

## Guardrails

- Combat metrics, parsing, aggregation, scoring, report contracts, Replay calculations, and output values were not changed.
- Polish work was limited to verified UI, accessibility, navigation, presentation, and documentation gaps.

## Verification

- TypeScript checks passed during the polish sequence.
- Production Vite builds passed with only the known pre-existing Vite warnings around browser-externalized `zlib`, Tauri chunking, and large bundle size.
- GitHub/Vercel checks passed after each green follow-up: `build`, `build-and-test`, and `deploy`.
- The guarded release workflow validates matching versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` before creating the immutable release tag.

Native installers and updater artifacts are built and signed by the repository's established multi-platform release workflow after the release tag is published.
