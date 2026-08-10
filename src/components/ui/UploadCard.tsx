import { useRef, useState, type DragEvent } from "react";
import { Inbox, File as FileJson, CircleAlert as AlertCircle, Link, Loader as Loader2 } from "lucide-react";

interface UploadCardProps {
  onFile: (file: File) => void;
  onUrl?: (url: string) => void;
  error?: string | null;
  loading?: boolean;
}

export default function UploadCard({ onFile, onUrl, error, loading }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    if (files && files.length > 0) onFile(files[0]);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragging) setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function handleUrlSubmit() {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      setUrlError("Enter a valid URL");
      return;
    }
    setUrlError(null);
    onUrl?.(trimmed);
  }

  if (loading) {
    return (
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 px-6 py-12 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-sky-300 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-bold text-slate-200">Loading report...</p>
            <p className="text-xs text-slate-500 mt-1">Parsing and validating data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-4">
      {/* File drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-8 cursor-pointer transition-all duration-200 outline-none focus:ring-2 focus:ring-sky-500/30 ${
          dragging
            ? "border-sky-300 bg-sky-500/10 shadow-[0_0_60px_rgba(56,189,248,0.15)]"
            : "border-white/10 bg-white/[0.018] hover:border-sky-400/40 hover:bg-sky-950/10"
        }`}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
            dragging ? "bg-sky-500/20 text-sky-200" : "bg-sky-500/5 text-sky-300/70"
          }`}
        >
          <Inbox className="w-6 h-6" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-200">
            {dragging ? "Drop to load saved report" : "Import saved report.json"}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Secondary path for already-exported Entropy/AxiBridge reports, or <span className="text-sky-300 font-semibold cursor-pointer">click to browse</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-1 bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/[0.04]">
          <FileJson className="w-3.5 h-3.5 text-sky-300/60" />
          <span>report.json fallback format</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* URL input */}
      {onUrl && (
        <>
          <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase font-bold tracking-widest">
            <div className="flex-1 h-px bg-sky-500/10" />
            or paste a saved report URL
            <div className="flex-1 h-px bg-sky-500/10" />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="url"
                value={urlValue}
                onChange={(e) => { setUrlValue(e.target.value); setUrlError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); }}
                placeholder="http://127.0.0.1:8080/combined_report.json"
                className="w-full bg-white/[0.03] border border-sky-500/10 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/20 transition-all"
              />
            </div>
            <button
              onClick={handleUrlSubmit}
              disabled={!urlValue.trim()}
              className="px-5 py-3 bg-sky-500/10 border border-sky-500/30 text-sky-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-sky-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Load
            </button>
          </div>
        </>
      )}

      {/* Error display */}
      {(error || urlError) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 backdrop-blur-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-300/90">{urlError || error}</p>
        </div>
      )}
    </div>
  );
}
