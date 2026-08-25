import { useEffect, useState } from "react";
import { Check, CloudUpload, Copy, ExternalLink, LoaderCircle, ShieldAlert, X } from "lucide-react";
import type { WvWReport } from "../../types/report";
import {
  clearHostedReportOwnerKey,
  loadHostedReportOwnerKey,
  saveHostedReportOwnerKey,
  uploadHostedReport,
} from "../../lib/hostedReportShare";

type ShareStatus = "idle" | "uploading" | "success" | "error";

interface HostedReportShareModalProps {
  report: WvWReport;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HostedReportShareModal({ report, onClose }: HostedReportShareModalProps) {
  const [ownerKey, setOwnerKey] = useState(loadHostedReportOwnerKey);
  const [rememberKey, setRememberKey] = useState(() => Boolean(ownerKey));
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [artifactSize, setArtifactSize] = useState(0);
  const [copied, setCopied] = useState(false);

  async function copyShareUrl(url = shareUrl) {
    if (!url || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  async function handleUpload() {
    setStatus("uploading");
    setProgress(0);
    setError("");
    setShareUrl("");
    setCopied(false);

    try {
      const result = await uploadHostedReport(report, ownerKey, {
        currentHref: window.location.href,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      if (rememberKey) saveHostedReportOwnerKey(ownerKey);
      else clearHostedReportOwnerKey();

      setShareUrl(result.viewerUrl);
      setArtifactSize(result.sizeBytes);
      setProgress(100);
      setStatus("success");
      try {
        await copyShareUrl(result.viewerUrl);
      } catch {
        setCopied(false);
      }
    } catch (uploadError) {
      setStatus("error");
      setError(uploadError instanceof Error ? uploadError.message : "Hosted report upload failed.");
    }
  }

  const uploading = status === "uploading";
  const canUpload = Boolean(ownerKey.trim()) && privacyAccepted && !uploading;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !uploading) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, uploading]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="hosted-report-share-title"
        className="theme-modal w-full max-w-2xl border p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-theme-accentStrong">
              <CloudUpload className="h-4 w-4" />
              <h2 id="hosted-report-share-title" className="text-sm font-black uppercase text-theme-text">
                Share report to web
              </h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-theme-textMuted">{report.meta.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="theme-quiet-button grid h-8 w-8 shrink-0 place-items-center border disabled:opacity-50"
            aria-label="Close hosted report sharing"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="theme-alert-plate mt-5 border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p id="hosted-report-privacy-warning" className="text-xs leading-5">
              This uploads the report to a public, unlisted URL. Anyone with the link can view it. Reports may include account and
              character names, guild tags, timestamps, and combat behavior. Hosted reports do not expire automatically yet.
            </p>
          </div>
        </div>

        {status !== "success" ? (
          <>
            <label className="mt-5 block text-[10px] font-bold uppercase text-theme-faint" htmlFor="hosted-report-owner-key">
              Owner upload key
            </label>
            <input
              id="hosted-report-owner-key"
              type="password"
              value={ownerKey}
              onChange={(event) => {
                setOwnerKey(event.target.value);
                if (status === "error") {
                  setStatus("idle");
                  setError("");
                }
              }}
              disabled={uploading}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full border px-3 py-2 text-sm outline-none focus:border-theme-accent disabled:opacity-60"
            />

            <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-theme-textMuted">
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={(event) => setRememberKey(event.target.checked)}
                disabled={uploading}
                className="mt-1 h-4 w-4 accent-[var(--theme-accent)]"
              />
              Remember the owner key on this device.
            </label>

            <label className="mt-3 flex items-start gap-3 text-xs leading-5 text-theme-text">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
                disabled={uploading}
                aria-describedby="hosted-report-privacy-warning"
                className="mt-1 h-4 w-4 accent-[var(--theme-accent)]"
              />
              I understand this report will be public to anyone with its unlisted link.
            </label>

            {uploading && (
              <div className="mt-5" aria-live="polite">
                <div className="flex items-center justify-between text-xs text-theme-textMuted">
                  <span>Uploading report</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-black/40">
                  <div className="h-full bg-theme-accent transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 text-xs leading-5 text-rose-300" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={uploading} className="theme-quiet-button border px-4 py-2 text-xs font-bold disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={!canUpload}
                className="theme-command-button flex min-w-32 items-center justify-center gap-2 border px-4 py-2 text-xs font-bold text-theme-accentStrong disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                {uploading ? "Uploading" : "Upload report"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5" aria-live="polite">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <Check className="h-4 w-4" />
              Share link ready
            </div>
            <p className="mt-1 text-xs text-theme-textMuted">
              {copied ? "Copied to the clipboard." : "Copy the link below."} Uploaded artifact: {formatBytes(artifactSize)}.
            </p>
            <div className="mt-4 flex gap-2">
              <input value={shareUrl} readOnly aria-label="Hosted report share link" className="min-w-0 flex-1 border px-3 py-2 text-xs" />
              <button
                type="button"
                onClick={() => void copyShareUrl()}
                className="theme-quiet-button grid h-9 w-9 shrink-0 place-items-center border"
                aria-label="Copy hosted report share link"
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="theme-quiet-button border px-4 py-2 text-xs font-bold">
                Done
              </button>
              <button
                type="button"
                onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
                className="theme-command-button flex items-center gap-2 border px-4 py-2 text-xs font-bold text-theme-accentStrong"
              >
                <ExternalLink className="h-4 w-4" />
                Open report
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
