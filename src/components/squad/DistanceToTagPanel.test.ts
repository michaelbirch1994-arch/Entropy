import { describe, expect, it } from 'vitest';
import type { DistanceToTagResult } from '../../types/report';
import { resolveDistanceToTagResult } from './DistanceToTagPanel';

function resultWithAverages(...averages: number[]): DistanceToTagResult {
    return {
        commanderCount: 1,
        rows: averages.map((avg, index) => ({
            account: `Player.${index + 1}`,
            profession: 'Guardian',
            professionList: ['Guardian'],
            fightCount: 1,
            sampleCount: 1,
            avg,
            p25: avg,
            median: avg,
            p75: avg,
            p95: avg,
            source: 'fightAvg',
            isCommander: false,
        })),
    };
}

describe('resolveDistanceToTagResult', () => {
    it('removes impossible parser distances from an existing report', () => {
        const resolved = resolveDistanceToTagResult(resultWithAverages(420, 4_852_204), []);

        expect(resolved.rows.map((row) => row.avg)).toEqual([420]);
    });

    it('does not expose a report containing only impossible distances', () => {
        const resolved = resolveDistanceToTagResult(resultWithAverages(4_852_204), []);

        expect(resolved.rows).toEqual([]);
    });
});
