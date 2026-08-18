// Client-side integration with dps.report's public API.
//
// dps.report exposes two relevant endpoints, both CORS-enabled so they can
// be called directly from a browser with no backend server involved:
//   - POST https://dps.report/uploadContent  — accepts a raw .evtc/.zevtc
//     file, runs it through Elite Insights server-side, and returns a
//     permalink. This is how Entropy avoids needing the native EI parser
//     (a compiled .NET tool) to run locally or in a browser at all.
//   - GET  https://dps.report/getJson?permalink=... — returns the full
//     Elite Insights JSON for an already-uploaded (or externally shared)
//     log.
//
// Both endpoints return a single fight's raw EI JSON — the same shape as
// what you'd get from running Elite Insights locally on one .zevtc file.
// This is NOT the aggregated multi-fight report.json that Entropy's main
// viewer renders; it's the raw input Entropy's aggregation pipeline
// consumes. See RawFightSummary / summarizeRawFight for what Entropy does
// with it today (a lightweight per-fight summary, not a full dashboard).

export interface DpsReportUploadResult {
  id: string;
  permalink: string;
  uploadTime?: number;
  encounter?: {
    success?: boolean;
    duration?: number;
    [k: string]: unknown;
  };
  error?: string;
}

const UPLOAD_ENDPOINT =
  "https://dps.report/uploadContent?json=1&generator=ei&detailedwvw=true";
const JSON_ENDPOINT = "https://dps.report/getJson";

/** Accepts .evtc/.zevtc/.evtc.zip files. */
export function isRawLogFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".zevtc") || name.endsWith(".evtc") || name.endsWith(".evtc.zip");
}

/**
 * Uploads a raw combat log file to dps.report for parsing. Throws with a
 * human-readable message on failure (network error, dps.report-reported
 * error, or a non-OK HTTP status).
 */
export async function uploadRawLogToDpsReport(
  file: File,
  signal?: AbortSignal,
): Promise<DpsReportUploadResult> {
  const form = new FormData();
  form.append("file", file, file.name);

  let res: Response;
  try {
    res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: form, signal });
  } catch (e) {
    throw new Error(
      e instanceof Error && e.name === "AbortError"
        ? "Upload cancelled."
        : `Could not reach dps.report (${e instanceof Error ? e.message : "network error"}).`,
    );
  }

  let data: DpsReportUploadResult;
  try {
    data = await res.json();
  } catch {
    throw new Error(`dps.report returned an unexpected response (${res.status}).`);
  }

  if (!res.ok || data.error) {
    throw new Error(data.error || `dps.report upload failed (${res.status}).`);
  }
  return data;
}

/** Fetches the full Elite Insights JSON for a permalink already known to dps.report. */
export async function fetchDpsReportJson(permalink: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(`${JSON_ENDPOINT}?permalink=${encodeURIComponent(permalink)}`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch parsed log from dps.report (${res.status}).`);
  }
  return res.json();
}

/**
 * Extracts a dps.report permalink id from anything a user might paste:
 * a bare id ("yAFl-20260720-192325_wvw"), a viewer URL
 * ("https://dps.report/yAFl-..." or ".../w.report/yAFl-..."), or a
 * getJson URL. Returns null if nothing recognizable is found.
 */
export function parseDpsReportPermalink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!/(^|\.)dps\.report$/i.test(url.hostname)) return null;

    const existing = url.searchParams.get("permalink");
    if (existing) return existing;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    return segments[segments.length - 1];
  } catch {
    // Not a URL — treat bare "xxxx-yyyy_wvw"-style strings as a permalink directly.
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
    return null;
  }
}
