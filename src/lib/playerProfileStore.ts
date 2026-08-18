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
  /** Most recent reports this player appeared in, newest last - capped at MAX_HISTORY entries. Used to derive win/MVP streaks and badges. Older profiles saved before this field existed may not have it. */
  history: PlayerProfileHistoryEntry[];
}

export interface PlayerProfileHistoryEntry {
  ts: number;
  /** true = report had more wins than losses, false = more losses, null = tied/no fight outcome data. */
  won: boolean | null;
  mvp: boolean;
}

const MAX_HISTORY = 40;

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
    history: [],
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
  const reportWon: boolean | null = s.wins > s.losses ? true : s.wins < s.losses ? false : null;
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
    if (!prof.history) prof.history = [];
    prof.history.push({ ts: now, won: reportWon, mvp: s.offensiveMvp?.account === account || s.defensiveMvp?.account === account });
    if (prof.history.length > MAX_HISTORY) prof.history = prof.history.slice(-MAX_HISTORY);
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

// Current win streak = consecutive most-recent reports (newest first) that
// this player was on the winning side of, stopping at the first loss/tie or
// missing outcome data. Longest is the best run anywhere in the retained
// history window (MAX_HISTORY reports).
export function currentWinStreak(profile: PlayerProfile): number {
  const h = profile.history ?? [];
  let n = 0;
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].won !== true) break;
    n++;
  }
  return n;
}

export function longestWinStreak(profile: PlayerProfile): number {
  const h = profile.history ?? [];
  let best = 0;
  let cur = 0;
  for (const entry of h) {
    if (entry.won === true) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

export function currentMvpStreak(profile: PlayerProfile): number {
  const h = profile.history ?? [];
  let n = 0;
  for (let i = h.length - 1; i >= 0; i--) {
    if (!h[i].mvp) break;
    n++;
  }
  return n;
}

export interface PlayerBadge {
  id: string;
  label: string;
  detail: string;
}

// Badges derived entirely from data already accumulated on the profile - no
// new tracking required. Intentionally conservative thresholds since these
// are meant to be earned across many raid nights, not one good fight.
export function computeBadges(profile: PlayerProfile): PlayerBadge[] {
  const badges: PlayerBadge[] = [];
  const mvpTotal = profile.offensiveMvpCount + profile.defensiveMvpCount;
  const winStreak = currentWinStreak(profile);
  const mvpStreak = currentMvpStreak(profile);
  const classesSeen = Object.keys(profile.classCounts).length;

  if (winStreak >= 3) badges.push({ id: "win-streak", label: `${winStreak}-Win Streak`, detail: "On a winning streak over their most recent reports." });
  if (mvpStreak >= 2) badges.push({ id: "mvp-streak", label: `${mvpStreak}-Report MVP Streak`, detail: "MVP in each of their last reports." });
  if (profile.reportsSeen >= 20) badges.push({ id: "veteran", label: "Veteran", detail: "Logged 20+ reports on this device." });
  else if (profile.reportsSeen >= 10) badges.push({ id: "regular", label: "Regular", detail: "Logged 10+ reports on this device." });
  if (mvpTotal >= 10) badges.push({ id: "mvp-machine", label: "MVP Machine", detail: "10+ career MVP awards." });
  else if (mvpTotal >= 5) badges.push({ id: "standout", label: "Standout", detail: "5+ career MVP awards." });
  if (profile.totalHealing > 5_000_000) badges.push({ id: "field-medic", label: "Field Medic", detail: "5M+ career healing." });
  if (profile.totalDownContrib > 2_000_000) badges.push({ id: "closer", label: "Closer", detail: "2M+ career down contribution." });
  if (classesSeen >= 5) badges.push({ id: "jack-of-all-trades", label: "Jack of All Trades", detail: `Played ${classesSeen} different classes.` });
  else if (classesSeen === 1 && profile.reportsSeen >= 5) badges.push({ id: "specialist", label: "Specialist", detail: "Only ever plays one class." });

  return badges;
}

