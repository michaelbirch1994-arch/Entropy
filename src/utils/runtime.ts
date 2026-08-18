// Detects whether the app is running inside the Tauri desktop shell vs a
// regular browser tab. Tauri v2 injects `window.__TAURI_INTERNALS__` into
// every page it hosts; that property is absent in any normal browser,
// including the StackBlitz preview and a plain Vercel-hosted tab, so this
// check is a reliable way to branch runtime-only behavior (like which
// folder-watching implementation to use) without a build-time flag.
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
