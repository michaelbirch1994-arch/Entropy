// Persistent, cross-report player career stats. IndexedDB-backed (same
// pattern as utils/reportCache.ts): every time a NEW report is loaded
// (upload, URL, or raw-log build), each player's totals are folded into
// their running career record here. This is what turns Entropy from a
// per-report viewer into something with actual continuity across raid
// nights - a career page, not just a screenshot of one fight.

import type { WvWReport } from "../types/report";

const DB_NAME = "entropy-player-profiles";
const STORE = "profiles";
const META_STORE = "meta";
const PROCESSED_IDS_KEY = "processedReportIds";
const DB_VERSION = 1;
const MAX_PROCESSED_IDS = 500;

export interface PlayerProfile {
  account: string;
  firstSeen: number;
  lastSeen: number;
  reportsSeen: number;
  totalFightsJoined: number;
  totalDamage: number;
  totalDownContrib: number;
  totalHealing: number;
  totalBarrier: number;
  totalCleanses: number;
  totalStrips: number;
  bestDps: number;
  offensiveMvpCount: number;
  defensiveMvpCount: number;
  classCounts: Record<string, number>;
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
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function getAllProfiles(): Promise<PlayerProfile[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as PlayerProfile[]) ?? []);
    req.onerror = () => resolve([]);
  });
}

async function getProcessedIds(db: IDBDatabase): Promise<Set<string>> {
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).get(PROCESSED_IDS_KEY);
    req.onsuccess = () => resolve(new Set((req.result as string[]) ?? []));
    req.onerror = () => resolve(new Set());
  });
}

async function saveProcessedIds(db: IDBDatabase, ids: Set<string>): Promise<void> {
  const arr = Array.from(ids);
  const trimmed = arr.length > MAX_PROCESSED_IDS ? arr.slice(arr.length - MAX_PROCESSED_IDS) : arr;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).put(trimmed, PROCESSED_IDS_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function blankProfile(account: string, now: number): PlayerProfile {
  return {
    account,
    firstSeen: now,
    lastSeen: now,
    reportsSeen: 0,
    totalFightsJoined: 0,
    totalDamage: 0,
    totalDownContrib: 0,
    totalHealing: 0,
    totalBarrier: 0,
    totalCleanses: 0,
    totalStrips: 0,
    bestDps: 0,
    offensiveMvpCount: 0,
    defensiveMvpCount: 0,
    classCounts: {},
  };
}

// Folds one report's per-player stats into their running career record.
// Safe to call every time a report is loaded - reports are deduped by
// meta.id so re-viewing/re-uploading the same report doesn't double-count.
export async function recordReportIntoProfiles(report: WvWReport): Promise<void> {
  const db = await openDB();
  if (!db) return;

  const reportId = report.meta?.id ?? null;
  if (reportId) {
    const processed = await getProcessedIds(db);
    if (processed.has(reportId)) return;
    processed.add(reportId);
    await saveProcessedIds(db, processed);
  }

  const s = report.stats;
  const now = Date.now();

  const byAccount = new Map<string, {
    profession: string;
    damage: number;
    dps: number;
    downContrib: number;
    healing: number;
    barrier: number;
    cleanses: number;
    strips: number;
    logsJoined: number;
  }>();

  function ensure(account: string, profession: string) {
    let e = byAccount.get(account);
    if (!e) {
      e = { profession, damage: 0, dps: 0, downContrib: 0, healing: 0, barrier: 0, cleanses: 0, strips: 0, logsJoined: 0 };
      byAccount.set(account, e);
    }
    return e;
  }

  for (const p of s.offensePlayers ?? []) {
    if (!p.account || p.account === "Unknown") continue;
    const e = ensure(p.account, p.profession);
    e.damage += p.offenseTotals?.damage ?? 0;
    e.downContrib += p.offenseTotals?.downContribution ?? 0;
    const secs = (p.totalFightMs ?? 0) / 1000;
    e.dps = Math.max(e.dps, secs > 0 ? (p.offenseTotals?.damage ?? 0) / secs : 0);
  }
  for (const p of s.healingPlayers ?? []) {
    if (!p.account || p.account === "Unknown") continue;
    const e = ensure(p.account, p.profession);
    e.healing += p.healingTotals?.healing ?? 0;
    e.barrier += p.healingTotals?.barrier ?? 0;
  }
  for (const p of s.supportPlayers ?? []) {
    if (!p.account || p.account === "Unknown") continue;
    const e = ensure(p.account, p.profession);
    e.cleanses += p.supportTotals?.condiCleanse ?? 0;
    e.strips += p.supportTotals?.boonStrips ?? 0;
  }
  for (const p of s.generalPlayers ?? []) {
    if (!p.account || p.account === "Unknown") continue;
    const e = ensure(p.account, p.profession);
    e.logsJoined = Math.max(e.logsJoined, p.logsJoined ?? 0);
  }

  if (byAccount.size === 0) return;

  const existing = await new Promise<Map<string, PlayerProfile>>((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const map = new Map<string, PlayerProfile>();
      ((req.result as PlayerProfile[]) ?? []).forEach((p) => map.set(p.account, p));
      resolve(map);
    };
    req.onerror = () => resolve(new Map());
  });

  const updates: PlayerProfile[] = [];
  byAccount.forEach((e, account) => {
    const prof = existing.get(account) ?? blankProfile(account, now);
    prof.lastSeen = now;
    prof.reportsSeen += 1;
    prof.totalFightsJoined += e.logsJoined || 1;
    prof.totalDamage += e.damage;
    prof.totalDownContrib += e.downContrib;
    prof.totalHealing += e.healing;
    prof.totalBarrier += e.barrier;
    prof.totalCleanses += e.cleanses;
    prof.totalStrips += e.strips;
    prof.bestDps = Math.max(prof.bestDps, e.dps);
    if (e.profession) prof.classCounts[e.profession] = (prof.classCounts[e.profession] ?? 0) + 1;
    if (s.offensiveMvp?.account === account) prof.offensiveMvpCount += 1;
    if (s.defensiveMvp?.account === account) prof.defensiveMvpCount += 1;
    updates.push(prof);
  });

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    updates.forEach((p) => store.put(p, p.account));
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export function topClass(profile: PlayerProfile): string | null {
  const entries = Object.entries(profile.classCounts);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
