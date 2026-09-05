/**
 * "Who kept me alive?" — incoming healing attribution for a single player.
 *
 * Design rule for this component: never turn incomplete data into false precision.
 * Two independent qualifiers are always shown, because they mean different things
 * and can disagree:
 *
 *   Coverage    - how complete the TOTAL is (did this player run the heal addon?)
 *   Attribution - how far the per-contributor SPLIT can be trusted (did the ally
 *                 axis reconcile against Elite Insights?)
 *
 * A partial total with high attribution is entirely normal and worth saying out
 * loud: "we know exactly who healed you, we just cannot be sure that is all of it."
 */

import { useState } from 'react';
import type { IncomingHealingBreakdown, HealingContributor } from '../../lib/bridge-metrics/incomingHealing';
import type { AttributionConfidence } from '../../lib/bridge-metrics/allyIndex';
import type { HealingCoverage } from '../../types/report';
import { fmtCompact } from '../../utils/format';
import ProfessionIdentity from './ProfessionIdentity';

const COVERAGE_TEXT: Record<HealingCoverage, { label: string; tone: string; title: string }> = {
    full: {
        label: 'Full',
        tone: 'text-emerald-400',
        title: 'This player ran the arcdps healing addon, so every heal landing on them was recorded.',
    },
    partial: {
        label: 'Partial',
        tone: 'text-amber-400',
        title:
            'This player did not run the healing addon. Only healing from allies who did run it was observed, ' +
            'so the true total is higher by an unknown amount.',
    },
    none: {
        label: 'Unavailable',
        tone: 'text-slate-500',
        title:
            'This player did not run the healing addon and no ally observed healing them. This is not the ' +
            'same as having received no healing.',
    },
};

const ATTRIBUTION_TEXT: Record<AttributionConfidence, { label: string; tone: string; title: string }> = {
    high: {
        label: 'High',
        tone: 'text-emerald-400',
        title: 'Exact reconciliation against Elite Insights\' own incoming-healing totals.',
    },
    medium: {
        label: 'Medium',
        tone: 'text-amber-400',
        title:
            'Valid attribution structure, but this log lacks incoming-healing data for independent ' +
            'reconciliation. Per-contributor figures are unconfirmed.',
    },
    low: {
        label: 'Low',
        tone: 'text-orange-400',
        title: 'Structure is plausible but unverified. Treat the split as indicative only.',
    },
    none: {
        label: 'Unavailable',
        tone: 'text-slate-500',
        title: 'Attribution cannot be trusted for this log, so the per-contributor split is withheld.',
    },
};

function Qualifier({ label, value, tone, title }: { label: string; value: string; tone: string; title: string }) {
    return (
        <span className="inline-flex items-baseline gap-1.5" title={title}>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
            <span className={`text-xs font-semibold ${tone}`}>{value}</span>
        </span>
    );
}

export default function SurvivalSupport({
    breakdown,
    onSelectContributor,
}: {
    breakdown: IncomingHealingBreakdown;
    /** Drill into a contributor's healing events. */
    onSelectContributor?: (c: HealingContributor) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const cov = COVERAGE_TEXT[breakdown.coverage];
    const attr = ATTRIBUTION_TEXT[breakdown.attributionConfidence];

    // A partial total is a floor, so the number carries a "+" the same way it does
    // everywhere else in Entropy.
    const totalSuffix = breakdown.coverage === 'partial' ? '+' : '';

    const rows = expanded ? breakdown.contributors : breakdown.contributors.slice(0, 6);
    const hidden = breakdown.contributors.length - rows.length;

    return (
        <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-4">
            <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Who Kept Me Alive?</h3>
                <div className="flex items-center gap-4">
                    <Qualifier label="Coverage" value={cov.label} tone={cov.tone} title={cov.title} />
                    <Qualifier label="Attribution" value={attr.label} tone={attr.tone} title={attr.title} />
                </div>
            </div>

            <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Incoming Healing</div>
                <div className="font-mono text-2xl font-bold text-emerald-400">
                    {breakdown.coverage === 'none' ? (
                        <span className="text-slate-600 text-base">n/a</span>
                    ) : (
                        <>
                            {fmtCompact(breakdown.healed)}
                            <span className="text-amber-500/80">{totalSuffix}</span>
                        </>
                    )}
                </div>
                {breakdown.conversionHealed > 0 && (
                    <div
                        className="mt-1 text-[11px] text-slate-500"
                        title="Healing derived from damage dealt rather than the Healing Power stat."
                    >
                        includes <span className="text-purple-400">{fmtCompact(breakdown.conversionHealed)}</span> life siphon
                    </div>
                )}
            </div>

            {breakdown.contributors.length > 0 ? (
                <table className="mt-3 w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-800/50 text-[10px] uppercase tracking-wider text-slate-500">
                            <th className="py-1.5 text-left font-bold">Contributor</th>
                            <th className="py-1.5 text-right font-bold">Healing</th>
                            <th className="py-1.5 text-right font-bold">Share</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 font-mono">
                        {rows.map((c) => (
                            <tr
                                key={`${c.account}-${c.name}`}
                                className={onSelectContributor ? 'cursor-pointer hover:bg-blue-950/20' : undefined}
                                onClick={onSelectContributor ? () => onSelectContributor(c) : undefined}
                            >
                                <td className="py-1.5 text-slate-200">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span className="truncate">{c.name}</span>
                                        <ProfessionIdentity profession={c.profession} size="sm" className="shrink-0" />
                                    </span>
                                    {!c.contributorHasAddon && (
                                        <span
                                            className="ml-1.5 text-[10px] text-slate-600"
                                            title="This healer did not run the addon themselves. This figure is still accurate — your own client observed it — but their own outgoing total elsewhere is only a lower bound."
                                        >
                                            °
                                        </span>
                                    )}
                                </td>
                                <td className="py-1.5 text-right text-emerald-400">{fmtCompact(c.healing)}</td>
                                <td className="py-1.5 text-right text-slate-500">{(c.share * 100).toFixed(1)}%</td>
                            </tr>
                        ))}
                        {breakdown.unattributed > 0 && (
                            <tr>
                                <td
                                    className="py-1.5 text-slate-400"
                                    title="Healing that could not be traced to a named player — minions, pets and allied NPCs occupy ally slots that carry no identifier. Never redistributed across known players."
                                >
                                    Other <span className="ml-1 text-[10px] text-slate-600">minions / NPCs</span>
                                </td>
                                <td className="py-1.5 text-right text-slate-400">{fmtCompact(breakdown.unattributed)}</td>
                                <td className="py-1.5 text-right text-slate-600">
                                    {breakdown.healed > 0 ? ((breakdown.unattributed / breakdown.healed) * 100).toFixed(1) : '0.0'}%
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            ) : (
                <div className="mt-3 rounded border border-slate-800/50 bg-slate-900/40 p-3">
                    <div className="text-xs font-semibold text-slate-400">Contributor attribution unavailable</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {breakdown.attributionNote ??
                            'The ally index could not be reconciled for this log, so per-contributor healing is not shown. The total above remains valid.'}
                    </div>
                </div>
            )}

            {hidden > 0 && (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="mt-2 text-[11px] text-slate-500 hover:text-slate-300"
                >
                    Show {hidden} more
                </button>
            )}

            <ProvenanceDrawer breakdown={breakdown} />
        </div>
    );
}

/**
 * Data provenance — where every number on this panel came from.
 *
 * Collapsed by default. This becomes essential once Entropy merges EI, Healing
 * Stats, native EVTC, and dps.report into one view: without it, a
 * combined figure is unauditable. Each check states what was verified rather than
 * asserting a vague quality score.
 */
function ProvenanceDrawer({ breakdown }: { breakdown: IncomingHealingBreakdown }) {
    const [open, setOpen] = useState(false);

    const checks: { ok: 'pass' | 'warn' | 'fail'; text: string }[] = [];

    if (breakdown.attributionConfidence === 'high') {
        checks.push({ ok: 'pass', text: 'Contributor columns reconciled exactly against EI incoming healing' });
        checks.push({ ok: 'pass', text: 'Source/target ally mapping validated' });
    } else if (breakdown.attributionConfidence === 'medium') {
        checks.push({ ok: 'warn', text: 'No incomingHealing field in this log — split could not be independently reconciled' });
        checks.push({ ok: 'pass', text: 'Row invariant holds: no healer exceeds their own recorded total' });
    } else if (breakdown.attributionConfidence === 'none') {
        checks.push({ ok: 'fail', text: breakdown.attributionNote ?? 'Attribution could not be reconciled' });
    }

    if (breakdown.coverage === 'partial') {
        checks.push({ ok: 'warn', text: 'Receiver did not run the healing addon — total is a lower bound' });
    } else if (breakdown.coverage === 'full') {
        checks.push({ ok: 'pass', text: 'Receiver ran the healing addon — incoming total is complete' });
    } else {
        checks.push({ ok: 'warn', text: 'No healing observed and no addon — total is unknown, not zero' });
    }

    if (breakdown.unattributed > 0) {
        checks.push({ ok: 'warn', text: 'Some healing came from minions/NPCs and is not attributable to a player' });
    }
    if (breakdown.contributors.some((c) => !c.contributorHasAddon)) {
        checks.push({
            ok: 'warn',
            text: 'Some contributors did not run the addon — figures here are accurate, but their own outgoing totals are incomplete',
        });
    }

    const MARK = { pass: '✓', warn: '⚠', fail: '✕' } as const;
    const TONE = { pass: 'text-emerald-500', warn: 'text-amber-500', fail: 'text-red-400' } as const;

    const rows: [string, string][] = [
        ['Coverage', breakdown.coverage],
        ['Attribution', breakdown.attributionConfidence],
        ['Source', breakdown.attributionSource],
        ['Contributors', String(breakdown.contributors.length)],
        ['Unattributed', breakdown.unattributed.toLocaleString()],
        ['Life siphon', breakdown.conversionHealed.toLocaleString()],
        ['Downed healing', breakdown.downedHealed.toLocaleString()],
        ['Barrier', breakdown.barrier.toLocaleString()],
    ];

    return (
        <div className="mt-3 border-t border-slate-800/50 pt-2">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-[10px] uppercase tracking-wider text-slate-600 hover:text-slate-400"
            >
                {open ? '▾' : '▸'} Data provenance
            </button>
            {open && (
                <div className="mt-2 space-y-2 rounded bg-slate-900/50 p-2.5">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                        {rows.map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                                <dt className="text-slate-600">{k}</dt>
                                <dd className="text-slate-300">{v}</dd>
                            </div>
                        ))}
                    </dl>
                    <ul className="space-y-1 text-[11px] leading-relaxed">
                        {checks.map((c, i) => (
                            <li key={i} className="flex gap-1.5">
                                <span className={TONE[c.ok]}>{MARK[c.ok]}</span>
                                <span className="text-slate-500">{c.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
