import type { ReplayFightEntry } from "../../types/report";
import { distanceBetween, interpolatePosition, isInInterval } from "../parseReplayData";

export interface EventReplayPlayerEvidence {
  account: string;
  name: string;
  profession: string;
  isCommander: boolean;
  isDown: boolean;
  isDead: boolean;
  x: number | null;
  y: number | null;
  distanceToCommander: number | null;
}

export interface EventReplaySnapshotEvidence {
  fightId: string;
  fightName: string;
  timestampMs: number;
  squadAlive: number;
  squadDown: number;
  enemiesAlive: number;
  enemiesDown: number;
  commanderAccount: string | null;
  averageSquadDistanceToCommander: number | null;
  linkedPlayers: EventReplayPlayerEvidence[];
}

export function buildEventReplaySnapshotEvidence({
  replayFights,
  fightId,
  timestampMs,
  relatedPlayerKeys = [],
}: {
  replayFights: ReplayFightEntry[];
  fightId: string;
  timestampMs: number;
  relatedPlayerKeys?: string[];
}): EventReplaySnapshotEvidence | null {
  const fight = replayFights.find((candidate) => candidate.fightId === fightId);
  if (!fight) return null;

  const t = Math.max(0, Math.min(timestampMs, fight.data.durationMs));
  const squad = fight.data.players.filter((player) => player.inSquad);
  const commander = squad.find((player) => player.isCommander && !isInInterval(player.deadIntervals, t)) ?? null;
  const commanderPoint = commander ? interpolatePosition(commander.points, t) : null;

  const aliveSquad = squad.filter((player) => !isInInterval(player.deadIntervals, t));
  const squadDown = aliveSquad.filter((player) => isInInterval(player.downIntervals, t)).length;
  const aliveEnemies = fight.data.enemies.filter((enemy) => !isInInterval(enemy.deadIntervals, t));
  const enemiesDown = aliveEnemies.filter((enemy) => isInInterval(enemy.downIntervals, t)).length;

  const distances = commanderPoint
    ? aliveSquad
        .filter((player) => !player.isCommander)
        .map((player) => distanceBetween(interpolatePosition(player.points, t), commanderPoint))
        .filter((value): value is number => value != null && Number.isFinite(value))
    : [];

  const linkedKeySet = new Set(relatedPlayerKeys);
  const linkedPlayers = fight.data.players
    .filter((player) => linkedKeySet.has(player.account) || linkedKeySet.has(player.name))
    .map((player): EventReplayPlayerEvidence => {
      const point = interpolatePosition(player.points, t);
      return {
        account: player.account,
        name: player.name,
        profession: player.profession,
        isCommander: player.isCommander,
        isDown: isInInterval(player.downIntervals, t),
        isDead: isInInterval(player.deadIntervals, t),
        x: point?.x ?? null,
        y: point?.y ?? null,
        distanceToCommander:
          commanderPoint && point && !player.isCommander ? distanceBetween(point, commanderPoint) : player.isCommander ? 0 : null,
      };
    })
    .sort((a, b) => a.account.localeCompare(b.account));

  return {
    fightId: fight.fightId,
    fightName: fight.fightName,
    timestampMs: t,
    squadAlive: aliveSquad.length,
    squadDown,
    enemiesAlive: aliveEnemies.length,
    enemiesDown,
    commanderAccount: commander?.account ?? null,
    averageSquadDistanceToCommander:
      distances.length > 0 ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null,
    linkedPlayers,
  };
}
