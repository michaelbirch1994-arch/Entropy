export interface DeathBoonColumn {
    id: number;
    name: string;
    icon?: string;
}

export interface DeathBoonSourceRow {
    account: string;
    profession?: string;
    professionList?: string[];
    uptimes: Record<number, number>;
}

export interface DeathBoonCell {
    id: number;
    name: string;
    icon?: string;
    pct: number;
    squadAvgPct: number;
    belowAvg: boolean;
}

export interface DeathBoonCorrelationRow {
    key: string;
    account: string;
    professions: string[];
    deaths: number;
    boons: DeathBoonCell[];
}

export type DeathBoonSortKey = 'player' | 'deaths' | number;
export type DeathBoonSortState = { key: DeathBoonSortKey; dir: 'asc' | 'desc' } | null;

const stableAccountKey = (account: string) => String(account || 'Unknown').trim().toLocaleLowerCase();

/**
 * Older combined reports can contain one boon row per account+profession.
 * Collapse those rows before rendering so a player remains one stable table row
 * and React never reuses duplicate account keys when sorting changes.
 *
 * Old rows do not expose their duration weights, so duplicate uptime values use
 * an explicit arithmetic mean. Newly parsed reports already contain one
 * duration-weighted account row and pass through unchanged.
 */
export function buildDeathBoonCorrelationRows(
    sourceRows: DeathBoonSourceRow[],
    columns: DeathBoonColumn[],
    deaths: Array<{ account: string }>,
): DeathBoonCorrelationRow[] {
    type AccountBucket = {
        account: string;
        professions: Set<string>;
        boonSums: Map<number, number>;
        boonSamples: Map<number, number>;
    };

    const deathsByAccount = new Map<string, number>();
    deaths.forEach((death) => {
        const key = stableAccountKey(death.account);
        deathsByAccount.set(key, (deathsByAccount.get(key) ?? 0) + 1);
    });

    const buckets = new Map<string, AccountBucket>();
    sourceRows.forEach((row) => {
        const key = stableAccountKey(row.account);
        const bucket = buckets.get(key) ?? {
            account: String(row.account || 'Unknown').trim() || 'Unknown',
            professions: new Set<string>(),
            boonSums: new Map<number, number>(),
            boonSamples: new Map<number, number>(),
        };
        [row.profession, ...(row.professionList ?? [])].forEach((profession) => {
            const label = String(profession || '').trim();
            if (label && label !== 'Unknown') bucket.professions.add(label);
        });
        columns.forEach((column) => {
            const value = Number(row.uptimes?.[column.id]);
            if (!Number.isFinite(value)) return;
            bucket.boonSums.set(column.id, (bucket.boonSums.get(column.id) ?? 0) + value);
            bucket.boonSamples.set(column.id, (bucket.boonSamples.get(column.id) ?? 0) + 1);
        });
        buckets.set(key, bucket);
    });

    const baseRows = Array.from(buckets.entries())
        .map(([key, bucket]) => ({
            key,
            account: bucket.account,
            professions: Array.from(bucket.professions).sort((a, b) => a.localeCompare(b)),
            deaths: deathsByAccount.get(key) ?? 0,
            boonValues: new Map(columns.map((column) => {
                const samples = bucket.boonSamples.get(column.id) ?? 0;
                return [column.id, samples > 0 ? (bucket.boonSums.get(column.id) ?? 0) / samples : 0];
            })),
        }));

    const squadAverages = new Map<number, number>();
    columns.forEach((column) => {
        const values = baseRows.map((row) => row.boonValues.get(column.id) ?? 0);
        squadAverages.set(column.id, values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
    });

    return baseRows
        .filter((row) => row.deaths > 0)
        .map((row) => ({
            key: row.key,
            account: row.account,
            professions: row.professions,
            deaths: row.deaths,
            boons: columns.map((column) => {
                const pct = row.boonValues.get(column.id) ?? 0;
                const squadAvgPct = squadAverages.get(column.id) ?? 0;
                return {
                    id: column.id,
                    name: column.name,
                    icon: column.icon,
                    pct,
                    squadAvgPct,
                    belowAvg: pct < squadAvgPct - 10,
                };
            }),
        }));
}

export function nextDeathBoonSort(current: DeathBoonSortState, key: DeathBoonSortKey): DeathBoonSortState {
    if (!current || current.key !== key) return { key, dir: 'desc' };
    if (current.dir === 'desc') return { key, dir: 'asc' };
    return null;
}

export function sortDeathBoonRows(rows: DeathBoonCorrelationRow[], sort: DeathBoonSortState): DeathBoonCorrelationRow[] {
    const base = [...rows].sort((a, b) => a.account.localeCompare(b.account));
    if (!sort) return base;
    const direction = sort.dir === 'asc' ? 1 : -1;
    return base.sort((a, b) => {
        if (sort.key === 'player') return a.account.localeCompare(b.account) * direction;
        const aValue = sort.key === 'deaths'
            ? a.deaths
            : a.boons.find((boon) => boon.id === sort.key)?.pct;
        const bValue = sort.key === 'deaths'
            ? b.deaths
            : b.boons.find((boon) => boon.id === sort.key)?.pct;
        const aMissing = !Number.isFinite(aValue);
        const bMissing = !Number.isFinite(bValue);
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        const numericDiff = ((aValue ?? 0) - (bValue ?? 0)) * direction;
        return numericDiff || a.account.localeCompare(b.account);
    });
}
