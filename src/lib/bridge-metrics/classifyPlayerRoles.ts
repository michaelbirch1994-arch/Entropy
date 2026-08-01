// Vendored (with import paths adjusted for Entropy) from AxiBridge's
// src/renderer/stats/classifyPlayerRoles.ts. Not part of the published
// @axiapps/bridge-metrics package, but small and self-contained enough to
// bring along verbatim aside from import paths. GPL-3.0-only, see
// THIRD_PARTY_NOTICES.md.

import type { BoonTable } from './boonGeneration';
import type { PlayerRoleClassification, RoleClassificationFactor } from './roles';

export type { PlayerRoleClassification, RoleClassificationFactor };

/** Metric weights for support score calculation. Positive = support indicator, negative = damage indicator. */
const WEIGHTS = {
    healing: 1.8,
    cleanses: 1.6,
    totalBoonOutput: 1.8,
    dps: -0.8,
    damage: -1.5,
    downContrib: -2.5,
} as const;

/** Players scoring above this multiplier of the squad median support score are classified as support. */
const THRESHOLD_MULTIPLIER = 1.25;

/** When the squad median for a metric is zero but the player has a positive value, use this ratio. */
const OUTLIER_RATIO = 2.0;

type MinimalPlayerStats = {
    account: string;
    healing: number;
    cleanses: number;
    stab: number;
    dps: number;
    damage: number;
    downContrib: number;
    healingTotals: Record<string, number>;
};

const computeMedian = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const computeRatio = (value: number, median: number): number => {
    if (median > 0) return value / median;
    if (value > 0) return OUTLIER_RATIO;
    return 0;
};

const extractTotalBoonOutput = (boonTables: BoonTable[]): Map<string, number> => {
    const result = new Map<string, number>();
    for (const table of boonTables) {
        for (const row of table.rows) {
            const existing = result.get(row.account) || 0;
            result.set(row.account, existing + row.categories.squadBuffs.generationMs);
        }
    }
    return result;
};

/**
 * Classify each player as 'support' or 'damage' based on a weighted support score
 * normalized against the squad median.
 */
export const classifyPlayerRoles = (
    players: MinimalPlayerStats[],
    boonTables: BoonTable[],
): Map<string, PlayerRoleClassification> => {
    const result = new Map<string, PlayerRoleClassification>();
    if (players.length === 0) return result;

    const totalBoonGen = extractTotalBoonOutput(boonTables);

    const getOutgoingHealing = (p: MinimalPlayerStats) => {
        const total = p.healingTotals['healing'] || p.healing;
        const self = p.healingTotals['selfHealing'] || 0;
        return Math.max(total - self, 0);
    };

    const healingValues = players.map(getOutgoingHealing).filter((v) => v > 0);
    const cleanseValues = players.map((p) => p.cleanses).filter((v) => v > 0);
    const totalBoonValues = players.map((p) => totalBoonGen.get(p.account) || 0).filter((v) => v > 0);
    const dpsValues = players.map((p) => p.dps).filter((v) => v > 0);
    const damageValues = players.map((p) => p.damage).filter((v) => v > 0);
    const downContribValues = players.map((p) => p.downContrib).filter((v) => v > 0);

    const medianHealing = computeMedian(healingValues);
    const medianCleanses = computeMedian(cleanseValues);
    const medianTotalBoon = computeMedian(totalBoonValues);
    const medianDps = computeMedian(dpsValues);
    const medianDamage = computeMedian(damageValues);
    const medianDownContrib = computeMedian(downContribValues);

    const metricDefs: Array<{ metric: string; weight: number; getValue: (p: MinimalPlayerStats) => number; median: number }> = [
        { metric: 'Healing (others)', weight: WEIGHTS.healing, getValue: getOutgoingHealing, median: medianHealing },
        { metric: 'Cleanses', weight: WEIGHTS.cleanses, getValue: (p) => p.cleanses, median: medianCleanses },
        { metric: 'Total Boons', weight: WEIGHTS.totalBoonOutput, getValue: (p) => totalBoonGen.get(p.account) || 0, median: medianTotalBoon },
        { metric: 'DPS', weight: WEIGHTS.dps, getValue: (p) => p.dps, median: medianDps },
        { metric: 'Damage', weight: WEIGHTS.damage, getValue: (p) => p.damage, median: medianDamage },
        { metric: 'Down Contrib', weight: WEIGHTS.downContrib, getValue: (p) => p.downContrib, median: medianDownContrib },
    ];

    const scores: Array<{ account: string; supportScore: number; factors: RoleClassificationFactor[] }> = players.map((p) => {
        const factors: RoleClassificationFactor[] = [];
        let supportScore = 0;
        for (const def of metricDefs) {
            const value = def.getValue(p);
            const ratio = computeRatio(value, def.median);
            const contribution = ratio * def.weight;
            supportScore += contribution;
            factors.push({ metric: def.metric, value, median: def.median, ratio, weight: def.weight, contribution });
        }
        return { account: p.account, supportScore, factors };
    });

    const allSupportScores = scores.map((s) => s.supportScore);
    const medianSupportScore = computeMedian(allSupportScores);
    const threshold = medianSupportScore + Math.abs(medianSupportScore) * (THRESHOLD_MULTIPLIER - 1);

    const maxScore = Math.max(...allSupportScores);
    const minScore = Math.min(...allSupportScores);
    const supportSpan = Math.abs(maxScore - threshold) || 1;
    const damageSpan = Math.abs(threshold - minScore) || 1;
    for (const { account, supportScore, factors } of scores) {
        const role: 'support' | 'damage' = supportScore > threshold ? 'support' : 'damage';
        const span = role === 'support' ? supportSpan : damageSpan;
        const distance = Math.abs(supportScore - threshold) / span;
        const confidenceScore = Math.min(distance, 1);
        result.set(account, { role, supportScore, confidenceScore, threshold, factors });
    }

    return result;
};
