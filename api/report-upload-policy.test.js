import { describe, expect, it } from "vitest";
import {
  getAllowedCorsOrigin,
  getRequestHeader,
  hasValidUploadKey,
  isAllowedReportPathname,
  parseUploadBody,
} from "./report-upload-policy.js";

describe("report upload policy", () => {
  it("compares the owner key without accepting missing or partial values", () => {
    expect(hasValidUploadKey("correct-owner-key", "correct-owner-key")).toBe(true);
    expect(hasValidUploadKey("correct-owner", "correct-owner-key")).toBe(false);
    expect(hasValidUploadKey("", "correct-owner-key")).toBe(false);
  });

  it("limits generated tokens to the report artifact namespace", () => {
    expect(isAllowedReportPathname("reports/Reset-Night.entropy-report.json")).toBe(true);
    expect(isAllowedReportPathname("../Reset-Night.entropy-report.json")).toBe(false);
    expect(isAllowedReportPathname("reports/Reset-Night.json")).toBe(false);
    expect(isAllowedReportPathname(`reports/${"a".repeat(201)}.entropy-report.json`)).toBe(false);
  });

  it("allows Entropy hosting, previews, local development, and the desktop webview origin", () => {
    expect(getAllowedCorsOrigin("https://entropy-um58.vercel.app")).toBe("https://entropy-um58.vercel.app");
    expect(getAllowedCorsOrigin("https://entropy-preview.vercel.app")).toBe("https://entropy-preview.vercel.app");
    expect(getAllowedCorsOrigin("http://localhost:5173")).toBe("http://localhost:5173");
    expect(getAllowedCorsOrigin("tauri://localhost")).toBe("tauri://localhost");
    expect(getAllowedCorsOrigin("https://example.com")).toBeNull();
  });

  it("normalizes request headers and parsed request bodies", () => {
    expect(getRequestHeader({ headers: { "x-entropy-share-key": ["first", "second"] } }, "x-entropy-share-key")).toBe("first");
    expect(parseUploadBody('{"type":"blob.generate-client-token"}')).toEqual({ type: "blob.generate-client-token" });
    expect(parseUploadBody(Buffer.from('{"type":"blob.upload-completed"}'))).toEqual({ type: "blob.upload-completed" });
  });
});
