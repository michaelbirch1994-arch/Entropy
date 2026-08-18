// Checks for a new desktop build once per launch and exposes a manual retry /
// install flow for the toast UI. Entropy ships fast, so updater failures need
// to be visible enough to diagnose instead of disappearing into the console.
// Entirely a no-op outside the Tauri desktop shell (the web/StackBlitz build
// has no updater plugin wired up and nothing to update itself into).
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "./runtime";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "up-to-date";

export interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  progress: number | null; // 0-100, null while the download size is unknown
  error: string | null;
}

type TauriUpdaterModule = typeof import("@tauri-apps/plugin-updater");
type TauriUpdate = Awaited<ReturnType<TauriUpdaterModule["check"]>>;

function describeUpdaterError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  return "Update check failed";
}

export function useAutoUpdater(): UpdateState & { checkForUpdate: () => Promise<void>; installUpdate: () => Promise<void>; restartNow: () => Promise<void> } {
  const [state, setState] = useState<UpdateState>({ status: "idle", version: null, progress: null, error: null });
  const checkedRef = useRef(false);
  const updateRef = useRef<TauriUpdate>(null);

  const checkForUpdate = useCallback(async () => {
    if (!isTauriRuntime()) return;

    try {
      updateRef.current = null;
      setState((s) => ({ ...s, status: "checking", progress: null, error: null }));
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check({ timeout: 30000 });
      if (!update) {
        setState((s) => ({ ...s, status: "up-to-date", version: null, progress: null, error: null }));
        return;
      }

      updateRef.current = update;
      setState((s) => ({ ...s, status: "available", version: update.version, progress: null, error: null }));
    } catch (e) {
      const message = describeUpdaterError(e);
      console.warn("Entropy update check failed:", e);
      setState((s) => ({ ...s, status: "error", progress: null, error: message }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!isTauriRuntime()) return;

    try {
      let update = updateRef.current;
      if (!update) {
        const { check } = await import("@tauri-apps/plugin-updater");
        update = await check({ timeout: 30000 });
        updateRef.current = update;
      }
      if (!update) {
        setState((s) => ({ ...s, status: "up-to-date", version: null, progress: null, error: null }));
        return;
      }

      setState((s) => ({ ...s, status: "downloading", version: update?.version ?? s.version, progress: null, error: null }));

      let total = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            downloaded = 0;
            setState((s) => ({ ...s, progress: total > 0 ? 0 : null }));
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setState((s) => ({
              ...s,
              progress: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null,
            }));
            break;
          case "Finished":
            break;
        }
      }, { timeout: 120000 });

      setState((s) => ({ ...s, status: "ready", progress: 100, error: null }));
    } catch (e) {
      const message = describeUpdaterError(e);
      console.warn("Entropy update install failed:", e);
      setState((s) => ({ ...s, status: "error", progress: null, error: message }));
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime() || checkedRef.current) return;
    checkedRef.current = true;
    void checkForUpdate();
  }, [checkForUpdate]);

  async function restartNow() {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  }

  return { ...state, checkForUpdate, installUpdate, restartNow };
}
