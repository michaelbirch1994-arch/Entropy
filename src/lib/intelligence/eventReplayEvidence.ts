import type { ReplayFightEntry } from "../../types/report";
import { distanceBetween, interpolatePosition, isInInterval } from "../parseReplayData";

export interface EventReplayRecentCastEvidence {
  timestampMs: number;
  offsetMs: number;
  skillId: number;
  skillName: string;
}

export interface EventReplayNearbySquadEvidence {
  account: string;
  name: string;
  profession: string;
  distance: number;
  isDown: boolean;
}

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
  nearbySquadWithin240: number | null;
  nearbySquadWithin600: number | null;
  trackedEnemiesWithin600: number | null;
  nearestSquadmates: EventReplayNearbySquadEvidence[];
  recentCasts: EventReplayRecentCastEvidence[];
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

const RECENT_CAST_WINDOW_MS = 2_500;

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
      const isDead = isInInterval(player.deadIntervals, t);

      const nearbySquad = point && !isDead
        ? aliveSquad
            .filter((candidate) => candidate.account !== player.account)
            .map((candidate) => {
              const candidatePoint = interpolatePosition(candidate.points, t);
              const distance = distanceBetween(point, candidatePoint);
              if (distance == null || !Number.isFinite(distance)) return null;
              return {
                account: candidate.account,
                name: candidate.name,
                profession: candidate.profession,
                distance,
                isDown: isInInterval(candidate.downIntervals, t),
              } satisfies EventReplayNearbySquadEvidence;
            })
            .filter((candidate): candidate is EventReplayNearbySquadEvidence => candidate != null)
            .sort((a, b) => a.distance - b.distance)
        : [];

      const trackedEnemyDistances = point && !isDead
        ? aliveEnemies
            .map((enemy) => distanceBetween(point, interpolatePosition(enemy.points, t)))
            .filter((distance): distance is number => distance != null && Number.isFinite(distance))
        : [];

      const recentCasts = (player.casts ?? [])
        .filter((cast) => Math.abs(cast.t - t) <= RECENT_CAST_WINDOW_MS)
        .map((cast): EventReplayRecentCastEvidence => ({
          timestampMs: cast.t,
          offsetMs: cast.t - t,
          skillId: cast.skillId,
          skillName: fight.data.skillMeta[cast.skillId]?.name ?? `Skill ${cast.skillId}`,
        }))
        .sort((a, b) => a.timestampMs - b.timestampMs);

      return {
        account: player.account,
        name: player.name,
        profession: player.profession,
        isCommander: player.isCommander,
        isDown: isInInterval(player.downIntervals, t),
        isDead,
        x: point?.x ?? null,
        y: point?.y ?? null,
        distanceToCommander:
          commanderPoint && point && !player.isCommander ? distanceBetween(point, commanderPoint) : player.isCommander ? 0 : null,
        nearbySquadWithin240: point && !isDead ? nearbySquad.filter((candidate) => candidate.distance <= 240).length : null,
        nearbySquadWithin600: point && !isDead ? nearbySquad.filter((candidate) => candidate.distance <= 600).length : null,
        trackedEnemiesWithin600: point && !isDead ? trackedEnemyDistances.filter((distance) => distance <= 600).length : null,
        nearestSquadmates: nearbySquad.slice(0, 3),
        recentCasts,
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
