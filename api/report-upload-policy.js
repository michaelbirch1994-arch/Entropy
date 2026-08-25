import { createHash, timingSafeEqual } from "node:crypto";

export const MAX_REPORT_ARTIFACT_BYTES = 100 * 1024 * 1024;
export const REPORT_ARTIFACT_CONTENT_TYPE = "application/json";

const CANONICAL_VIEWER_ORIGIN = "https://entropy-um58.vercel.app";
const REPORT_PATHNAME = /^reports\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.entropy-report\.json$/;

function digestSecret(value) {
  return createHash("sha256").update(value).digest();
}

export function hasValidUploadKey(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || !provided || !expected) return false;
  return timingSafeEqual(digestSecret(provided), digestSecret(expected));
}

export function isAllowedReportPathname(pathname) {
  return typeof pathname === "string" && REPORT_PATHNAME.test(pathname);
}

export function getRequestHeader(request, name) {
  const value = request.headers?.[name.toLowerCase()] ?? request.headers?.[name];
  return Array.isArray(value) ? value[0] : typeof value === "string" ? value : "";
}

export function getAllowedCorsOrigin(origin) {
  if (!origin) return null;

  try {
    const url = new URL(origin);
    if (url.origin === CANONICAL_VIEWER_ORIGIN) return origin;
    if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) return origin;
    if ((url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return origin;
    }
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname === "tauri.localhost") return origin;
    if (url.protocol === "tauri:" && url.hostname === "localhost") return origin;
  } catch {
    return null;
  }

  return null;
}

export function parseUploadBody(body) {
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  if (typeof body === "string" || Buffer.isBuffer(body)) return JSON.parse(body.toString());
  throw new Error("Invalid upload request.");
}
