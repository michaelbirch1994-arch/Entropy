# Packaging Entropy as a Tauri desktop app

## What's ready (this pass)

- `src-tauri/Cargo.toml`, `build.rs`, `tauri.conf.json`, `src/main.rs` — minimal Tauri v2 shell, points at the existing `dist/` Vite build, no code changes to the shell needed as the app grows.
- `tauri-frontend-additions/utils/runtime.ts` — detects `window.__TAURI_INTERNALS__` to tell desktop vs browser at runtime.
- `tauri-frontend-additions/utils/folderWatcher.native.ts` — reimplements every function in `src/utils/folderWatcher.ts` using `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` instead of the browser File System Access API. This is the fix for the "Connect Folder" limitation (task #52) — it works on Windows/macOS/Linux uniformly, not just Chromium, and the picked folder persists without a permission re-grant dance.
- `tauri-frontend-additions/utils/folderWatcherFacade.ts` — picks whichever implementation matches the runtime, so `RawLogImporter.tsx` doesn't need an if/else — it just imports from the facade.

## Scoping notes (confirmed by reading the actual repo, not assumed)

- No React Router — navigation is state-based tabs in `App.tsx`, so there's no history-API/base-path complication moving to `tauri://localhost`.
- No Node-only APIs anywhere in `src/` — nothing to strip out.
- Storage (`playerProfileStore.ts`, `reportCache.ts`) uses IndexedDB/localStorage, which works unchanged in Tauri's webview.
- One thing to double check once the app actually builds: `src/Styles/Global.css:95` hardcodes `url("/images/nebula-bg.jpg")` as a root-absolute path rather than using `import.meta.env.BASE_URL` like `ReportContext.tsx` does. Tauri v2 typically resolves root-absolute paths against the bundled `dist/` the same way a normal site at `/` would, so this will probably just work, but it's the one path-resolution assumption in the codebase worth a visual smoke test after the first `tauri build`.

## Remaining steps to actually turn this into a running app

1. Move `src-tauri/` into the repo root, and merge `tauri-frontend-additions/utils/*` into `src/utils/`.
2. Add to `package.json`:
   - `devDependencies`: `"@tauri-apps/cli": "^2"`
   - `dependencies`: `"@tauri-apps/api": "^2"`, `"@tauri-apps/plugin-fs": "^2"`, `"@tauri-apps/plugin-dialog": "^2"`
   - `scripts`: `"tauri": "tauri"`
3. Generate real app icons from `public/favicon.svg` via `npx tauri icon public/favicon.svg` (needs the Tauri CLI installed first) — placeholder icon paths are already referenced in `tauri.conf.json`.
4. Change the one import line in `RawLogImporter.tsx` from `"../../utils/folderWatcher"` to `"../../utils/folderWatcherFacade"`.
5. Install the Rust toolchain (this can't be done from a browser-only workflow — needs `rustup` on whatever machine actually builds/runs it) and run `npx tauri dev` to test locally, then `npx tauri build` for a distributable installer.

Step 5 is the one part of this that can't happen through StackBlitz/GitHub web-upload — Tauri compiles a real native binary, so it needs an actual machine with Rust installed (your own computer, or a CI runner like GitHub Actions with `tauri-apps/tauri-action`).
