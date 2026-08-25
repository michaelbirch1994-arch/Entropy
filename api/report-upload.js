import { handleUpload } from "@vercel/blob/client";
import {
  getAllowedCorsOrigin,
  getRequestHeader,
  hasValidUploadKey,
  isAllowedReportPathname,
  MAX_REPORT_ARTIFACT_BYTES,
  parseUploadBody,
  REPORT_ARTIFACT_CONTENT_TYPE,
} from "./report-upload-policy.js";

const UPLOAD_KEY_HEADER = "x-entropy-share-key";

function setResponseHeaders(request, response) {
  const requestOrigin = getRequestHeader(request, "origin");
  const allowedOrigin = getAllowedCorsOrigin(requestOrigin);

  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", `Content-Type, ${UPLOAD_KEY_HEADER}`);
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (allowedOrigin) response.setHeader("Access-Control-Allow-Origin", allowedOrigin);

  return !requestOrigin || Boolean(allowedOrigin);
}

export default async function handler(request, response) {
  const originAllowed = setResponseHeaders(request, response);

  if (!originAllowed) {
    response.status(403).json({ error: "Origin not allowed." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const body = parseUploadBody(request.body);
    if (body?.type === "blob.generate-client-token") {
      const expectedKey = process.env.ENTROPY_SHARE_UPLOAD_KEY;
      if (!expectedKey) {
        response.status(503).json({ error: "Hosted sharing is not configured." });
        return;
      }

      const providedKey = getRequestHeader(request, UPLOAD_KEY_HEADER);
      if (!hasValidUploadKey(providedKey, expectedKey)) {
        response.status(401).json({ error: "Invalid owner upload key." });
        return;
      }
    }

    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAllowedReportPathname(pathname)) throw new Error("Invalid report artifact path.");

        return {
          allowedContentTypes: [REPORT_ARTIFACT_CONTENT_TYPE],
          maximumSizeInBytes: MAX_REPORT_ARTIFACT_BYTES,
          validUntil: Date.now() + 10 * 60 * 1000,
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 3600,
        };
      },
    });

    response.status(200).json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Report upload failed." });
  }
}
