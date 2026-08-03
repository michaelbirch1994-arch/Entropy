// IndexedDB-backed archive of every report ever loaded on this device (not
// just the single "active" slot in utils/reportCache.ts). Powers cross-report
// search/browsing and compare mode - same pattern as playerProfileStore.ts:
// opaque local storage, no server, deduped by report id.

import type { WvWReport } from "../types/report";

const DB_NAME = "entropy-report-archive";
const STORE = "archive";
const DB_VERSION = 1;

export interface ArchiveEntry {
  id: string;
  title: string;
  commanders: string[];
  dateStart: string;
  dateEnd: string;
  dateLabel: string;
  savedAt: number;
  fights: number;
  wins: number;
  losses: number;
  totalDamage: number;
  avgSquadSize: number;
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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

// Safe to call every time a report loads - reports are deduped by id, and
// re-saving an already-archived report just refreshes its savedAt/data
// rather than creating a duplicate entry.
export async function saveToArchive(report: WvWReport): Promise<void> {
  const db = await openDB();
  if (!db) return;
  const id = report.meta?.id;
  if (!id) return;

  const totalDamage = (report.stats.offensePlayers ?? []).reduce((a, p) => a + (p.offenseTotals?.damage ?? 0), 0);

  const entry: ArchiveEntry = {
    id,
    title: report.meta.title,
    commanders: report.meta.commanders ?? [],
    dateStart: report.meta.dateStart,
    dateEnd: report.meta.dateEnd,
    dateLabel: report.meta.dateLabel,
    savedAt: Date.now(),
    fights: report.stats.fights ?? 0,
    wins: report.stats.wins ?? 0,
    losses: report.stats.losses ?? 0,
    totalDamage,
    avgSquadSize: report.stats.avgSquadSize ?? 0,
    report,
  };

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function getAllArchived(): Promise<ArchiveEntry[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(((req.result as ArchiveEntry[]) ?? []).sort((a, b) => b.savedAt - a.savedAt));
    req.onerror = () => resolve([]);
  });
}

export async function getArchivedById(id: string): Promise<ArchiveEntry | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as ArchiveEntry | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function deleteFromArchive(id: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
