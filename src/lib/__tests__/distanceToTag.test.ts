import { describe, expect, it } from 'vitest';
import {
    computeDistanceToTag,
    finalizeDistanceToTag,
    type DistanceContribution,
} from '../bridge-metrics/distanceToTag';

function player(options: {
    account: string;
    profession?: string;
    commander?: boolean;
    stackDist?: number;
    positions?: Array<[number, number]>;
    start?: number;
    notInSquad?: boolean;
}) {
    return {
        account: options.account,
        profession: options.profession ?? 'Guardian',
        hasCommanderTag: options.commander ?? false,
        notInSquad: options.notInSquad ?? false,
        statsAll: options.stackDist === undefined ? [] : [{ stackDist: options.stackDist }],
        combatReplayData: options.positions
            ? { positions: options.positions, start: options.start ?? 0 }
            : undefined,
    };
}

function fight(
    id: string,
    players: ReturnType<typeof player>[],
    replayMeta?: { pollingRate: number; inchToPixel: number },
) {
    return {
        summary: { permalink: id },
        raw: {
            players,
            ...(replayMeta ? { combatReplayMetaData: replayMeta } : {}),
        },
    };
}

function contribution(overrides: Partial<DistanceContribution>): DistanceContribution {
    return {
        account: 'Player.1000',
        profession: 'Guardian',
        isCommander: false,
        fightId: 'fight-1',
        source: 'fightAvg',
        samples: [],
        fightMean: 0,
        ...overrides,
    };
}

describe('computeDistanceToTag', () => {
    it('does not invent zero-distance rows when the report has no usable distance source', () => {
        const result = computeDistanceToTag([
            fight('fight-1', [
                player({ account: 'Commander.1000', commander: true }),
                player({ account: 'Player.1000' }),
            ]),
        ]);

        expect(result.rows).toEqual([]);
    });

    it('uses one EI stack-distance value per fight when replay positions are unavailable', () => {
        const result = computeDistanceToTag([
            fight('fight-1', [
                player({ account: 'Commander.1000', commander: true, stackDist: 0 }),
                player({ account: 'Player.1000', stackDist: 200 }),
            ]),
            fight('fight-2', [
                player({ account: 'Commander.1000', commander: true, stackDist: 0 }),
                player({ account: 'Player.1000', stackDist: 400 }),
            ]),
        ]);

        expect(result.commanderCount).toBe(1);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({
            account: 'Player.1000',
            source: 'fightAvg',
            fightCount: 2,
            sampleCount: 2,
            avg: 300,
            median: 300,
            p95: 400,
        });
    });

    it('aligns replay positions to the commander timeline and preserves percentile samples', () => {
        const result = computeDistanceToTag([
            fight('fight-1', [
                player({
                    account: 'Commander.1000',
                    commander: true,
                    positions: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
                }),
                player({
                    account: 'Player.1000',
                    positions: [[3, 4], [6, 8], [9, 12]],
                    start: 300,
                    stackDist: 999,
                }),
            ], { pollingRate: 150, inchToPixel: 1 }),
        ]);

        expect(result.rows[0]).toMatchObject({
            source: 'replay',
            fightCount: 1,
            sampleCount: 3,
            avg: 10,
            median: 10,
            p95: 15,
        });
    });

    it('collapses replay fights to a fight mean in mixed mode to prevent duration skew', () => {
        const replaySamples = Array(1000).fill(100);
        const result = finalizeDistanceToTag([
            contribution({ fightId: 'fight-1', source: 'replay', samples: replaySamples, fightMean: 100 }),
            contribution({ fightId: 'fight-2', fightMean: 500 }),
            contribution({ fightId: 'fight-3', fightMean: 500 }),
            contribution({ fightId: 'fight-4', fightMean: 500 }),
            contribution({ fightId: 'fight-5', fightMean: 500 }),
        ]);

        expect(result.rows[0]).toMatchObject({
            source: 'mixed',
            fightCount: 5,
            sampleCount: 5,
            avg: 420,
            median: 500,
            p95: 500,
        });
    });

    it('consolidates duplicate account entries within one fight', () => {
        const result = finalizeDistanceToTag([
            contribution({ source: 'replay', samples: [100], fightMean: 100, profession: 'Guardian' }),
            contribution({ source: 'replay', samples: [300], fightMean: 300, profession: 'Firebrand' }),
        ]);

        expect(result.rows[0]).toMatchObject({
            fightCount: 1,
            sampleCount: 2,
            avg: 200,
            profession: 'Firebrand',
        });
        expect(result.rows[0].professionList.sort()).toEqual(['Firebrand', 'Guardian']);
    });

    it('excludes ordinary commander accounts from the squad comparison', () => {
        const result = finalizeDistanceToTag([
            contribution({ account: 'Commander.1000', isCommander: true, fightMean: 0 }),
            contribution({ account: 'Player.1000', fightMean: 250 }),
        ]);

        expect(result.commanderCount).toBe(1);
        expect(result.rows.map((row) => row.account)).toEqual(['Player.1000']);
    });
});
