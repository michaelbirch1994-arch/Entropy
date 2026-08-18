import { describe, expect, it } from 'vitest';
import {
    buildDeathBoonCorrelationRows,
    nextDeathBoonSort,
    sortDeathBoonRows,
    type DeathBoonSortState,
} from '../deathRecapTable';

const columns = [
    { id: 1, name: 'Stability' },
    { id: 2, name: 'Protection' },
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
        expect(player?.boons.find((boon) => boon.id === 1)?.pct).toBe(30);
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
        expect(sorted.map((row) => [row.account, row.boons.find((boon) => boon.id === 2)?.pct])).toEqual([
            ['Ten.10', 10],
            ['Nine.9', 90],
        ]);
    });
});
