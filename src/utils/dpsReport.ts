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

export type DpsReportUploadErrorCode =
  | "cancelled"
  | "network"
  | "rate-limited"
  | "service"
  | "invalid-response";

export class DpsReportUploadError extends Error {
  readonly code: DpsReportUploadErrorCode;
  readonly status?: number;

  constructor(message: string, code: DpsReportUploadErrorCode, status?: number) {
    super(message);
    this.name = "DpsReportUploadError";
    this.code = code;
    this.status = status;
  }
}

const UPLOAD_ENDPOINT =
  "https://dps.report/uploadContent?json=1&generator=ei&detailedwvw=true";
const JSON_ENDPOINT = "https://dps.report/getJson";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseErrorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!isRecord(value)) return null;
  for (const key of ["message", "error", "detail"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

/**
 * Validates and normalizes the successful JSON returned by dps.report.
 * A 200 response without a usable permalink is not a successful Entropy
 * import because the resulting report could never be shared again.
 */
export function parseDpsReportUploadResponse(value: unknown): DpsReportUploadResult {
  if (!isRecord(value)) {
    throw new DpsReportUploadError(
      "dps.report returned an invalid upload response (expected an object).",
      "invalid-response",
    );
  }

  if (value.error) {
    const reportedError = responseErrorMessage(value.error)
      ?? responseErrorMessage(value)
      ?? "dps.report rejected the upload.";
    throw new DpsReportUploadError(reportedError, "service");
  }

  const rawPermalink =
    typeof value.permalink === "string" ? value.permalink.trim() : "";
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const permalink = parseDpsReportPermalink(rawPermalink || rawId);

  if (!permalink) {
    throw new DpsReportUploadError(
      "dps.report did not return a usable share link for this log. The upload was not added; try the file again in a moment.",
      "invalid-response",
    );
  }

  return {
    ...(value as Omit<DpsReportUploadResult, "id" | "permalink">),
    id: rawId || permalink,
    permalink,
  };
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  }
  return 750 * 2 ** attempt;
}

function waitForRetry(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DpsReportUploadError("Upload cancelled.", "cancelled"));
      return;
    }
    const timer = globalThis.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timer);
        reject(new DpsReportUploadError("Upload cancelled.", "cancelled"));
      },
      { once: true },
    );
  });
}

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
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const form = new FormData();
    form.append("file", file, file.name);

    let res: Response;
    try {
      res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: form, signal });
    } catch (e) {
      throw new DpsReportUploadError(
        e instanceof Error && e.name === "AbortError"
          ? "Upload cancelled."
          : `Could not reach dps.report (${e instanceof Error ? e.message : "network error"}).`,
        e instanceof Error && e.name === "AbortError" ? "cancelled" : "network",
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    const retryable = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
    if (!res.ok) {
      if (retryable && attempt < maxAttempts - 1) {
        await waitForRetry(retryDelayMs(res, attempt), signal);
        continue;
      }
      const detail = responseErrorMessage(data);
      const message =
        res.status === 429
          ? "dps.report is rate-limiting uploads. Wait a moment and retry this log."
          : detail || `dps.report upload failed (${res.status}).`;
      throw new DpsReportUploadError(message, res.status === 429 ? "rate-limited" : "service", res.status);
    }

    return parseDpsReportUploadResponse(data);
  }

  throw new DpsReportUploadError("dps.report upload failed after retrying.", "service");
}

/** Fetches the full Elite Insights JSON for a permalink already known to dps.report. */
export async function fetchDpsReportJson(permalink: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(`${JSON_ENDPOINT}?permalink=${encodeURIComponent(permalink)}`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch parsed log from dps.report (${res.status}).`);
  }
  let value: unknown;
  try {
    value = await res.json();
  } catch {
    throw new Error("dps.report returned invalid parsed-log JSON.");
  }
  if (!isRecord(value)) {
    throw new Error("dps.report returned an invalid parsed log.");
  }
  return value;
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
