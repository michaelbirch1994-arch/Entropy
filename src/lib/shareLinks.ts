import type { WvWReport } from "../types/report";

export const DEFAULT_SHARE_VIEWER_URL = "https://michaelbirch1994-arch.github.io/Entropy/";

export interface ReportLoadQuery {
  reportId: string | null;
  permalinks: string[];
  artifactUrl: string | null;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function isSafeDpsPermalink(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function isLoadableExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getConfiguredShareViewerUrl(currentHref?: string): string {
  const configured = import.meta.env.VITE_ENTROPY_SHARE_VIEWER_URL;
  if (typeof configured === "string" && configured.trim()) return configured.trim();

  if (currentHref) return currentHref;
  if (typeof window !== "undefined" && /^https?:$/i.test(window.location.protocol)) {
    return window.location.href;
  }

  return DEFAULT_SHARE_VIEWER_URL;
}

export function getReportPermalinks(report: WvWReport): string[] {
  const rows = report.stats?.fightBreakdown ?? [];
  return dedupe(
    rows
      .map((row) => (typeof row.permalink === "string" ? row.permalink.trim() : ""))
      .filter((permalink): permalink is string => isSafeDpsPermalink(permalink)),
  );
}

export function buildEntropyShareLink(report: WvWReport, currentHref?: string): string | null {
  const permalinks = getReportPermalinks(report);
  if (permalinks.length === 0) return null;

  const url = new URL(getConfiguredShareViewerUrl(currentHref));
  url.search = "";
  url.hash = "";
  url.searchParams.set("permalinks", permalinks.join(","));
  return url.toString();
}

export function buildEntropyArtifactShareLink(artifactUrl: string, currentHref?: string): string | null {
  const trimmed = artifactUrl.trim();
  if (!isLoadableExternalUrl(trimmed)) return null;

  const url = new URL(getConfiguredShareViewerUrl(currentHref));
  url.search = "";
  url.hash = "";
  url.searchParams.set("artifact", trimmed);
  return url.toString();
}

export function parseReportLoadQuery(search: string): ReportLoadQuery {
  const params = new URLSearchParams(search);
  const reportCandidate = params.get("report")?.trim() || "";
  const artifactCandidate =
    params.get("artifact")?.trim() ||
    params.get("reportUrl")?.trim() ||
    params.get("url")?.trim() ||
    "";
  const permalinks = dedupe(
    (params.get("permalinks") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id): id is string => isSafeDpsPermalink(id)),
  );

  return {
    reportId: reportCandidate && isSafeDpsPermalink(reportCandidate) ? reportCandidate : null,
    permalinks,
    artifactUrl: artifactCandidate && isLoadableExternalUrl(artifactCandidate) ? artifactCandidate : null,
  };
}
