import { describe, expect, it } from 'vitest';
import {
    buildDeathBoonCorrelationRows,
    isDeathBoonBelowSquadAverage,
    isStackingBoonColumn,
    nextDeathBoonSort,
    sortDeathBoonRows,
    type DeathBoonSortState,
} from '../deathRecapTable';

const columns = [
    { id: 1, name: 'Stability', stacking: true },
    { id: 2, name: 'Protection', stacking: false },
];

describe('death recap table', () => {
    it('collapses duplicate profession rows into one stable account row', () => {
        const rows = buildDeathBoonCorrelationRows(
            [
                { account: 'Player.1234', profession: 'Firebrand', uptimes: { 1: 20, 2: 40 } },
                { account: 'Player.1234', profession: 'Scrapper', uptimes: { 1: 40, 2: 60 } },
                { account: 'Other.5678', profession: 'Druid', uptimes: { 1: 50, 2: 80 } },
            ],
            columns,
            [{ account: 'Player.1234' }, { account: 'Player.1234' }, { account: 'Other.5678' }],
        );

        expect(rows).toHaveLength(2);
        const player = rows.find((row) => row.account === 'Player.1234');
        expect(player?.key).toBe('player.1234');
        expect(player?.deaths).toBe(2);
        expect(player?.professions).toEqual(['Firebrand', 'Scrapper']);
        expect(player?.boons.find((boon) => boon.id === 1)?.value).toBe(30);
    });

    it('cycles descending, ascending, then default without mutating rows', () => {
        const rows = buildDeathBoonCorrelationRows(
            [
                { account: 'Bravo.2', profession: 'Druid', uptimes: { 1: 40, 2: 20 } },
                { account: 'Alpha.1', profession: 'Guardian', uptimes: { 1: 10, 2: 60 } },
            ],
            columns,
            [{ account: 'Bravo.2' }, { account: 'Alpha.1' }, { account: 'Alpha.1' }],
        );
        const original = rows.map((row) => row.account);

        let sort: DeathBoonSortState = nextDeathBoonSort(null, 'deaths');
        expect(sortDeathBoonRows(rows, sort).map((row) => row.account)).toEqual(['Alpha.1', 'Bravo.2']);
        sort = nextDeathBoonSort(sort, 'deaths');
        expect(sortDeathBoonRows(rows, sort).map((row) => row.account)).toEqual(['Bravo.2', 'Alpha.1']);
        sort = nextDeathBoonSort(sort, 'deaths');
        expect(sort).toBeNull();
        expect(sortDeathBoonRows(rows, sort).map((row) => row.account)).toEqual(['Alpha.1', 'Bravo.2']);
        expect(rows.map((row) => row.account)).toEqual(original);
    });

    it('sorts boon values numerically and keeps row identities attached', () => {
        const rows = buildDeathBoonCorrelationRows(
            [
                { account: 'Nine.9', profession: 'Druid', uptimes: { 1: 9, 2: 90 } },
                { account: 'Ten.10', profession: 'Guardian', uptimes: { 1: 10, 2: 10 } },
            ],
            columns,
            [{ account: 'Nine.9' }, { account: 'Ten.10' }],
        );

        const sorted = sortDeathBoonRows(rows, { key: 1, dir: 'desc' });
        expect(sorted.map((row) => [row.account, row.boons.find((boon) => boon.id === 2)?.value])).toEqual([
            ['Ten.10', 10],
            ['Nine.9', 90],
        ]);
    });

    it('preserves Stability as average stacks instead of percent uptime', () => {
        const rows = buildDeathBoonCorrelationRows(
            [
                { account: 'Low.1', uptimes: { 1: 1.5, 2: 50 } },
                { account: 'High.2', uptimes: { 1: 3, 2: 70 } },
            ],
            columns,
            [{ account: 'Low.1' }, { account: 'High.2' }],
        );

        const lowStability = rows.find((row) => row.account === 'Low.1')?.boons.find((boon) => boon.id === 1);
        expect(lowStability).toMatchObject({ value: 1.5, squadAverage: 2.25, stacking: true, belowAvg: true });
        expect(rows[0].boons.find((boon) => boon.id === 2)?.stacking).toBe(false);
    });

    it('uses Stability presence as coverage while retaining average stacks', () => {
        const rows = buildDeathBoonCorrelationRows(
            [
                { account: 'Covered.1', uptimes: { 1: 2.5 }, presences: { 1: 62 } },
                { account: 'Gap.2', uptimes: { 1: 1.25 }, presences: { 1: 30 } },
                { account: 'None.3', uptimes: {} },
            ],
            [columns[0]],
            [{ account: 'Covered.1' }, { account: 'Gap.2' }, { account: 'None.3' }],
        );

        const covered = rows.find((row) => row.account === 'Covered.1')?.boons[0];
        const none = rows.find((row) => row.account === 'None.3')?.boons[0];
        expect(covered).toMatchObject({ value: 62, unit: 'percent', averageStacks: 2.5, squadAverage: 92 / 3 });
        expect(none).toMatchObject({ value: 0, unit: 'percent', averageStacks: 0, belowAvg: true });
    });

    it('recognizes Stability in legacy reports without stacking metadata', () => {
        expect(isStackingBoonColumn({ id: 1, name: 'Stability' })).toBe(true);
        expect(isStackingBoonColumn({ id: 2, name: 'Protection' })).toBe(false);
    });

    it('uses unit-aware below-average thresholds', () => {
        expect(isDeathBoonBelowSquadAverage(1.5, 2.25, true)).toBe(true);
        expect(isDeathBoonBelowSquadAverage(2.1, 2.25, true)).toBe(false);
        expect(isDeathBoonBelowSquadAverage(49, 60, false)).toBe(true);
        expect(isDeathBoonBelowSquadAverage(51, 60, false)).toBe(false);
    });
});
