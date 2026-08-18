import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  UploadCloud,
  Link,
  Loader as Loader2,
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle2,
  ExternalLink,
  Swords,
  Eye,
  Layers,
  Trophy,
  Folder,
  RefreshCw,
  X,
  Film,
} from "lucide-react";
import { isRawLogFile, uploadRawLogToDpsReport, fetchDpsReportJson, parseDpsReportPermalink } from "../../utils/dpsReport";
import { summarizeRawFight, type RawFightSummary, type RawFightLog } from "../../types/rawFight";
import { buildReportFromFights } from "../../lib/buildReportFromFights";
import { useReport } from "../../store/ReportContext";
import RawFightViewer from "./RawFightViewer";
import FightReplay from "./FightReplay";
import {
  isFolderWatchSupported,
  pickLogFolder,
  getSavedFolderHandle,
  checkPermission,
  clearFolderHandle,
  scanForLogFiles,
  loadSeenFileKeys,
  saveSeenFileKeys,
  fileKey,
} from "../../utils/folderWatcherFacade";

const AUTO_IMPORT_POLL_MS = 20000;

interface QueueItem {
  key: string;
  label: string;
  status: "pending" | "uploading" | "fetching" | "done" | "error";
  summary?: RawFightSummary;
  raw?: RawFightLog;
  errorMsg?: string;
}

export default function RawLogImporter({ cinematic = false }: { cinematic?: boolean }) {
  const { setReport } = useReport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [viewing, setViewing] = useState<QueueItem | null>(null);
  const [replaying, setReplaying] = useState<QueueItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [combining, setCombining] = useState(false);
  const [combineError, setCombineError] = useState<string | null>(null);
  const [viewingFullReportKey, setViewingFullReportKey] = useState<string | null>(null);
  const [fullReportError, setFullReportError] = useState<string | null>(null);

  // Local arcdps log-folder auto-import
  const folderSupported = isFolderWatchSupported();
  const [folderName, setFolderName] = useState<string | null>(null);
  const [folderStatus, setFolderStatus] = useState<"idle" | "connecting" | "watching" | "needs-permission" | "error">("idle");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [autoImportedCount, setAutoImportedCount] = useState(0);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const folderHandleRef = useRef<any>(null);
  const seenKeysRef = useRef<Set<string>>(loadSeenFileKeys());
  const scanningRef = useRef(false);

  function updateItem(key: string, patch: Partial<QueueItem>) {
    setQueue((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function toggleSelected(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function combineFights(items: QueueItem[]) {
    const fights = items
      .filter((i) => i.status === "done" && i.summary && i.raw)
      .map((i) => ({ summary: i.summary!, raw: i.raw! }));
    if (fights.length === 0) return;
    setCombining(true);
    setCombineError(null);
    try {
      const report = buildReportFromFights(fights);
      await setReport(report);
      setSelected(new Set());
    } catch (e) {
      setCombineError(e instanceof Error ? e.message : "Failed to combine fights into a report.");
    } finally {
      setCombining(false);
    }
  }

  async function handleCombine() {
    await combineFights(queue.filter((i) => selected.has(i.key)));
  }

  const doneItems = queue.filter((i) => i.status === "done" && i.summary && i.raw);

  async function handleCombineAll() {
    await combineFights(doneItems);
  }

  async function viewFullReport(item: QueueItem) {
    if (!item.summary || !item.raw) return;
    setViewingFullReportKey(item.key);
    setFullReportError(null);
    try {
      const report = buildReportFromFights([{ summary: item.summary, raw: item.raw }]);
      await setReport(report);
    } catch (e) {
      setFullReportError(e instanceof Error ? e.message : "Failed to build full report for this fight.");
    } finally {
      setViewingFullReportKey(null);
    }
  }

  async function processFile(file: File) {
    const key = `${file.name}-${file.size}-${Date.now()}`;
    setQueue((prev) => [{ key, label: file.name, status: "uploading" }, ...prev]);
    try {
      const uploaded = await uploadRawLogToDpsReport(file);
      updateItem(key, { status: "fetching" });
      const json = await fetchDpsReportJson(uploaded.permalink);
      updateItem(key, { status: "done", summary: summarizeRawFight(json, uploaded.permalink), raw: json });
    } catch (e) {
      updateItem(key, { status: "error", errorMsg: e instanceof Error ? e.message : "Upload failed" });
    }
  }

  async function processPermalink(permalink: string, label: string) {
    const key = `${permalink}-${Date.now()}`;
    setQueue((prev) => [{ key, label, status: "fetching" }, ...prev]);
    try {
      const json = await fetchDpsReportJson(permalink);
      updateItem(key, { status: "done", summary: summarizeRawFight(json, permalink), raw: json });
    } catch (e) {
      updateItem(key, { status: "error", errorMsg: e instanceof Error ? e.message : "Failed to load" });
    }
  }

  async function runFolderScan() {
    const handle = folderHandleRef.current;
    if (!handle || scanningRef.current) return;
    scanningRef.current = true;
    try {
      const found = await scanForLogFiles(handle);
      const fresh = found.filter((f) => !seenKeysRef.current.has(fileKey(f)));
      for (const f of fresh) {
        seenKeysRef.current.add(fileKey(f));
        void processFile(f.file);
        setAutoImportedCount((n) => n + 1);
      }
      if (fresh.length > 0) saveSeenFileKeys(seenKeysRef.current);
      setLastScanAt(new Date());
      setFolderStatus("watching");
      setFolderError(null);
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "Failed to scan log folder.");
    } finally {
      scanningRef.current = false;
    }
  }

  async function connectFolder() {
    setFolderStatus("connecting");
    setFolderError(null);
    try {
      const handle = await pickLogFolder();
      folderHandleRef.current = handle;
      setFolderName(handle.name ?? "log folder");
      // Mark everything currently in the folder as "seen" so we only auto-import
      // NEW logs going forward, not the entire backlog.
      const existing = await scanForLogFiles(handle);
      existing.forEach((f) => seenKeysRef.current.add(fileKey(f)));
      saveSeenFileKeys(seenKeysRef.current);
      setLastScanAt(new Date());
      setFolderStatus("watching");
    } catch (e) {
      // AbortError = user closed the picker without choosing a folder; not a real error.
      if (e instanceof Error && e.name === "AbortError") {
        setFolderStatus("idle");
      } else {
        setFolderStatus("error");
        setFolderError(e instanceof Error ? e.message : "Couldn't connect to that folder.");
      }
    }
  }

  async function reconnectFolder() {
    const handle = folderHandleRef.current;
    if (!handle) return connectFolder();
    setFolderStatus("connecting");
    const granted = await checkPermission(handle, true);
    if (granted) {
      setFolderStatus("watching");
      void runFolderScan();
    } else {
      setFolderStatus("needs-permission");
    }
  }

  async function disconnectFolder() {
    await clearFolderHandle();
    folderHandleRef.current = null;
    setFolderName(null);
    setFolderStatus("idle");
    setAutoImportedCount(0);
    setLastScanAt(null);
  }

  // On mount: silently resume watching a previously-connected folder if the
  // browser still remembers granting us permission - no picker/prompt needed.
  useEffect(() => {
    if (!folderSupported) return;
    (async () => {
      const handle = await getSavedFolderHandle();
      if (!handle) return;
      folderHandleRef.current = handle;
      setFolderName(handle.name ?? "log folder");
      const granted = await checkPermission(handle, false);
      if (granted) {
        setFolderStatus("watching");
        void runFolderScan();
      } else {
        setFolderStatus("needs-permission");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for new files while actively watching a connected folder.
  useEffect(() => {
    if (folderStatus !== "watching") return;
    const id = window.setInterval(() => void runFolderScan(), AUTO_IMPORT_POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderStatus]);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const valid: File[] = [];
    const invalid: string[] = [];
    Array.from(files).forEach((f) => (isRawLogFile(f) ? valid.push(f) : invalid.push(f.name)));
    valid.forEach((f) => void processFile(f));
    if (invalid.length > 0) {
      setLinkError(`Skipped non-log file${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleLinkSubmit() {
    const permalink = parseDpsReportPermalink(linkValue.trim());
    if (!permalink) {
      setLinkError("That doesn't look like a dps.report link or id.");
      return;
    }
    setLinkError(null);
    void processPermalink(permalink, permalink);
    setLinkValue("");
  }

  return (
    <div className={`w-full ${cinematic ? "theme-raw-ingress" : "max-w-lg"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-amber-400 transition-colors py-2"
      >
        <span className="flex items-center gap-1.5">
          <Swords className="w-3 h-3" />
          {cinematic ? "Combat record ingress" : "Import raw combat logs (.zevtc / dps.report links)"}
        </span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-3 mt-2">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Drop raw <span className="font-mono text-slate-400">.zevtc</span>/<span className="font-mono text-slate-400">.evtc</span> files
            or paste dps.report links below. Each fight is uploaded straight to dps.report for parsing, then pulled back
            in and shown here — click a finished fight for its full report (MVP cards, leaderboards, class/role
            breakdowns) on Entropy's own dashboard, or select several and combine them into one combined raid report.
          </p>

          {folderSupported ? (
            <div className="rounded-xl border border-amber-500/10 bg-white/[0.02] px-3.5 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <Folder className="w-3.5 h-3.5" />
                  Auto-import from local folder
                </span>
                {folderStatus === "watching" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Watching
                  </span>
                )}
              </div>

              {folderStatus === "idle" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Connect your <span className="font-mono text-slate-400">arcdps.cbtlogs</span> folder once, and Entropy
                    will auto-upload new fights while this tab is open.
                  </p>
                  <button
                    onClick={() => void connectFolder()}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/20 transition-all"
                  >
                    <Folder className="w-3 h-3" />
                    Connect Folder
                  </button>
                </div>
              )}

              {folderStatus === "connecting" && (
                <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for folder permission...
                </p>
              )}

              {folderStatus === "watching" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    {folderName}
                    {lastScanAt ? ` - last checked ${lastScanAt.toLocaleTimeString()}` : ""}
                    {autoImportedCount > 0 ? ` - ${autoImportedCount} auto-imported` : ""}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => void runFolderScan()}
                      title="Scan now"
                      className="text-slate-500 hover:text-amber-400 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void disconnectFolder()}
                      title="Disconnect folder"
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {folderStatus === "needs-permission" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    Permission for <span className="font-mono">{folderName}</span> needs to be re-confirmed.
                  </p>
                  <button
                    onClick={() => void reconnectFolder()}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/20 transition-all"
                  >
                    <Folder className="w-3 h-3" />
                    Reconnect
                  </button>
                </div>
              )}

              {folderStatus === "error" && folderError && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-300/90">{folderError}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-slate-500 italic">
              Local folder auto-import needs a Chromium-based browser (Chrome/Edge).
            </p>
          )}

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-all duration-200 outline-none ${
              dragging
                ? "border-amber-400 bg-amber-500/10"
                : "border-amber-500/15 bg-white/[0.02] hover:border-amber-400/40"
            }`}
          >
            <UploadCloud className={`w-5 h-5 ${dragging ? "text-amber-300" : "text-amber-400/60"}`} />
            <p className="text-xs font-semibold text-slate-300">
              Drop .zevtc files or <span className="text-amber-400">click to browse</span>
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".zevtc,.evtc,.evtc.zip"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={linkValue}
                onChange={(e) => { setLinkValue(e.target.value); setLinkError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleLinkSubmit(); }}
                placeholder="https://dps.report/..."
                className="w-full bg-white/[0.03] border border-amber-500/10 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-amber-500/40 transition-all"
              />
            </div>
            <button
              onClick={handleLinkSubmit}
              disabled={!linkValue.trim()}
              className="px-3.5 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Load
            </button>
          </div>

          {linkError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-300/90">{linkError}</p>
            </div>
          )}

          {queue.length > 0 && (
            <>
              {doneItems.length >= 2 && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5">
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-300">
                      {doneItems.length} fights finished parsing
                    </p>
                    <p className="text-[10px] text-slate-500">Combine every one into a single raid report - no need to select anything below.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCombineAll()}
                    disabled={combining}
                    className="relative z-10 flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/25 active:bg-emerald-500/35 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {combining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                    Combine All ({doneItems.length})
                  </button>
                </div>
              )}
              {selected.size > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
                  <span className="text-[11px] font-semibold text-amber-300">
                    {selected.size} fight{selected.size === 1 ? "" : "s"} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCombine()}
                    disabled={combining}
                    className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/25 active:bg-amber-500/35 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {combining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                    Combine into report
                  </button>
                </div>
              )}
              {combineError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-300/90">{combineError}</p>
                </div>
              )}
              {fullReportError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-300/90">{fullReportError}</p>
                </div>
              )}
              <ul className="space-y-1.5">
              {queue.map((item) => {
                const isDone = item.status === "done" && item.summary && item.raw;
                const isSelected = selected.has(item.key);
                const isBuildingFullReport = viewingFullReportKey === item.key;
                return (
                  <li
                    key={item.key}
                    role={isDone ? "button" : undefined}
                    tabIndex={isDone ? 0 : undefined}
                    onClick={isDone ? () => void viewFullReport(item) : undefined}
                    onKeyDown={isDone ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void viewFullReport(item); } } : undefined}
                    className={`flex items-center justify-between gap-3 bg-white/[0.02] border rounded-lg px-3 py-2 transition-colors ${
                      isSelected ? "border-amber-500/40 bg-amber-500/[0.05]" : "border-white/[0.05]"
                    } ${isDone ? "cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/[0.04]" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isDone && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(item.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 flex-shrink-0 accent-amber-500 cursor-pointer"
                        />
                      )}
                      {item.status === "uploading" || item.status === "fetching" ? (
                        <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin flex-shrink-0" />
                      ) : item.status === "done" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          {item.summary?.fightName ?? item.label}
                        </p>
                        {item.status === "uploading" && <p className="text-[10px] text-slate-500">Uploading to dps.report...</p>}
                        {item.status === "fetching" && <p className="text-[10px] text-slate-500">Fetching parsed log...</p>}
                        {item.status === "error" && <p className="text-[10px] text-rose-400">{item.errorMsg}</p>}
                        {item.status === "done" && item.summary && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            {item.summary.duration} - {item.summary.squadSize} in squad
                            {item.summary.commander ? ` - Cmdr ${item.summary.commander}` : ""}
                            {" - "}
                            <span className={item.summary.success ? "text-emerald-400" : "text-rose-400"}>
                              {item.summary.success ? "Success" : "Failed"}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                    {isDone && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
                          {isBuildingFullReport ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" /> Building
                            </>
                          ) : (
                            <>
                              <Trophy className="w-3 h-3" /> Full Report
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setViewing(item); }}
                          title="Quick peek (squad table only, no MVPs)"
                          className="text-slate-500 hover:text-amber-400 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setReplaying(item); }}
                          title="Replay (scrubbable 2D positions, if available)"
                          className="text-slate-500 hover:text-amber-400 transition-colors"
                        >
                          <Film className="w-3.5 h-3.5" />
                        </button>
                        {item.summary?.permalink && (
                          <a
                            href={`https://dps.report/${item.summary.permalink}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open on dps.report"
                            className="text-amber-400/50 hover:text-amber-400 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              </ul>
            </>
          )}
        </div>
      )}

      {viewing && viewing.summary && viewing.raw && (
        <RawFightViewer summary={viewing.summary} log={viewing.raw} onClose={() => setViewing(null)} />
      )}
      {replaying && replaying.raw && (
        <FightReplay log={replaying.raw} onClose={() => setReplaying(null)} />
      )}
    </div>
  );
}
