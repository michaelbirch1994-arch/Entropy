import type { ClassSlice, FightRow } from "../types/report";

export interface CompositionComparisonRow {
  name: string;
  color: string;
  squadCount: number;
  enemyCount: number;
  squadPct: number;
  enemyPct: number;
  deltaPct: number;
}

export interface ProfessionPresenceSummary {
  totalFights: number;
  fightsPresent: number;
  fightsAbsent: number;
  coveragePct: number;
  averagePerFight: number;
  peakCount: number;
}

export function buildCompositionComparison(
  squadData: ClassSlice[],
  enemyData: ClassSlice[],
): CompositionComparisonRow[] {
  const squadTotal = squadData.reduce((sum, row) => sum + row.value, 0);
  const enemyTotal = enemyData.reduce((sum, row) => sum + row.value, 0);
  const squadByName = new Map(squadData.map((row) => [row.name, row]));
  const enemyByName = new Map(enemyData.map((row) => [row.name, row]));
  const names = new Set([...squadByName.keys(), ...enemyByName.keys()]);

  return [...names]
    .map((name) => {
      const squad = squadByName.get(name);
      const enemy = enemyByName.get(name);
      const squadCount = squad?.value ?? 0;
      const enemyCount = enemy?.value ?? 0;
      const squadPct = squadTotal > 0 ? (squadCount / squadTotal) * 100 : 0;
      const enemyPct = enemyTotal > 0 ? (enemyCount / enemyTotal) * 100 : 0;
      return {
        name,
        color: squad?.color ?? enemy?.color ?? "#94a3b8",
        squadCount,
        enemyCount,
        squadPct,
        enemyPct,
        deltaPct: enemyPct - squadPct,
      };
    })
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || a.name.localeCompare(b.name));
}

export function summarizeProfessionPresence(
  fights: FightRow[],
  profession: string | null,
): ProfessionPresenceSummary {
  if (!profession || fights.length === 0) {
    return { totalFights: fights.length, fightsPresent: 0, fightsAbsent: fights.length, coveragePct: 0, averagePerFight: 0, peakCount: 0 };
  }

  const counts = fights.map((fight) => fight.squadClassCountsFight?.[profession] ?? 0);
  const fightsPresent = counts.filter((count) => count > 0).length;
  const total = counts.reduce((sum, count) => sum + count, 0);
  return {
    totalFights: fights.length,
    fightsPresent,
    fightsAbsent: fights.length - fightsPresent,
    coveragePct: (fightsPresent / fights.length) * 100,
    averagePerFight: total / fights.length,
    peakCount: Math.max(0, ...counts),
  };
}
