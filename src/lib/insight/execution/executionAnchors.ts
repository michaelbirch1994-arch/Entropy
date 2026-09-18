import type { WvWReport } from '../../../types/report';
import type { ExecutionActivityScope, ExecutionActivitySummary } from '../executionActivity';

export interface ExecutionAnchor {
  id: string;
  kind: 'manual' | 'damage-activity' | 'damage-pressure';
  label: string;
  timeMs: number;
  endMs?: number;
  timeBoundsMs?: [number, number];
  evidenceStatus: 'observed' | 'calculated' | 'unknown';
  method: string;
  scope?: ExecutionActivityScope;
  resolutionMs?: number;
  damage?: number;
  baseline?: number;
  excess?: number;
  ratio?: number | null;
  castContext?: ExecutionPressureCastContext;
  coverage?: ExecutionActivitySummary['coverage'];
  limitations: string[];
}

export interface ExecutionPressureCastContext {
  intervalMs: [number, number];
  recordedPlayers: number;
  playersStartingCasts: number;
  castStarts: number;
  damagingCastStarts: number | null;
  damagingPlayers: number | null;
  skills: { skillId: number; name: string; icon?: string; casts: number; players: number; damaging: boolean | null }[];
  limitations: string[];
}

const clock = (timeMs: number) => `${Math.floor(timeMs / 60000)}:${String(Math.floor(timeMs / 1000) % 60).padStart(2, '0')}`;

function activityAnchors(summary: ExecutionActivitySummary | undefined, prefix: string, fightId: string): ExecutionAnchor[] {
  if (!summary) return [];
  return summary.candidates.map((candidate, index) => ({
    id: `${fightId}:${summary.scope}:${candidate.startMs}:${candidate.endMs}`,
    kind: 'damage-activity',
    label: `${prefix} ${index + 1} · ${clock(candidate.startMs)}`,
    timeMs: candidate.startMs,
    endMs: candidate.endMs,
    timeBoundsMs: [candidate.startMs, Math.max(candidate.startMs, Math.min(candidate.endMs - 1, candidate.startMs + summary.resolutionMs - 1))],
    evidenceStatus: 'calculated',
    method: summary.method,
    scope: summary.scope,
    resolutionMs: summary.resolutionMs,
    damage: candidate.damage,
    coverage: summary.coverage,
    limitations: summary.limitations,
  }));
}

function pressureAnchors(summary: ExecutionActivitySummary | undefined, prefix: string, fightId: string): ExecutionAnchor[] {
  if (!summary?.pressure) return [];
  return summary.pressure.candidates.map((candidate, index) => ({
    id: `${fightId}:${summary.scope}:pressure:${candidate.startMs}:${candidate.endMs}`,
    kind: 'damage-pressure',
    label: `${prefix} ${index + 1} · ${clock(candidate.startMs)}`,
    timeMs: candidate.startMs,
    endMs: candidate.endMs,
    timeBoundsMs: [candidate.startMs, Math.max(candidate.startMs, candidate.endMs - 1)],
    evidenceStatus: 'calculated',
    method: summary.pressure.method,
    scope: summary.scope,
    resolutionMs: summary.resolutionMs,
    damage: candidate.damage,
    baseline: candidate.baseline,
    excess: candidate.excess,
    ratio: candidate.ratio,
    coverage: summary.coverage,
    limitations: summary.pressure.limitations,
  }));
}

export function executionPressureCastContext(report: WvWReport, fightId: string, intervalMs: [number, number]): ExecutionPressureCastContext | undefined {
  const fight = report.stats.rotations?.fights.find(item => item.fightId === fightId);
  if (!fight) return undefined;
  const [startMs, endMs] = intervalMs;
  const damagingIds = fight.damagingSkillIds ? new Set(fight.damagingSkillIds) : null;
  const actors = new Set<string>();
  const damagingActors = new Set<string>();
  const skills = new Map<number, { casts: number; players: Set<string> }>();
  let castStarts = 0;
  let damagingCastStarts = 0;
  for (const player of fight.players) for (const cast of player.casts) {
    if (!Number.isFinite(cast.castTime) || cast.castTime < startMs || cast.castTime >= endMs) continue;
    castStarts++;
    actors.add(player.account);
    const skill = skills.get(cast.skillId) ?? { casts: 0, players: new Set<string>() };
    skill.casts++;
    skill.players.add(player.account);
    skills.set(cast.skillId, skill);
    if (damagingIds?.has(cast.skillId)) {
      damagingCastStarts++;
      damagingActors.add(player.account);
    }
  }
  return {
    intervalMs,
    recordedPlayers: fight.players.length,
    playersStartingCasts: actors.size,
    castStarts,
    damagingCastStarts: damagingIds ? damagingCastStarts : null,
    damagingPlayers: damagingIds ? damagingActors.size : null,
    skills: [...skills].map(([skillId, value]) => ({
      skillId,
      name: report.stats.rotations?.skillMeta[skillId]?.name ?? `Skill ${skillId}`,
      icon: report.stats.rotations?.skillMeta[skillId]?.icon,
      casts: value.casts,
      players: value.players.size,
      damaging: damagingIds ? damagingIds.has(skillId) : null,
    })).sort((a, b) => Number(b.damaging) - Number(a.damaging) || b.casts - a.casts || a.name.localeCompare(b.name)).slice(0, 6),
    limitations: [
      'Cast starts are timestamp overlaps, not damage attribution.',
      'A cast may resolve after the measured interval.',
      damagingIds ? 'Damage-linked means Elite Insights listed the skill in this fight damage distribution.' : 'This report does not classify which recorded skills dealt damage.',
    ],
  };
}

/** Activity starts are useful analysis anchors, but are never promoted to detected engagements. */
export function executionAnchors(report: WvWReport, fightId: string): ExecutionAnchor[] {
  const fight = report.stats.executionActivity?.fights.find(item => item.fightId === fightId);
  const manual: ExecutionAnchor = {
    id: 'manual', kind: 'manual', label: 'Manual moment', timeMs: 0,
    evidenceStatus: 'unknown', method: 'user-selected-time',
    limitations: ['User-selected moment, not a detected engagement.'],
  };
  if (!fight) return [manual];
  return [
    manual,
    ...pressureAnchors(fight.scopes.recordedEnemyPlayers, 'Enemy pressure wave', fightId),
    ...activityAnchors(fight.scopes.recordedEnemyPlayers, 'Enemy-player activity', fightId),
    ...pressureAnchors(fight.scopes.allTargets, 'All-target pressure wave', fightId),
    ...activityAnchors(fight.scopes.allTargets, 'All-target activity', fightId),
  ].map(anchor => anchor.kind === 'damage-pressure' && anchor.timeBoundsMs
    ? { ...anchor, castContext: executionPressureCastContext(report, fightId, [anchor.timeBoundsMs[0], anchor.timeBoundsMs[1] + 1]) }
    : anchor);
}

export function preferredExecutionAnchor(anchors: ExecutionAnchor[]): ExecutionAnchor {
  return anchors.find(anchor => anchor.kind === 'damage-pressure' && anchor.scope === 'recorded-enemy-players')
    ?? anchors.find(anchor => anchor.kind === 'damage-activity' && anchor.scope === 'recorded-enemy-players')
    ?? anchors.find(anchor => anchor.kind === 'damage-pressure')
    ?? anchors.find(anchor => anchor.kind === 'damage-activity')
    ?? anchors[0];
}
