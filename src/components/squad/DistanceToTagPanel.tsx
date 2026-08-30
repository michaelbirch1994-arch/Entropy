import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Gauge } from 'lucide-react';
import type { DistanceToTagResult, DistanceToTagRow, GeneralPlayer } from '../../types/report';
import { fmtNum } from '../../utils/format';
import Panel from '../ui/Panel';
import ProfessionIcon from '../ui/ProfessionIcon';
import BoundedDataRegion from '../ui/BoundedDataRegion';

type DistanceMetric = 'avg' | 'p25' | 'median' | 'p75' | 'p95';
type SortKey = 'account' | 'fightCount' | 'sampleCount' | DistanceMetric;
type SortDirection = 'asc' | 'desc';

const METRICS: Array<{ key: DistanceMetric; label: string }> = [
    { key: 'avg', label: 'Avg' },
    { key: 'p25', label: 'p25' },
    { key: 'median', label: 'Median' },
    { key: 'p75', label: 'p75' },
    { key: 'p95', label: 'p95' },
];

/* A real on-map "distance to tag" reading can't plausibly exceed this - it mirrors RUN_BACK_RANGE in computePlayerAggregation.ts, the same sanity ceiling the live aggregation pipeline already applies to discard outlier samples. The legacy fallback below reads an already-summed totalDist/distCount pair straight from an older saved report, so a single corrupted pairing can average out to a wildly implausible multi-million-unit figure (seen in the wild as e.g. "27,703,763" on the Distance to Tag card). Re-applying the same ceiling here keeps the legacy path honest with the live one instead of trusting unbounded historical data. */ const MAX_PLAUSIBLE_DISTANCE = 5000;

export function resolveDistanceToTagResult(
    result: DistanceToTagResult | undefined,
    legacyPlayers: GeneralPlayer[],
): DistanceToTagResult {
    if (result?.rows?.length) return result;

    const rows = legacyPlayers.flatMap<DistanceToTagRow>((player) => {
        if (!(player.distCount > 0) || !Number.isFinite(player.totalDist)) return [];
        const avg = Math.round(player.totalDist / player.distCount);
        // Raw metrics v5 counted missing distance as zero. A real non-commander
        // player cannot average exactly zero, so omit those hollow legacy rows.
                if (!Number.isFinite(avg) || avg <= 0 || avg > MAX_PLAUSIBLE_DISTANCE) return [];
        return [{
            account: player.account,
            profession: player.profession,
            professionList: player.professionList,
            fightCount: player.distCount,
            sampleCount: player.distCount,
            avg,
            p25: avg,
            median: avg,
            p75: avg,
            p95: avg,
            source: 'legacy',
            isCommander: false,
        }];
    });

    rows.sort((a, b) => b.avg - a.avg || a.account.localeCompare(b.account));
    return { rows, commanderCount: 0 };
}

function distanceBand(distance: number) {
    if (distance <= 600) return { dot: 'bg-emerald-400', text: 'text-emerald-300' };
    if (distance <= 800) return { dot: 'bg-yellow-400', text: 'text-yellow-300' };
    if (distance <= 1200) return { dot: 'bg-orange-400', text: 'text-orange-300' };
    return { dot: 'bg-rose-400', text: 'text-rose-300' };
}

function stableAngle(account: string) {
    let hash = 2166136261;
    for (let index = 0; index < account.length; index += 1) {
        hash ^= account.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) / 0xffffffff) * Math.PI * 2 - Math.PI / 2;
}

function sourceLabel(source: DistanceToTagRow['source']) {
    return source === 'fightAvg' ? 'fight avg' : source;
}

function sourceHelp(source: DistanceToTagRow['source']) {
    if (source === 'replay') return 'Computed from per-tick player and commander replay positions.';
    if (source === 'fightAvg') return 'Computed from one Elite Insights stack-distance average per fight.';
    if (source === 'mixed') return 'Replay and fallback fights were each reduced to one fight average to prevent sample-count skew.';
    return 'Recovered from an older saved report. Re-import the original logs for percentiles and source detail.';
}

function SortButton({
    label,
    sortKey,
    activeKey,
    direction,
    onSort,
}: {
    label: string;
    sortKey: SortKey;
    activeKey: SortKey;
    direction: SortDirection;
    onSort: (key: SortKey) => void;
}) {
    const active = activeKey === sortKey;
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className={`inline-flex items-center gap-1 uppercase transition-colors hover:text-theme-text ${active ? 'text-theme-accent-strong' : 'text-theme-muted'}`}
        >
            {label}
            {active && (direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
    );
}

export default function DistanceToTagPanel({ result }: { result: DistanceToTagResult }) {
    const [metric, setMetric] = useState<DistanceMetric>('avg');
    const [sortKey, setSortKey] = useState<SortKey>('avg');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [filterEnabled, setFilterEnabled] = useState(false);
    const [minimumFights, setMinimumFights] = useState(3);
    const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

    const rows = result.rows ?? [];
    const visibleRows = useMemo(() => {
        const filtered = filterEnabled ? rows.filter((row) => row.fightCount >= minimumFights) : rows;
        return [...filtered].sort((a, b) => {
            const aValue = sortKey === 'account' ? a.account : a[sortKey];
            const bValue = sortKey === 'account' ? b.account : b[sortKey];
            const compared = typeof aValue === 'string'
                ? aValue.localeCompare(String(bValue))
                : Number(aValue) - Number(bValue);
            return (sortDirection === 'asc' ? compared : -compared) || a.account.localeCompare(b.account);
        });
    }, [filterEnabled, minimumFights, rows, sortDirection, sortKey]);

    const activeRow = rows.find((row) => row.account === (hoveredAccount ?? selectedAccount)) ?? null;
    const onTagCount = visibleRows.filter((row) => row[metric] <= 600).length;
    const driftCount = visibleRows.filter((row) => row[metric] > 600 && row[metric] <= 1200).length;
    const splitCount = visibleRows.filter((row) => row[metric] > 1200).length;
    const hiddenCount = rows.length - visibleRows.length;

    const setSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortKey(key);
        setSortDirection(key === 'account' ? 'asc' : 'desc');
    };

    return (
        <Panel
            title="Distance to Tag"
            subtitle="Replay-aware squad cohesion. Radius is measured distance; angle is display-only."
            icon={<Gauge className="h-4 w-4" />}
            accent="text-orange-400"
            action={rows.length ? `${rows.length} players` : 'no distance data'}
        >
            {rows.length === 0 ? (
                <div className="border border-dashed border-theme-border p-6 text-sm text-theme-muted">
                    No valid commander replay or Elite Insights stack-distance data is available for this report.
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-border/60 pb-4">
                        <div role="group" aria-label="Distance statistic" className="flex flex-wrap gap-1">
                            {METRICS.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    aria-pressed={metric === option.key}
                                    onClick={() => setMetric(option.key)}
                                    className={`h-8 border px-3 text-[10px] font-black uppercase transition-colors ${metric === option.key ? 'border-theme-accent bg-theme-accent/15 text-theme-accent-strong' : 'border-theme-border bg-theme-surface-inset text-theme-muted hover:text-theme-text'}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] uppercase text-theme-muted">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={filterEnabled}
                                onClick={() => setFilterEnabled((current) => !current)}
                                className={`relative h-5 w-9 border transition-colors ${filterEnabled ? 'border-theme-accent bg-theme-accent/25' : 'border-theme-border bg-theme-surface-inset'}`}
                                title="Filter low-attendance players"
                            >
                                <span className={`absolute top-0.5 h-3.5 w-3.5 bg-theme-text transition-all ${filterEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                            <span>Min</span>
                            <input
                                type="number"
                                min={1}
                                value={minimumFights}
                                onFocus={() => setFilterEnabled(true)}
                                onChange={(event) => {
                                    setFilterEnabled(true);
                                    setMinimumFights(Math.max(1, Number(event.target.value) || 1));
                                }}
                                aria-label="Minimum fight count"
                                className="h-7 w-12 border border-theme-border bg-theme-surface-inset text-center font-mono text-theme-text outline-none focus:border-theme-accent"
                            />
                            <span>fights</span>
                            {filterEnabled && hiddenCount > 0 && <span>{hiddenCount} hidden</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 border border-theme-border bg-theme-surface-inset/70 text-center">
                        <div className="border-r border-theme-border p-3">
                            <div className="font-mono text-xl font-black text-emerald-300">{onTagCount}</div>
                            <div className="text-[9px] font-black uppercase text-theme-muted">On tag - 600 or less</div>
                        </div>
                        <div className="border-r border-theme-border p-3">
                            <div className="font-mono text-xl font-black text-orange-300">{driftCount}</div>
                            <div className="text-[9px] font-black uppercase text-theme-muted">Drifting - 601 to 1200</div>
                        </div>
                        <div className="p-3">
                            <div className="font-mono text-xl font-black text-rose-300">{splitCount}</div>
                            <div className="text-[9px] font-black uppercase text-theme-muted">Split - over 1200</div>
                        </div>
                    </div>

                    <div className="theme-distance-layout grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                        <div>
                            <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-full border border-theme-border bg-rose-950/20 shadow-[inset_0_0_80px_rgba(0,0,0,0.72)]">
                                <div className="absolute inset-[10%] rounded-full border border-orange-400/30 bg-orange-950/25" />
                                <div className="absolute inset-[23.33%] rounded-full border border-yellow-400/30 bg-yellow-950/25" />
                                <div className="absolute inset-[30%] rounded-full border border-emerald-400/35 bg-emerald-950/35" />
                                <div className="absolute inset-[49%] rounded-full bg-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.75)]" />
                                <span className="absolute right-[27%] top-1/2 -translate-y-1/2 font-mono text-[8px] text-emerald-200/60">600</span>
                                <span className="absolute right-[20%] top-1/2 -translate-y-1/2 font-mono text-[8px] text-yellow-200/60">800</span>
                                <span className="absolute right-[7%] top-1/2 -translate-y-1/2 font-mono text-[8px] text-orange-200/60">1200</span>

                                {visibleRows.map((row) => {
                                    const angle = stableAngle(row.account);
                                    const radius = Math.min(row[metric], 1500) / 1500 * 44;
                                    const left = 50 + Math.cos(angle) * radius;
                                    const top = 50 + Math.sin(angle) * radius;
                                    const tone = distanceBand(row[metric]);
                                    const selected = row.account === selectedAccount;
                                    return (
                                        <button
                                            key={row.account}
                                            type="button"
                                            className={`absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-black/70 ${tone.dot} shadow-[0_0_12px_rgba(0,0,0,0.9)] outline-none transition-transform hover:z-20 hover:scale-125 focus:z-20 focus:scale-125 ${selected ? 'ring-2 ring-white/75' : ''}`}
                                            style={{ left: `${left}%`, top: `${top}%` }}
                                            onMouseEnter={() => setHoveredAccount(row.account)}
                                            onMouseLeave={() => setHoveredAccount(null)}
                                            onFocus={() => setHoveredAccount(row.account)}
                                            onBlur={() => setHoveredAccount(null)}
                                            onClick={() => setSelectedAccount((current) => current === row.account ? null : row.account)}
                                            aria-label={`${row.account}, ${row[metric]} ${metric} distance`}
                                            aria-pressed={selected}
                                        >
                                            <ProfessionIcon profession={row.profession} className="h-4 w-4 rounded-full" />
                                        </button>
                                    );
                                })}

                                {activeRow && (
                                    <div className="pointer-events-none absolute left-1/2 top-3 z-30 w-[76%] -translate-x-1/2 border border-theme-border bg-theme-surface-elevated/95 p-3 text-center shadow-xl">
                                        <div className="truncate text-xs font-black text-theme-text">{activeRow.account}</div>
                                        <div className="mt-1 font-mono text-sm font-black text-theme-accent-strong">{fmtNum(activeRow[metric])} {metric}</div>
                                        <div className="mt-1 text-[9px] uppercase text-theme-muted">
                                            avg {fmtNum(activeRow.avg)} - median {fmtNum(activeRow.median)} - p95 {fmtNum(activeRow.p95)}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p className="mt-3 text-[10px] leading-relaxed text-theme-muted">
                                Each player keeps a stable display angle. Only distance from the center is measured; this is not a map-position replay.
                            </p>
                        </div>

                        <BoundedDataRegion
                            label={`Distance to tag player table, ${visibleRows.length} players`}
                            itemCount={visibleRows.length}
                            maxHeightClass="max-h-[32rem]"
                            scrollAxes="both"
                            className="theme-table-shell"
                        >
                            <table className="w-full min-w-[720px] text-left text-xs">
                                <thead className="sticky top-0 z-10 bg-theme-surface-elevated text-[9px] font-black uppercase text-theme-muted">
                                    <tr className="border-b border-theme-border">
                                        <th className="px-3 py-2.5"><SortButton label="Player" sortKey="account" activeKey={sortKey} direction={sortDirection} onSort={setSort} /></th>
                                        <th className="px-3 py-2.5 text-right"><SortButton label="Fights" sortKey="fightCount" activeKey={sortKey} direction={sortDirection} onSort={setSort} /></th>
                                        <th className="px-3 py-2.5 text-right"><SortButton label="Samples" sortKey="sampleCount" activeKey={sortKey} direction={sortDirection} onSort={setSort} /></th>
                                        <th className="px-3 py-2.5 text-right"><SortButton label="Avg" sortKey="avg" activeKey={sortKey} direction={sortDirection} onSort={setSort} /></th>
                                        <th className="px-3 py-2.5 text-right"><SortButton label="Median" sortKey="median" activeKey={sortKey} direction={sortDirection} onSort={setSort} /></th>
                                        <th className="px-3 py-2.5 text-right"><SortButton label="p95" sortKey="p95" activeKey={sortKey} direction={sortDirection} onSort={setSort} /></th>
                                        <th className="px-3 py-2.5">Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleRows.map((row) => {
                                        const tone = distanceBand(row[metric]);
                                        return (
                                            <tr
                                                key={row.account}
                                                className={`border-t border-theme-border/50 transition-colors hover:bg-theme-accent/5 ${selectedAccount === row.account ? 'bg-theme-accent/10' : ''}`}
                                                onMouseEnter={() => setHoveredAccount(row.account)}
                                                onMouseLeave={() => setHoveredAccount(null)}
                                            >
                                                <td className="px-3 py-2.5">
                                                    <button type="button" onClick={() => setSelectedAccount((current) => current === row.account ? null : row.account)} className="flex items-center gap-2 text-left text-theme-text">
                                                        <ProfessionIcon profession={row.profession} className="h-4 w-4 shrink-0" />
                                                        <span>{row.account}</span>
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono text-theme-muted">{fmtNum(row.fightCount)}</td>
                                                <td className="px-3 py-2.5 text-right font-mono text-theme-muted">{fmtNum(row.sampleCount)}</td>
                                                <td className={`px-3 py-2.5 text-right font-mono font-bold ${metric === 'avg' ? tone.text : 'text-theme-text'}`}>{fmtNum(row.avg)}</td>
                                                <td className={`px-3 py-2.5 text-right font-mono font-bold ${metric === 'median' ? tone.text : 'text-theme-text'}`}>{fmtNum(row.median)}</td>
                                                <td className={`px-3 py-2.5 text-right font-mono font-bold ${metric === 'p95' ? tone.text : 'text-theme-text'}`}>{fmtNum(row.p95)}</td>
                                                <td className="px-3 py-2.5">
                                                    <span title={sourceHelp(row.source)} className="border border-theme-border bg-theme-surface-inset px-1.5 py-1 text-[9px] uppercase text-theme-muted">
                                                        {sourceLabel(row.source)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </BoundedDataRegion>
                    </div>
                </div>
            )}
        </Panel>
    );
}
