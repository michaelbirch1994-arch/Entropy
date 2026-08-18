// Small fixed-position toast for the desktop app's updater. It stays quiet
// when the app is already current, but it now shows update availability,
// install progress, finished installs, and actionable failures.
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import type { UpdateState } from "../../utils/useAutoUpdater";

interface UpdateToastProps extends UpdateState {
  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  restartNow: () => Promise<void>;
}

export default function UpdateToast({ status, version, progress, error, checkForUpdate, installUpdate, restartNow }: UpdateToastProps) {
  if (status !== "available" && status !== "downloading" && status !== "ready" && status !== "error") return null;

  const isBusy = status === "downloading";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-amber-500/30 bg-black/85 backdrop-blur-xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2">
      {status === "error" ? (
        <>
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-200">Update check failed</p>
            <p className="mt-0.5 truncate text-[10px] text-rose-200/80" title={error ?? undefined}>{error ?? "Could not reach the update server."}</p>
          </div>
          <button
            onClick={() => void checkForUpdate()}
            className="ml-2 flex-shrink-0 px-3 py-1.5 bg-rose-500/15 border border-rose-500/40 text-rose-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500/25 transition-all"
          >
            Retry
          </button>
        </>
      ) : status === "available" ? (
        <>
          <Download className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-200">
              Update {version ? `v${version} ` : ""}available
            </p>
            <p className="text-[10px] text-slate-500">Install it when you are ready.</p>
          </div>
          <button
            onClick={() => void installUpdate()}
            className="ml-2 flex-shrink-0 px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/25 transition-all"
          >
            Install
          </button>
        </>
      ) : status === "downloading" ? (
        <>
          <Download className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <div>
            <p className="text-xs font-bold text-slate-200">
              Installing update{version ? ` v${version}` : ""}...
            </p>
            <p className="text-[10px] text-slate-500 font-mono">{progress !== null ? `${progress}%` : "Working..."}</p>
          </div>
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-200">
              Update {version ? `v${version} ` : ""}ready
            </p>
            <p className="text-[10px] text-slate-500">Restart to apply it</p>
          </div>
          <button
            onClick={() => void restartNow()}
            disabled={isBusy}
            className="ml-2 flex-shrink-0 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/25 transition-all disabled:opacity-50"
          >
            Restart
          </button>
        </>
      )}
    </div>
  );
}
