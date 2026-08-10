import { useMemo, useState } from "react";
import { Braces, CheckCircle2, ClipboardPaste, Eraser, FlaskConical, TriangleAlert } from "lucide-react";
import { decodeAxiForgeCode, detectAxiForgeCodeKind, type AxiForgeDecodeResult } from "../lib/axiforge/axiForgeAdapter";

function kindLabel(kind: AxiForgeDecodeResult["kind"]): string {
  if (kind === "build") return "Build code";
  if (kind === "comp") return "Comp code";
  return "Unknown format";
}

export default function AxiForgeLabView() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<AxiForgeDecodeResult | null>(null);
  const detectedKind = useMemo(() => detectAxiForgeCodeKind(code), [code]);

  const preview = useMemo(() => {
    if (!result?.ok) return null;
    try {
      return JSON.stringify(result.value, null, 2);
    } catch {
      return null;
    }
  }, [result]);

  function handleDecode() {
    setResult(decodeAxiForgeCode(code));
  }

  function handleClear() {
    setCode("");
    setResult(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <section className="rounded-[2rem] border border-white/[0.06] bg-black/45 p-6 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-3 text-sky-300">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-100">AxiForge Lab</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Paste a build or composition code to inspect its decoded data. Nothing is saved or added to a report.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-6">
        <label htmlFor="axiforge-code" className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Build or comp code
        </label>
        <textarea
          id="axiforge-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setResult(null);
          }}
          placeholder="Paste a code here..."
          spellCheck={false}
          className="mt-3 min-h-36 w-full resize-y rounded-2xl border border-white/10 bg-black/45 p-4 font-mono text-sm text-slate-200 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
            detectedKind === "unknown"
              ? "border-white/10 bg-white/[0.03] text-slate-400"
              : "border-sky-400/20 bg-sky-500/10 text-sky-300"
          }`}>
            {code.trim() ? kindLabel(detectedKind) : "Waiting for code"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={!code && !result}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:border-white/20 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Eraser className="h-4 w-4" /> Clear
            </button>
            <button
              type="button"
              onClick={handleDecode}
              disabled={!code.trim()}
              className="flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ClipboardPaste className="h-4 w-4" /> Decode
            </button>
          </div>
        </div>
      </section>

      {result && !result.ok && (
        <section role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] p-4 text-rose-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold">This code could not be decoded.</div>
            <p className="mt-1 text-sm text-rose-200/75">Check that the complete build or comp code was pasted, then try again.</p>
          </div>
        </section>
      )}

      {result?.ok && (
        <section className="overflow-hidden rounded-[2rem] border border-emerald-400/15 bg-black/35">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Decoded {kindLabel(result.kind).toLowerCase()}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Braces className="h-4 w-4" /> JSON preview
            </div>
          </div>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-slate-300">
            {preview ?? "Decoded data cannot be displayed as JSON."}
          </pre>
        </section>
      )}
    </div>
  );
}

