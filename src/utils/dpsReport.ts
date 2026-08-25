// Client-side integration with dps.report's public API.
//
// dps.report exposes two relevant endpoints, both CORS-enabled so they can
// be called directly from a browser with no backend server involved:
//   - POST /uploadContent  — accepts a raw .evtc/.zevtc file, runs it through
//     Elite Insights server-side, and returns a permalink.
//   - GET  /getJson?permalink=... — returns the full Elite Insights JSON for
//     an already-uploaded (or externally shared) log.
//
// dps.report documents multiple service domains because their front-door
// networks can behave differently by region. Entropy prefers dps.report and
// falls back to the documented HTTPS alternate b.dps.report when the primary
// service cannot provide a usable response.

import {
  DPS_REPORT_FETCH_TIMEOUT_MS,
  DPS_REPORT_UPLOAD_TIMEOUT_MS,
} from "../lib/bridge-metrics/constants";

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
  | "timeout"
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

const SERVICE_BASES = ["https://dps.report", "https://b.dps.report"] as const;

function createTimedSignal(externalSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();

  if (externalSignal?.aborted) abortFromCaller();
  else externalSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, timeoutMs));

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      globalThis.clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

function uploadEndpoint(base: string): string {
  return `${base}/uploadContent?json=1&generator=ei&detailedwvw=true`;
}

function jsonEndpoint(base: string): string {
  return `${base}/getJson`;
}

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
 * Validates and normalizes the JSON returned by dps.report.
 *
 * dps.report explicitly documents that `error` may contain a message even
 * when a report was still generated. A reusable permalink therefore takes
 * precedence over that warning. Entropy still rejects every response that
 * lacks both a usable permalink and a usable report id.
 */
export function parseDpsReportUploadResponse(value: unknown): DpsReportUploadResult {
  if (!isRecord(value)) {
    throw new DpsReportUploadError(
      "dps.report returned an invalid upload response (expected an object).",
      "invalid-response",
    );
  }

  const rawPermalink =
    typeof value.permalink === "string" ? value.permalink.trim() : "";
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const permalink = parseDpsReportPermalink(rawPermalink || rawId);

  if (permalink) {
    return {
      ...(value as Omit<DpsReportUploadResult, "id" | "permalink">),
      id: rawId || permalink,
      permalink,
    };
  }

  if (value.error) {
    const reportedError = responseErrorMessage(value.error)
      ?? responseErrorMessage(value)
      ?? "dps.report rejected the upload.";
    throw new DpsReportUploadError(reportedError, "service");
  }

  throw new DpsReportUploadError(
    "dps.report did not return a usable share link for this log. The upload was not added; try the file again in a moment.",
    "invalid-response",
  );
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

async function uploadRawLogToService(
  base: string,
  file: File,
  signal?: AbortSignal,
): Promise<DpsReportUploadResult> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const form = new FormData();
    form.append("file", file, file.name);

    let res: Response;
    try {
      res = await fetch(uploadEndpoint(base), { method: "POST", body: form, signal });
    } catch (e) {
      throw new DpsReportUploadError(
        e instanceof Error && e.name === "AbortError"
          ? "Upload cancelled."
          : `Could not reach ${new URL(base).hostname} (${e instanceof Error ? e.message : "network error"}).`,
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

/**
 * Uploads a raw combat log file to dps.report for parsing. Entropy tries the
 * primary HTTPS service first and then the API-documented HTTPS alternate if
 * the primary network/service returns no usable report. Rate limits and user
 * cancellation are not bypassed through the alternate domain.
 */
export async function uploadRawLogToDpsReport(
  file: File,
  signal?: AbortSignal,
  timeoutMs = DPS_REPORT_UPLOAD_TIMEOUT_MS,
): Promise<DpsReportUploadResult> {
  const timed = createTimedSignal(signal, timeoutMs);
  try {
    let lastError: DpsReportUploadError | null = null;

    for (const base of SERVICE_BASES) {
      try {
        return await uploadRawLogToService(base, file, timed.signal);
      } catch (error) {
        if (!(error instanceof DpsReportUploadError)) throw error;
        if (error.code === "cancelled" || error.code === "rate-limited") throw error;
        lastError = error;
      }
    }

    throw lastError ?? new DpsReportUploadError("dps.report upload failed.", "service");
  } catch (error) {
    if (timed.didTimeOut()) {
      throw new DpsReportUploadError(
        "dps.report did not finish this upload in time. The remaining batch continued; retry this log when the service is responsive.",
        "timeout",
      );
    }
    throw error;
  } finally {
    timed.cleanup();
  }
}

/** Fetches the full Elite Insights JSON for a permalink already known to dps.report. */
export async function fetchDpsReportJson(
  permalink: string,
  signal?: AbortSignal,
  timeoutMs = DPS_REPORT_FETCH_TIMEOUT_MS,
): Promise<any> {
  const timed = createTimedSignal(signal, timeoutMs);
  try {
    let lastMessage = "Failed to fetch parsed log from dps.report.";

    for (const base of SERVICE_BASES) {
      let res: Response;
      try {
        res = await fetch(`${jsonEndpoint(base)}?permalink=${encodeURIComponent(permalink)}`, { signal: timed.signal });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        lastMessage = `Could not reach ${new URL(base).hostname}.`;
        continue;
      }

      if (!res.ok) {
        lastMessage = `Failed to fetch parsed log from ${new URL(base).hostname} (${res.status}).`;
        continue;
      }

      let value: unknown;
      try {
        value = await res.json();
      } catch {
        lastMessage = `${new URL(base).hostname} returned invalid parsed-log JSON.`;
        continue;
      }
      if (!isRecord(value)) {
        lastMessage = `${new URL(base).hostname} returned an invalid parsed log.`;
        continue;
      }
      return value;
    }

    throw new Error(lastMessage);
  } catch (error) {
    if (timed.didTimeOut()) {
      throw new DpsReportUploadError(
        "The parsed dps.report log took too long to return. The remaining batch continued; retry this log in a moment.",
        "timeout",
      );
    }
    if (signal?.aborted) {
      throw new DpsReportUploadError("Import cancelled.", "cancelled");
    }
    throw error;
  } finally {
    timed.cleanup();
  }
}

/**
 * Extracts a dps.report permalink id from anything a user might paste:
 * a bare id ("yAFl-20260720-192325_wvw"), a viewer URL on any dps.report
 * service domain, a generated wvw.report URL, or a getJson URL. Returns null
 * if nothing recognizable is found.
 */
export function parseDpsReportPermalink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    if (!/(^|\.)dps\.report$/i.test(hostname) && hostname !== "wvw.report") return null;

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
