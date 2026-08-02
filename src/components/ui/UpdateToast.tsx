// Small fixed-position toast for the desktop app's auto-updater. Renders
// nothing until there's actually something to tell the user: a download in
// progress, or a finished update waiting for a restart to take effect.
// Deliberately does not surface "checking" or "up-to-date" states - the
// whole point of checking on launch (rather than polling) is that this
// should be invisible almost all of the time.
import { Download, RefreshCw } from "lucide-react";
import type { UpdateState } from "../../utils/useAutoUpdater";

interface UpdateToastProps extends UpdateState {
  restartNow: () => void;
}

export default function UpdateToast({ status, version, progress, restartNow }: UpdateToastProps) {
  if (status !== "downloading" && status !== "ready") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-black/80 backdrop-blur-xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2">
      {status === "downloading" ? (
        <>
          <Download className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <div>
            <p className="text-xs font-bold text-slate-200">
              Downloading update{version ? ` v${version}` : ""}...
            </p>
            {progress !== null && <p className="text-[10px] text-slate-500 font-mono">{progress}%</p>}
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
            onClick={restartNow}
            className="ml-2 flex-shrink-0 px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/25 transition-all"
          >
            Restart now
          </button>
        </>
      )}
    </div>
  );
}
