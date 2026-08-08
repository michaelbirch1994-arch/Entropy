/**
 * Data integrity report — what Entropy actually knows, and how well.
 *
 * As Entropy starts combining sources (EI JSON, native EVTC, healing addon
 * extension events) it becomes easy to present a confident number built on a
 * shaky foundation. This module exists to make the foundation inspectable: every
 * metric reports a status, and statuses that are not `available` carry a reason.
 *
 * Nothing here estimates or interpolates. If a status reads UNVERIFIED it means a
 * specific validation has not been performed yet, not that the number is probably
 * fine.
 */

import { getHealAddonPlayers } from './incomingHealing';

export type IntegrityStatus =
      /** Measured from the log, complete for the stated scope. */
    | 'available'
    /** Measured, but known to be a lower bound or to cover only some players. */
    | 'partial'
    /** Read from the log using an inference that has not been validated yet. */
    | 'unverified'
    /** Not present in any layer of the pipeline; cannot be recovered. */
    | 'not-available'
    /** Implemented but switched off. */
    | 'not-enabled';

export interface IntegrityLine {
      metric: string;
      status: IntegrityStatus;
      /** Rendered next to the status when present. */
    detail?: string;
      /** Why the status is not `available`. */
    reason?: string;
}

export interface HealingIntegrityReport {
      players: number;
      healAddonUsers: number;
      fullCoverage: number;
      partialCoverage: number;
      noCoverage: number;
      /** Observed life-siphon (conversion) healing across the squad. */
    lifeSiphonHealing: number;
      lines: IntegrityLine[];
      /** Addon name/version as recorded in the log, when present. */
    extension?: { name: string; version: string };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const sumPhases = (phases: any, field: string): number =>
      Array.isArray(phases) ? phases.reduce((s, ph) => s + num(ph?.[field]), 0) : 0;

/**
 * Build the integrity report for a single parsed EI log.
 *
 * @param opts.nativeEvtcEnabled whether the native EVTC parser contributed to this
 *   report. Off by default — it is a secondary recovery path, not a replacement
 *   for Elite Insights.
 */
export function computeHealingIntegrity(
      details: any,
      opts: { nativeEvtcEnabled?: boolean } = {},
  ): HealingIntegrityReport {
      const players: any[] = Array.isArray(details?.players) ? details.players : [];
      const squad = players.filter((p) => !p?.notInSquad);
      const addon = getHealAddonPlayers(details);

    let full = 0;
      let partial = 0;
      let none = 0;
      let lifeSiphon = 0;
      let anyIncoming = 0;

    for (const p of squad) {
              const allies = p?.extHealingStats?.outgoingHealingAllies;
              let healing = 0;
              if (Array.isArray(allies)) {
                            for (const ally of allies) {
                                              healing += sumPhases(ally, 'healing');
                                              lifeSiphon += sumPhases(ally, 'conversionHealing');
                            }
              }
              const hasAddon = typeof p?.name === 'string' && addon.has(p.name);
              if (hasAddon) full++;
              else if (healing > 0) partial++;
              else none++;

          const inc = Array.isArray(p?.extHealingStats?.incomingHealing)
                  ? p.extHealingStats.incomingHealing[0]
                        : null;
              anyIncoming += num(inc?.healed);
    }

    const ext = (Array.isArray(details?.usedExtensions) ? details.usedExtensions : []).find(
              (e: any) => e?.name === 'Healing Stats',
          );

    const lines: IntegrityLine[] = [
      {
                    metric: 'Outgoing healing',
                    status: full === squad.length ? 'available' : 'partial',
                    detail: `${full}/${squad.length} players fully covered`,
                    reason:
                                      full === squad.length
                            ? undefined
                                          : 'Guild Wars 2 only reports healing to the healing player\'s own client, so players ' +
                                            'without the addon show a lower bound rather than a total.',
      },
      {
                    metric: 'Life siphon healing',
                    status: full > 0 ? 'available' : 'not-available',
                    detail: `${lifeSiphon.toLocaleString()} observed`,
                    reason:
                                      full > 0
                            ? undefined
                                          : 'No player in this log ran the healing addon, so no healing classification exists.',
      },
      {
                    metric: 'Incoming healing',
                    // Complete per-receiver whenever that receiver ran the addon (mirror rule).
                    status: anyIncoming > 0 ? (full === squad.length ? 'available' : 'partial') : 'not-available',
                    detail: `${full}/${squad.length} receivers fully covered`,
                    reason:
                                      full === squad.length
                            ? undefined
                                          : 'Incoming healing is complete only for players who ran the addon themselves.',
      },
      {
                    metric: 'Barrier (applied)',
                    status: 'unverified',
                    reason:
                                      'Barrier amounts are read from the healing extension events on the assumption that ' +
                                      'overstack_value carries the barrier portion, mirroring arcdps\'s own damage-side ' +
                                      'convention. Event counts match exactly (848/848) but this has NOT been validated ' +
                                      'against a reference parse. Do not treat barrier totals as confirmed.',
      },
      {
                    metric: 'Barrier (absorbed, damage side)',
                    status: 'available',
                    reason: undefined,
                    detail: 'arcdps shieldDamage — spec-confirmed',
      },
      {
                    metric: 'Overheal',
                    status: 'not-available',
                    reason:
                                      'Not tracked by arcdps_healing_stats at any layer — the addon author lists overheal ' +
                                      'tracking as an unimplemented planned feature. No overheal or healing-efficiency ' +
                                      'metric can be derived.',
      },
      {
                    metric: 'Life siphon damage',
                    status: 'not-available',
                    reason:
                                      'Life-steal damage is logged as ordinary strike damage with no distinguishing flag. ' +
                                      'Two candidate inference methods were tested and both produced heavy false positives.',
      },
      {
                    metric: 'Native EVTC parsing',
                    status: opts.nativeEvtcEnabled ? 'available' : 'not-enabled',
                    reason: opts.nativeEvtcEnabled
                        ? undefined
                                      : 'Secondary raw-event parser is present but disabled. Elite Insights remains the ' +
                                        'primary source; native parsing is for recovering data EI does not expose.',
      },
          ];

    return {
              players: squad.length,
              healAddonUsers: addon.size,
              fullCoverage: full,
              partialCoverage: partial,
              noCoverage: none,
              lifeSiphonHealing: lifeSiphon,
              lines,
              extension: ext ? { name: ext.name, version: String(ext.version ?? '?') } : undefined,
    };
}

const STATUS_LABEL: Record<IntegrityStatus, string> = {
      available: 'AVAILABLE',
      partial: 'PARTIAL',
      unverified: 'UNVERIFIED',
      'not-available': 'NOT AVAILABLE',
      'not-enabled': 'NOT YET ENABLED',
};

/** Plain-text rendering for dev tooling / console / bug reports. */
export function formatHealingIntegrity(r: HealingIntegrityReport): string {
      const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
      const out: string[] = ['HEALING DATA INTEGRITY', ''];
      out.push(`${pad('Players:', 24)}${r.players}`);
      out.push(`${pad('Healing addon users:', 24)}${r.healAddonUsers}`);
      out.push(`${pad('Full coverage:', 24)}${r.fullCoverage}`);
      out.push(`${pad('Partial coverage:', 24)}${r.partialCoverage}`);
      out.push(`${pad('No coverage:', 24)}${r.noCoverage}`);
      if (r.extension) out.push(`${pad('Extension:', 24)}${r.extension.name} ${r.extension.version}`);
      out.push('');
      for (const l of r.lines) {
                out.push(`${pad(l.metric + ':', 34)}${STATUS_LABEL[l.status]}${l.detail ? `  (${l.detail})` : ''}`);
                if (l.reason) out.push(`  ${l.reason}`);
      }
      return out.join('\n');
}
