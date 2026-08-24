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

  it("rejects a nominally successful response with no reusable share id", () => {
    expect(() => parseDpsReportUploadResponse({ uploadTime: 123 })).toThrowError(
      /did not return a usable share link/i,
    );
  });

  it("surfaces service-provided errors", () => {
    expect(() => parseDpsReportUploadResponse({ error: "Parser unavailable" })).toThrowError(
      new DpsReportUploadError("Parser unavailable", "service"),
    );
  });

  it("surfaces boolean error responses with a service message", () => {
    expect(() => parseDpsReportUploadResponse({ error: true, message: "Upload rejected" })).toThrowError(
      /upload rejected/i,
    );
  });

  it("never accepts a truthy service error even when no detail is provided", () => {
    expect(() => parseDpsReportUploadResponse({ error: true, permalink: "abc_123" })).toThrowError(
      /rejected the upload/i,
    );
  });

  it("extracts permalink ids from common dps.report URL forms", () => {
    expect(parseDpsReportPermalink("https://dps.report/abc-123_wvw")).toBe("abc-123_wvw");
    expect(parseDpsReportPermalink("https://dps.report/getJson?permalink=abc-123_wvw")).toBe("abc-123_wvw");
  });
});
