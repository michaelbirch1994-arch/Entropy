export interface DeathBoonColumn {
    id: number;
    name: string;
    icon?: string;
    /**
     * Elite Insights reports intensity-stacking buffs as average stacks rather
     * than percent uptime. Optional so older saved Entropy reports still load.
     */
    stacking?: boolean;
}

export interface DeathBoonSourceRow {
    account: string;
    profession?: string;
    professionList?: string[];
    uptimes: Record<number, number>;
    presences?: Record<number, number>;
}

export interface DeathBoonCell {
    id: number;
    name: string;
    icon?: string;
    value: number;
    squadAverage: number;
    stacking: boolean;
    unit: 'percent' | 'stacks';
    averageStacks?: number;
    squadAverageStacks?: number;
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

const LEGACY_STACKING_BOONS = new Set(['might', 'stability']);

/** Saved reports created before stacking metadata was persisted still need the
 * correct unit. Keep the fallback deliberately narrow to known GW2 boons. */
export function isStackingBoonColumn(column: DeathBoonColumn): boolean {
    return column.stacking ?? LEGACY_STACKING_BOONS.has(column.name.trim().toLocaleLowerCase());
}

export function isDeathBoonBelowSquadAverage(value: number, squadAverage: number, stacking: boolean): boolean {
    if (!Number.isFinite(value) || !Number.isFinite(squadAverage) || squadAverage <= 0) return false;
    const gap = squadAverage - value;
    if (stacking) {
        // A fixed ten-point uptime gap has no meaning for average stacks. Flag
        // a material relative deficit while ignoring rounding-sized noise.
        return gap >= Math.max(0.1, squadAverage * 0.25);
    }
    return gap >= 10;
}

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
    const presenceSupportedColumns = new Set(
        columns
            .filter((column) => sourceRows.some((row) => Object.prototype.hasOwnProperty.call(row.presences ?? {}, column.id)))
            .map((column) => column.id),
    );
    type AccountBucket = {
        account: string;
        professions: Set<string>;
        boonSums: Map<number, number>;
        boonSamples: Map<number, number>;
        presenceSums: Map<number, number>;
        presenceSamples: Map<number, number>;
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
            presenceSums: new Map<number, number>(),
            presenceSamples: new Map<number, number>(),
        };
        [row.profession, ...(row.professionList ?? [])].forEach((profession) => {
            const label = String(profession || '').trim();
            if (label && label !== 'Unknown') bucket.professions.add(label);
        });
        columns.forEach((column) => {
            const value = Number(row.uptimes?.[column.id]);
            if (Number.isFinite(value)) {
                bucket.boonSums.set(column.id, (bucket.boonSums.get(column.id) ?? 0) + value);
                bucket.boonSamples.set(column.id, (bucket.boonSamples.get(column.id) ?? 0) + 1);
            }
            if (Object.prototype.hasOwnProperty.call(row.presences ?? {}, column.id)) {
                const presence = Number(row.presences?.[column.id]);
                if (Number.isFinite(presence)) {
                    bucket.presenceSums.set(column.id, (bucket.presenceSums.get(column.id) ?? 0) + presence);
                    bucket.presenceSamples.set(column.id, (bucket.presenceSamples.get(column.id) ?? 0) + 1);
                }
            }
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
            boonPresences: new Map(columns.map((column) => {
                const samples = bucket.presenceSamples.get(column.id) ?? 0;
                return [
                    column.id,
                    samples > 0
                        ? (bucket.presenceSums.get(column.id) ?? 0) / samples
                        : presenceSupportedColumns.has(column.id) ? 0 : undefined,
                ];
            })),
        }));

    const squadAverages = new Map<number, number>();
    const squadPresenceAverages = new Map<number, number>();
    columns.forEach((column) => {
        const values = baseRows.map((row) => row.boonValues.get(column.id) ?? 0);
        squadAverages.set(column.id, values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
        const presenceValues = baseRows
            .map((row) => row.boonPresences.get(column.id))
            .filter((value): value is number => Number.isFinite(value));
        if (presenceValues.length > 0) {
            squadPresenceAverages.set(column.id, presenceValues.reduce((sum, value) => sum + value, 0) / presenceValues.length);
        }
    });

    return baseRows
        .filter((row) => row.deaths > 0)
        .map((row) => ({
            key: row.key,
            account: row.account,
            professions: row.professions,
            deaths: row.deaths,
            boons: columns.map((column) => {
                const value = row.boonValues.get(column.id) ?? 0;
                const squadAverage = squadAverages.get(column.id) ?? 0;
                const stacking = isStackingBoonColumn(column);
                const presence = stacking ? row.boonPresences.get(column.id) : undefined;
                const squadPresenceAverage = stacking ? squadPresenceAverages.get(column.id) : undefined;
                const hasPresence = Number.isFinite(presence) && Number.isFinite(squadPresenceAverage);
                const displayValue = hasPresence ? presence! : value;
                const displaySquadAverage = hasPresence ? squadPresenceAverage! : squadAverage;
                const unit = hasPresence || !stacking ? 'percent' : 'stacks';
                return {
                    id: column.id,
                    name: column.name,
                    icon: column.icon,
                    value: displayValue,
                    squadAverage: displaySquadAverage,
                    stacking,
                    unit,
                    ...(stacking ? { averageStacks: value, squadAverageStacks: squadAverage } : {}),
                    belowAvg: isDeathBoonBelowSquadAverage(displayValue, displaySquadAverage, unit === 'stacks'),
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
            : a.boons.find((boon) => boon.id === sort.key)?.value;
        const bValue = sort.key === 'deaths'
            ? b.deaths
            : b.boons.find((boon) => boon.id === sort.key)?.value;
        const aMissing = !Number.isFinite(aValue);
        const bMissing = !Number.isFinite(bValue);
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        const numericDiff = ((aValue ?? 0) - (bValue ?? 0)) * direction;
        return numericDiff || a.account.localeCompare(b.account);
    });
}
