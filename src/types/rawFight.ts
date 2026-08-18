// Minimal shape for a single raw Elite Insights fight log — what dps.report's
// getJson (or a locally-run EI parse) returns for one .zevtc file. This is
// intentionally a small subset: Entropy's raw-log importer only needs enough
// to show a per-fight summary card, not the full combat breakdown that
// Entropy's aggregation pipeline consumes.

export interface RawFightPlayer {
  name: string;
  account: string;
  profession: string;
  notInSquad?: boolean;
  hasCommanderTag?: boolean;
}

export interface RawFightLog {
  fightName?: string;
  mapID?: number;
  duration?: string;
  durationMS?: number;
  success?: boolean;
  recordedBy?: string;
  timeStartStd?: string;
  players?: RawFightPlayer[];
  [k: string]: unknown;
}

export interface RawFightSummary {
  /** dps.report permalink id, when this fight came from (or was uploaded to) dps.report. */
  permalink?: string;
  fightName: string;
  duration: string;
  success: boolean;
  recordedBy: string;
  timeStart: string | null;
  squadSize: number;
  totalPlayers: number;
  commander: string | null;
}

export function summarizeRawFight(log: RawFightLog, permalink?: string): RawFightSummary {
  const players = log.players ?? [];
  const squad = players.filter((p) => !p.notInSquad);
  const commander = squad.find((p) => p.hasCommanderTag);

  return {
    permalink,
    fightName: log.fightName || "Unknown fight",
    duration: log.duration || "-",
    success: !!log.success,
    recordedBy: log.recordedBy || "Unknown",
    timeStart: log.timeStartStd || null,
    squadSize: squad.length,
    totalPlayers: players.length,
    commander: commander ? commander.name : null,
  };
}

// --- Per-player detail, for rendering a single fight inside Entropy's own
// viewer (RawFightViewer) instead of just linking out to dps.report. ---
//
// Elite Insights reports most per-player metrics as arrays indexed by
// "phase" (phase 0 is always the full fight). We only need phase 0 here
// since Entropy shows one fight at a time, not a phase-by-phase breakdown.

export interface RawFightPlayerDetail {
  account: string;
  name: string;
  profession: string;
  group: number;
  notInSquad: boolean;
  hasCommanderTag: boolean;
  dps: number;
  damage: number;
  condiDamage: number;
  powerDamage: number;
  damageTaken: number;
  downCount: number;
  deadCount: number;
  resurrects: number;
  cleanses: number;
  strips: number;
  distToCom: number;
}

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function firstPhase(v: unknown): Record<string, unknown> {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null
    ? (v[0] as Record<string, unknown>)
    : {};
}

/** Extracts a flat per-player stat row from raw Elite Insights player objects (phase 0 / full fight). */
export function extractFightPlayers(log: RawFightLog): RawFightPlayerDetail[] {
  const rawPlayers = (log.players ?? []) as unknown as Record<string, unknown>[];

  return rawPlayers.map((p) => {
    const dps = firstPhase(p.dpsAll);
    const def = firstPhase(p.defenses);
    const sup = firstPhase(p.support);
    const stats = firstPhase(p.statsAll);
    const account = typeof p.account === "string" ? p.account : "Unknown.0000";
    const name = typeof p.name === "string" && p.name ? p.name : account;

    return {
      account,
      name,
      profession: typeof p.profession === "string" ? p.profession : "Unknown",
      group: n(p.group),
      notInSquad: !!p.notInSquad,
      hasCommanderTag: !!p.hasCommanderTag,
      dps: n(dps.dps),
      damage: n(dps.damage),
      condiDamage: n(dps.condiDamage),
      powerDamage: n(dps.powerDamage),
      damageTaken: n(def.damageTaken),
      downCount: n(def.downCount),
      deadCount: n(def.deadCount),
      resurrects: n(sup.resurrects),
      cleanses: n(sup.condiCleanse),
      strips: n(sup.boonStrips),
      distToCom: n(stats.distToCom),
    };
  });
}
