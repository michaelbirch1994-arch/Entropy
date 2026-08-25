import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handleUploadMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/blob/client", () => ({ handleUpload: handleUploadMock }));

import handler from "./report-upload.js";
import { MAX_REPORT_ARTIFACT_BYTES } from "./report-upload-policy.js";

function responseRecorder() {
  const result = { statusCode: 200, headers: {}, body: undefined, ended: false };
  return {
    result,
    setHeader(name, value) {
      result.headers[name] = value;
    },
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
    end() {
      result.ended = true;
      return this;
    },
  };
}

function generateTokenRequest(ownerKey = "owner-secret", pathname = "reports/Reset-Night.entropy-report.json") {
  return {
    method: "POST",
    headers: {
      origin: "https://entropy-preview.vercel.app",
      "x-entropy-share-key": ownerKey,
    },
    body: {
      type: "blob.generate-client-token",
      payload: { pathname, clientPayload: null, multipart: false },
    },
  };
}

describe("report upload endpoint", () => {
  beforeEach(() => {
    process.env.ENTROPY_SHARE_UPLOAD_KEY = "owner-secret";
    handleUploadMock.mockReset();
  });

  afterEach(() => {
    delete process.env.ENTROPY_SHARE_UPLOAD_KEY;
  });

  it("answers allowed preflight requests without issuing an upload token", async () => {
    const response = responseRecorder();
    await handler({ method: "OPTIONS", headers: { origin: "http://tauri.localhost" } }, response);

    expect(response.result.statusCode).toBe(204);
    expect(response.result.ended).toBe(true);
    expect(response.result.headers["Access-Control-Allow-Origin"]).toBe("http://tauri.localhost");
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("rejects unknown origins and invalid owner keys before Blob authorization", async () => {
    const originResponse = responseRecorder();
    await handler({ ...generateTokenRequest(), headers: { origin: "https://example.com" } }, originResponse);
    expect(originResponse.result.statusCode).toBe(403);

    const keyResponse = responseRecorder();
    await handler(generateTokenRequest("wrong-key"), keyResponse);
    expect(keyResponse.result.statusCode).toBe(401);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("issues a short-lived, bounded token only for report artifact paths", async () => {
    handleUploadMock.mockImplementation(async ({ body, onBeforeGenerateToken }) => {
      const policy = await onBeforeGenerateToken(body.payload.pathname);
      expect(policy).toMatchObject({
        allowedContentTypes: ["application/json"],
        maximumSizeInBytes: MAX_REPORT_ARTIFACT_BYTES,
        addRandomSuffix: true,
        allowOverwrite: false,
      });
      expect(policy.validUntil).toBeGreaterThan(Date.now());
      return { type: "blob.generate-client-token", clientToken: "client-token" };
    });

    const response = responseRecorder();
    await handler(generateTokenRequest(), response);

    expect(response.result.statusCode).toBe(200);
    expect(response.result.body).toEqual({ type: "blob.generate-client-token", clientToken: "client-token" });
  });

  it("rejects path traversal before a Blob token can be returned", async () => {
    handleUploadMock.mockImplementation(async ({ body, onBeforeGenerateToken }) => {
      await onBeforeGenerateToken(body.payload.pathname);
    });

    const response = responseRecorder();
    await handler(generateTokenRequest("owner-secret", "../report.entropy-report.json"), response);

    expect(response.result.statusCode).toBe(400);
    expect(response.result.body.error).toBe("Invalid report artifact path.");
  });
});
