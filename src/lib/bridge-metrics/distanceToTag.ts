import type { DistanceToTagResult, DistanceToTagRow } from '../../types/report';

export type DistanceContributionSource = 'replay' | 'fightAvg';

export interface DistanceContribution {
    account: string;
    profession: string;
    isCommander: boolean;
    fightId: string;
    source: DistanceContributionSource;
    samples: number[];
    fightMean: number;
}

interface DistanceFightInput {
    raw: Record<string, unknown>;
    summary?: { permalink?: string };
}

const finiteNumber = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

const validPoint = (value: unknown): value is [number, number] =>
    Array.isArray(value)
    && value.length >= 2
    && finiteNumber(value[0]) !== null
    && finiteNumber(value[1]) !== null;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function getFightAverage(player: any): number | null {
    const value = finiteNumber(player?.statsAll?.[0]?.stackDist);
    return value !== null && value >= 0 ? value : null;
}

export function ingestDistanceFight(fight: DistanceFightInput, fightIndex: number): DistanceContribution[] {
    const raw = fight.raw as any;
    const players = Array.isArray(raw?.players) ? raw.players.filter((player: any) => !player?.notInSquad) : [];
    if (players.length === 0) return [];

    const fightId = String(fight.summary?.permalink || raw?.timeStartStd || raw?.timeStart || `fight-${fightIndex}`);
    const replayMeta = raw?.combatReplayMetaData ?? {};
    const pollingRate = finiteNumber(replayMeta.pollingRate);
    const inchToPixel = finiteNumber(replayMeta.inchToPixel);
    const commander = players.find((player: any) => player?.hasCommanderTag);
    const tagPositions = Array.isArray(commander?.combatReplayData?.positions)
        ? commander.combatReplayData.positions
        : [];
    const replayUsable = !!commander
        && tagPositions.length > 0
        && pollingRate !== null
        && pollingRate > 0
        && inchToPixel !== null
        && inchToPixel > 0;

    const contributions: DistanceContribution[] = [];

    players.forEach((player: any, playerIndex: number) => {
        const account = String(player?.account || player?.name || `Unknown-${playerIndex}`);
        const profession = String(player?.profession || 'Unknown');
        const isCommander = !!player?.hasCommanderTag;
        const positions = Array.isArray(player?.combatReplayData?.positions)
            ? player.combatReplayData.positions
            : [];

        if (replayUsable && positions.length > 0) {
            const playerStart = finiteNumber(player?.combatReplayData?.start) ?? 0;
            const playerOffset = Math.max(0, Math.floor(playerStart / pollingRate!));
            const samples: number[] = [];

            positions.forEach((position: unknown, index: number) => {
                const tagIndex = clamp(index + playerOffset, 0, tagPositions.length - 1);
                const tagPosition = tagPositions[tagIndex];
                if (!validPoint(position) || !validPoint(tagPosition)) return;
                const distance = isCommander
                    ? 0
                    : Math.hypot(position[0] - tagPosition[0], position[1] - tagPosition[1]) / inchToPixel!;
                if (Number.isFinite(distance) && distance >= 0) samples.push(distance);
            });

            if (samples.length > 0) {
                contributions.push({
                    account,
                    profession,
                    isCommander,
                    fightId,
                    source: 'replay',
                    samples,
                    fightMean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
                });
                return;
            }
        }

        const fightMean = getFightAverage(player);
        if (fightMean === null) return;
        contributions.push({
            account,
            profession,
            isCommander,
            fightId,
            source: 'fightAvg',
            samples: [],
            fightMean,
        });
    });

    return contributions;
}

function median(sortedValues: number[]): number {
    if (sortedValues.length === 0) return 0;
    const middle = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
        ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
        : sortedValues[middle];
}

function nearestRank(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = clamp(Math.ceil(percentile * sortedValues.length) - 1, 0, sortedValues.length - 1);
    return sortedValues[index];
}

function consolidateFightContributions(list: DistanceContribution[]): DistanceContribution[] {
    const byFight = new Map<string, DistanceContribution[]>();
    list.forEach((contribution) => {
        const existing = byFight.get(contribution.fightId);
        if (existing) existing.push(contribution);
        else byFight.set(contribution.fightId, [contribution]);
    });

    return Array.from(byFight.values()).map((fightEntries) => {
        const replayEntries = fightEntries.filter((entry) => entry.source === 'replay' && entry.samples.length > 0);
        const selected = replayEntries.length > 0 ? replayEntries : fightEntries;
        const samples = replayEntries.flatMap((entry) => entry.samples);
        const fightMean = samples.length > 0
            ? samples.reduce((sum, value) => sum + value, 0) / samples.length
            : selected.reduce((sum, entry) => sum + entry.fightMean, 0) / selected.length;
        const latest = fightEntries[fightEntries.length - 1];
        return {
            account: latest.account,
            profession: latest.profession,
            isCommander: fightEntries.some((entry) => entry.isCommander),
            fightId: latest.fightId,
            source: replayEntries.length > 0 ? 'replay' : 'fightAvg',
            samples,
            fightMean,
        };
    });
}

export function finalizeDistanceToTag(contributions: DistanceContribution[]): DistanceToTagResult {
    if (contributions.length === 0) return { rows: [], commanderCount: 0 };

    const byAccount = new Map<string, DistanceContribution[]>();
    contributions.forEach((contribution) => {
        const existing = byAccount.get(contribution.account);
        if (existing) existing.push(contribution);
        else byAccount.set(contribution.account, [contribution]);
    });

    const commanderAccounts = new Set<string>();
    byAccount.forEach((list, account) => {
        if (list.some((entry) => entry.isCommander)) commanderAccounts.add(account);
    });
    const includeCommanders = commanderAccounts.size > 2;
    const rows: DistanceToTagRow[] = [];

    byAccount.forEach((rawList, account) => {
        const isCommander = commanderAccounts.has(account);
        if (isCommander && !includeCommanders) return;

        const list = consolidateFightContributions(rawList);
        const sources = new Set(list.map((entry) => entry.source));
        const source: DistanceToTagRow['source'] = sources.size > 1
            ? 'mixed'
            : sources.has('replay') ? 'replay' : 'fightAvg';
        const values = source === 'replay'
            ? list.flatMap((entry) => entry.samples.length > 0 ? entry.samples : [entry.fightMean])
            : list.map((entry) => entry.fightMean);
        if (values.length === 0) return;

        const sorted = [...values].sort((a, b) => a - b);
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        const professions = Array.from(new Set(rawList.map((entry) => entry.profession).filter((value) => value !== 'Unknown')));

        rows.push({
            account,
            profession: rawList[rawList.length - 1].profession,
            professionList: professions,
            fightCount: list.length,
            sampleCount: values.length,
            avg: Math.round(avg),
            p25: Math.round(nearestRank(sorted, 0.25)),
            median: Math.round(median(sorted)),
            p75: Math.round(nearestRank(sorted, 0.75)),
            p95: Math.round(nearestRank(sorted, 0.95)),
            source,
            isCommander,
        });
    });

    rows.sort((a, b) => b.avg - a.avg || a.account.localeCompare(b.account));
    return { rows, commanderCount: commanderAccounts.size };
}

export function computeDistanceToTag(fights: DistanceFightInput[]): DistanceToTagResult {
    const contributions = fights.flatMap((fight, index) => ingestDistanceFight(fight, index));
    return finalizeDistanceToTag(contributions);
}
