/**
 * Shared constants used across the main process, renderer, and shared modules.
 */

/**
 * Numeric threshold for distinguishing millisecond timestamps from second timestamps.
 * Values >= this are Unix timestamps in milliseconds; values < this are in seconds.
 */
export const TIMESTAMP_MS_THRESHOLD = 1e12;

/**
 * Guild Wars 2 boon ID for Stability.
 */
export const STABILITY_BOON_ID = 1122;

/**
 * Guild Wars 2 boon ID for Aegis.
 */
export const AEGIS_BOON_ID = 743;

/**
 * Maximum number of logs processed concurrently during bulk upload.
 */
export const BULK_PROCESS_CONCURRENCY = 3;

/** Maximum wall time for one raw-log upload, including safe retries/fallback. */
export const DPS_REPORT_UPLOAD_TIMEOUT_MS = 3 * 60 * 1000;

/** Maximum wall time for retrieving one parsed Elite Insights payload. */
export const DPS_REPORT_FETCH_TIMEOUT_MS = 90 * 1000;
