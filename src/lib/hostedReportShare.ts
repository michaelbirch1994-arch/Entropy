import { upload } from "@vercel/blob/client";
import type { WvWReport } from "../types/report";
import { buildEntropyArtifactShareLink } from "./shareLinks";
import { buildReportArtifact, reportArtifactFilename } from "./shareReportArtifact";

export const DEFAULT_HOSTED_REPORT_UPLOAD_URL = "https://entropy-um58.vercel.app/api/report-upload";
export const MAX_HOSTED_REPORT_BYTES = 100 * 1024 * 1024;

const OWNER_KEY_STORAGE = "entropy.hosted-report-owner-key.v1";
const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;

export interface HostedReportUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface HostedReportUploadResult {
  artifactUrl: string;
  viewerUrl: string;
  sizeBytes: number;
}

export interface PreparedHostedReportUpload {
  blob: Blob;
  pathname: string;
  sizeBytes: number;
}

interface HostedReportUploadOptions {
  currentHref?: string;
  handleUploadUrl?: string;
  onUploadProgress?: (progress: HostedReportUploadProgress) => void;
}

function browserHref(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.href;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHostedViewerHref(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const { hostname } = new URL(value);
  return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "tauri.localhost";
}

export function getHostedReportUploadUrl(currentHref?: string, configuredUrl?: string): string {
  const configured = configuredUrl ?? import.meta.env.VITE_ENTROPY_SHARE_API_URL;
  if (typeof configured === "string" && configured.trim() && isHttpUrl(configured.trim())) return configured.trim();

  const href = currentHref ?? browserHref();
  if (href && isHostedViewerHref(href)) {
    const url = new URL(href);
    return new URL("/api/report-upload", url.origin).toString();
  }

  return DEFAULT_HOSTED_REPORT_UPLOAD_URL;
}

export function buildHostedReportPathname(title: string): string {
  const filename = reportArtifactFilename(title);
  const extension = ".entropy-report.json";
  const base = filename.slice(0, -extension.length).slice(0, 120).replace(/-+$/g, "") || "entropy-report";
  return `reports/${base}${extension}`;
}

export function prepareHostedReportUpload(report: WvWReport, maximumSize = MAX_HOSTED_REPORT_BYTES): PreparedHostedReportUpload {
  const artifactJson = JSON.stringify(buildReportArtifact(report));
  const blob = new Blob([artifactJson], { type: "application/json" });
  if (blob.size > maximumSize) {
    throw new Error("This report is larger than the 100 MB hosted-sharing limit. Export it locally instead.");
  }
  return { blob, pathname: buildHostedReportPathname(report.meta.title), sizeBytes: blob.size };
}

export function loadHostedReportOwnerKey(): string {
  try {
    return window.localStorage.getItem(OWNER_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function saveHostedReportOwnerKey(value: string): void {
  try {
    window.localStorage.setItem(OWNER_KEY_STORAGE, value.trim());
  } catch {
    // Sharing still works when local storage is unavailable.
  }
}

export function clearHostedReportOwnerKey(): void {
  try {
    window.localStorage.removeItem(OWNER_KEY_STORAGE);
  } catch {
    // Nothing else to clear.
  }
}

export function normalizeHostedReportUploadError(error: unknown): Error {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Hosted report upload failed.";
  if (message.toLowerCase().includes("client token")) {
    return new Error("Upload authorization failed. Check the owner key and try again.");
  }
  if (/failed to fetch|network error/i.test(message)) {
    return new Error("Hosted sharing could not be reached. Check the connection or deployment and try again.");
  }
  return new Error(message);
}

export async function uploadHostedReport(
  report: WvWReport,
  ownerKey: string,
  options: HostedReportUploadOptions = {},
): Promise<HostedReportUploadResult> {
  const trimmedKey = ownerKey.trim();
  if (!trimmedKey) throw new Error("Enter the owner upload key.");

  const prepared = prepareHostedReportUpload(report);

  try {
    const result = await upload(prepared.pathname, prepared.blob, {
      access: "public",
      contentType: "application/json",
      handleUploadUrl: options.handleUploadUrl ?? getHostedReportUploadUrl(options.currentHref),
      headers: { "x-entropy-share-key": trimmedKey },
      multipart: prepared.sizeBytes >= MULTIPART_THRESHOLD_BYTES,
      onUploadProgress: options.onUploadProgress,
    });
    const viewerHref = options.currentHref && isHostedViewerHref(options.currentHref) ? options.currentHref : undefined;
    const viewerUrl = buildEntropyArtifactShareLink(result.url, viewerHref);
    if (!viewerUrl) throw new Error("The report uploaded, but Entropy could not create its viewer link.");

    return { artifactUrl: result.url, viewerUrl, sizeBytes: prepared.sizeBytes };
  } catch (error) {
    throw normalizeHostedReportUploadError(error);
  }
}
