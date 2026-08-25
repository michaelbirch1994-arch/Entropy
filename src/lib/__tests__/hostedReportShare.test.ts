import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WvWReport } from "../../types/report";

const uploadMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/blob/client", () => ({ upload: uploadMock }));

import {
  buildHostedReportPathname,
  DEFAULT_HOSTED_REPORT_UPLOAD_URL,
  getHostedReportUploadUrl,
  normalizeHostedReportUploadError,
  prepareHostedReportUpload,
  uploadHostedReport,
} from "../hostedReportShare";

const report = {
  meta: {
    title: "Reset Night / EBG",
    dateLabel: "Aug 25, 2026",
    appVersion: "entropy-raw-v5",
  },
  stats: {
    total: 1,
    wins: 1,
    losses: 0,
    leaderboards: {},
  },
} as WvWReport;

describe("hosted report sharing", () => {
  beforeEach(() => uploadMock.mockReset());

  it("uses the active hosted deployment but keeps desktop and local development on the canonical endpoint", () => {
    expect(getHostedReportUploadUrl("https://entropy-preview.vercel.app/report?fight=1")).toBe(
      "https://entropy-preview.vercel.app/api/report-upload",
    );
    expect(getHostedReportUploadUrl("http://localhost:5173/", "https://api.example.com/upload")).toBe(
      "https://api.example.com/upload",
    );
    expect(getHostedReportUploadUrl("tauri://localhost/")).toBe(DEFAULT_HOSTED_REPORT_UPLOAD_URL);
    expect(getHostedReportUploadUrl("http://tauri.localhost/")).toBe(DEFAULT_HOSTED_REPORT_UPLOAD_URL);
  });

  it("builds a bounded report-only pathname", () => {
    expect(buildHostedReportPathname("Reset Night / EBG")).toBe("reports/Reset-Night-EBG.entropy-report.json");
    expect(buildHostedReportPathname("A".repeat(500)).length).toBeLessThanOrEqual(148);
  });

  it("rejects artifacts above the configured preparation limit before upload", () => {
    expect(() => prepareHostedReportUpload(report, 10)).toThrow(/larger than the 100 MB/i);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads JSON with the owner header and returns a viewer link", async () => {
    uploadMock.mockResolvedValue({ url: "https://example.public.blob.vercel-storage.com/reports/report-a1b2.json" });

    const result = await uploadHostedReport(report, " owner-secret ", {
      currentHref: "https://entropy-preview.vercel.app/overview?fight=1",
      handleUploadUrl: "https://entropy-preview.vercel.app/api/report-upload",
    });

    expect(uploadMock).toHaveBeenCalledOnce();
    const [pathname, body, options] = uploadMock.mock.calls[0];
    expect(pathname).toBe("reports/Reset-Night-EBG.entropy-report.json");
    expect(body).toBeInstanceOf(Blob);
    expect(options).toMatchObject({
      access: "public",
      contentType: "application/json",
      handleUploadUrl: "https://entropy-preview.vercel.app/api/report-upload",
      headers: { "x-entropy-share-key": "owner-secret" },
    });
    expect(result.artifactUrl).toContain("blob.vercel-storage.com");
    expect(result.viewerUrl).toBe(
      "https://entropy-preview.vercel.app/overview?artifact=https%3A%2F%2Fexample.public.blob.vercel-storage.com%2Freports%2Freport-a1b2.json",
    );
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("returns the canonical web viewer link from the desktop webview", async () => {
    uploadMock.mockResolvedValue({ url: "https://example.public.blob.vercel-storage.com/reports/report-c3d4.json" });

    const result = await uploadHostedReport(report, "owner-secret", {
      currentHref: "http://tauri.localhost/",
      handleUploadUrl: DEFAULT_HOSTED_REPORT_UPLOAD_URL,
    });

    expect(result.viewerUrl).toBe(
      "https://entropy-um58.vercel.app/?artifact=https%3A%2F%2Fexample.public.blob.vercel-storage.com%2Freports%2Freport-c3d4.json",
    );
  });

  it("surfaces owner-key failures without exposing the key", () => {
    expect(normalizeHostedReportUploadError(new Error("Failed to retrieve the client token")).message).toBe(
      "Upload authorization failed. Check the owner key and try again.",
    );
    expect(normalizeHostedReportUploadError(new TypeError("Failed to fetch")).message).toBe(
      "Hosted sharing could not be reached. Check the connection or deployment and try again.",
    );
  });
});
