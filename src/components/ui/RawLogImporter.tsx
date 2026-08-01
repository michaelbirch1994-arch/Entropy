import { useRef, useState, type DragEvent } from "react";
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
} from "lucide-react";
import { isRawLogFile, uploadRawLogToDpsReport, fetchDpsReportJson, parseDpsReportPermalink } from "../../utils/dpsReport";
import { summarizeRawFight, type RawFightSummary, type RawFightLog } from "../../types/rawFight";
import { buildReportFromFights } from "../../lib/buildReportFromFights";
import { useReport } from "../../store/ReportContext";
import RawFightViewer from "./RawFightViewer";

interface QueueItem {
  key: string;
  label: string;
  status: "pending" | "uploading" | "fetching" | "done" | "error";
  summary?: RawFightSummary;
  raw?: RawFightLog;
  errorMsg?: string;
}

export default function RawLogImporter() {
  const { setReport } = useReport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<QueueItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [combining, setCombining] = useState(false);
  const [combineError, setCombineError] = useState<string | null>(null);

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

  async function handleCombine() {
    const fights = queue
      .filter((i) => selected.has(i.key) && i.status === "done" && i.summary && i.raw)
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
    <div className="w-full max-w-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-amber-400 transition-colors py-2"
      >
        <span className="flex items-center gap-1.5">
          <Swords className="w-3 h-3" />
          Import raw combat logs (.zevtc / dps.report links)
        </span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-3 mt-2">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Drop raw <span className="font-mono text-slate-400">.zevtc</span>/<span className="font-mono text-slate-400">.evtc</span> files
            or paste dps.report links below. Each fight is uploaded straight to dps.report for parsing, then pulled back
            in and shown here — click a finished fight to view its squad breakdown, or select several and combine them
            into a full raid report (MVPs, leaderboards, roster) using Entropy's own dashboard.
          </p>

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
                className="w-full bg-white/[0.03] border border-amber-500/10 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-amber-500/40 transition-all"
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
              {selected.size > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
                  <span className="text-[11px] font-semibold text-amber-300">
                    {selected.size} fight{selected.size === 1 ? "" : "s"} selected
                  </span>
                  <button
                    onClick={handleCombine}
                    disabled={combining}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
              <ul className="space-y-1.5">
              {queue.map((item) => {
                const isDone = item.status === "done" && item.summary && item.raw;
                const isSelected = selected.has(item.key);
                return (
                  <li
                    key={item.key}
                    role={isDone ? "button" : undefined}
                    tabIndex={isDone ? 0 : undefined}
                    onClick={isDone ? () => setViewing(item) : undefined}
                    onKeyDown={isDone ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewing(item); } } : undefined}
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
                          <Eye className="w-3 h-3" /> View
                        </span>
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
    </div>
  );
}
