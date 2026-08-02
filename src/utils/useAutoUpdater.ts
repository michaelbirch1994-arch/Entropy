// Checks for a new desktop build exactly once per app launch (not on any
// interval/poll) and, if one exists, silently downloads and installs it in
// the background. Restarting into the new version is left up to the user
// via the toast this drives - an update should never yank the app out from
// under someone mid-session. Entirely a no-op outside the Tauri desktop
// shell (the web/StackBlitz build has no updater plugin wired up and
// nothing to update itself into).
import { useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "./runtime";

export type UpdateStatus = "idle" | "checking" | "downloading" | "ready" | "error" | "up-to-date";

export interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  progress: number | null; // 0-100, null while the download size is unknown
  error: string | null;
}

export function useAutoUpdater(): UpdateState & { restartNow: () => void } {
  const [state, setState] = useState<UpdateState>({ status: "idle", version: null, progress: null, error: null });
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!isTauriRuntime() || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        setState((s) => ({ ...s, status: "checking" }));
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!update) {
          setState((s) => ({ ...s, status: "up-to-date" }));
          return;
        }

        setState((s) => ({ ...s, status: "downloading", version: update.version }));

        let total = 0;
        let downloaded = 0;
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              total = event.data.contentLength ?? 0;
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
        });

        setState((s) => ({ ...s, status: "ready", progress: 100 }));
      } catch (e) {
        // Failing quietly here is deliberate - a broken update check (e.g.
        // no network, GitHub rate limit) shouldn't ever surface as an error
        // state the user has to deal with. It's logged for debugging only.
        console.warn("Entropy auto-update check failed:", e);
        setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Update check failed" }));
      }
    })();
  }, []);

  async function restartNow() {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  }

  return { ...state, restartNow };
}
