// IndexedDB-backed cache for the report the user is currently viewing.
// Single "active" slot: URL-loaded and uploaded reports both land here so a
// reload restores whatever was last on screen. Opaque JSON blobs, no server.

import type { WvWReport } from "../types/report";

const DB_NAME = "axibridge-reports";
const STORE = "reports";
const ACTIVE_KEY = "active";
const DB_VERSION = 1;

export type ReportSource = "url" | "upload";

export interface CachedReport {
  id: string;
  source: ReportSource;
  savedAt: number;
  report: WvWReport;
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function getActiveReport(): Promise<CachedReport | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(ACTIVE_KEY);
    req.onsuccess = () => resolve((req.result as CachedReport | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function putActiveReport(entry: CachedReport): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry, ACTIVE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function clearActiveReport(): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(ACTIVE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
