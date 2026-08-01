// Minimal shape for a single raw Elite Insights fight log — what dps.report's
// getJson (or a locally-run EI parse) returns for one .zevtc file. This is
// intentionally a small subset: Entropy's raw-log importer only needs enough
// to show a per-fight summary card, not the full combat breakdown that
// AxiBridge's aggregation engine would consume.

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
