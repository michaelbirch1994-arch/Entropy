import { isTauri } from "@tauri-apps/api/core";
import type { WvWReport } from "../types/report";

// Entropy's canonical hosted deployment. Only used when we're not in a
// real browser tab (SSR/tests) - live share links always prefer the
// actual page the user is on (see getConfiguredShareViewerUrl), so this
// never overrides the real Vercel URL for someone using the hosted app.
export const DEFAULT_SHARE_VIEWER_URL = "https://entropy-um58.vercel.app/";

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
  if (currentHref) return currentHref;

  // The desktop app's WebView serves the frontend from a local pseudo-origin
  // (https://tauri.localhost on Windows, tauri://localhost elsewhere) that
  // passes a plain http(s)-protocol check, so isTauri() is checked explicitly
  // here - otherwise share links would point at an address only reachable on
  // this machine instead of falling through to the real hosted Vercel URL.
  if (
    typeof window !== "undefined" &&
    /^https?:$/i.test(window.location.protocol) &&
    !isTauri()
  ) {
    return window.location.href;
  }

  const configured = import.meta.env.VITE_ENTROPY_SHARE_VIEWER_URL;
  if (typeof configured === "string" && configured.trim()) return configured.trim();

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
