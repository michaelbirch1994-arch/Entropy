import { describe, expect, it } from "vitest";
import {
  DpsReportUploadError,
  parseDpsReportPermalink,
  parseDpsReportUploadResponse,
} from "../../utils/dpsReport";

describe("dps.report upload responses", () => {
  it("normalizes a full permalink URL and preserves response metadata", () => {
    expect(
      parseDpsReportUploadResponse({
        id: "abc-20260824_wvw",
        permalink: "https://dps.report/abc-20260824_wvw",
        uploadTime: 123,
      }),
    ).toMatchObject({
      id: "abc-20260824_wvw",
      permalink: "abc-20260824_wvw",
      uploadTime: 123,
    });
  });

  it("accepts an id when the service omits its permalink field", () => {
    expect(parseDpsReportUploadResponse({ id: "abc_123" })).toMatchObject({
      id: "abc_123",
      permalink: "abc_123",
    });
  });

  it("accepts a generated report when dps.report also returns a warning", () => {
    expect(
      parseDpsReportUploadResponse({
        id: "abc_123",
        permalink: "https://b.dps.report/abc_123",
        error: "Parser emitted a non-fatal warning",
      }),
    ).toMatchObject({
      id: "abc_123",
      permalink: "abc_123",
      error: "Parser emitted a non-fatal warning",
    });
  });

  it("accepts the wvw.report permalink host currently returned for WvW uploads", () => {
    expect(
      parseDpsReportUploadResponse({
        id: "abc-20260812",
        permalink: "https://wvw.report/abc-20260812_wvw",
        uploadTime: 123,
        encounter: { success: true },
        report: { detailed: true },
        error: null,
        userToken: "redacted",
      }),
    ).toMatchObject({
      id: "abc-20260812",
      permalink: "abc-20260812_wvw",
      uploadTime: 123,
    });
  });

  it("rejects a nominally successful response with no reusable share id", () => {
    expect(() => parseDpsReportUploadResponse({ uploadTime: 123 })).toThrowError(
      /did not return a usable share link/i,
    );
  });

  it("surfaces service-provided errors when no report was generated", () => {
    expect(() => parseDpsReportUploadResponse({ error: "Parser unavailable" })).toThrowError(
      new DpsReportUploadError("Parser unavailable", "service"),
    );
  });

  it("surfaces boolean error responses with a service message when no report was generated", () => {
    expect(() => parseDpsReportUploadResponse({ error: true, message: "Upload rejected" })).toThrowError(
      /upload rejected/i,
    );
  });

  it("extracts permalink ids from common dps.report service URL forms", () => {
    expect(parseDpsReportPermalink("https://dps.report/abc-123_wvw")).toBe("abc-123_wvw");
    expect(parseDpsReportPermalink("https://b.dps.report/abc-123_wvw")).toBe("abc-123_wvw");
    expect(parseDpsReportPermalink("https://wvw.report/abc-123_wvw")).toBe("abc-123_wvw");
    expect(parseDpsReportPermalink("https://dps.report/getJson?permalink=abc-123_wvw")).toBe("abc-123_wvw");
    expect(parseDpsReportPermalink("https://wvw.report.example/abc-123_wvw")).toBeNull();
  });
});
