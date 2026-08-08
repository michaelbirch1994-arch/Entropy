/**
 * Normalizer: Elite Insights healing-extension data -> CombatEvent[].
 *
 * The first normalizer, deliberately. Healing is the pipeline whose provenance is
 * best understood — coverage rules, ally-index mapping, scaling classification and
 * confidence are all established and tested — so it sets the pattern the damage,
 * barrier and boon normalizers should follow.
 *
 * What this does NOT do: replace anything. Existing healing metrics keep running
 * off `bridge-metrics/`. This produces an equivalent event stream alongside them so
 * the two can be compared before anything migrates.
 */

import {
      buildAllyIndexMap,
      type AllyIndexMap,
} from '../bridge-metrics/allyIndex';
import { getHealAddonPlayers } from '../bridge-metrics/incomingHealing';
import { classifyHealingSkill } from '../bridge-metrics/damageTaxonomy';
import type {
      CombatAgent,
      CombatEvent,
      CombatEventSet,
      CombatSubcategory,
} from './CombatEvent';
import type { HealingCoverage } from '../../types/report';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const sumPhases = (phases: any, field: string): number =>
      Array.isArray(phases) ? phases.reduce((s: number, ph: any) => s + num(ph?.[field]), 0) : 0;

function agentOf(p: any, playerIndex?: number): CombatAgent {
      return {
                name: p?.name ?? 'Unknown',
                account: p?.account ?? undefined,
                profession: p?.profession ?? undefined,
                kind: 'player',
                playerIndex,
      };
}

/** Ally slots past the player range carry no identifier — never guess at them. */
const UNIDENTIFIED_ALLY: CombatAgent = { name: 'Other allies', kind: 'unknown' };

/**
 * Build healing CombatEvents for one log.
 *
 * Emits one event per (healer, target, scaling-bucket) triple. Events are phase
 * aggregates, so `timestampMs` is null rather than invented — EI's per-ally data
 * is not timestamped, and faking a timestamp would corrupt any later correlation
 * against deaths or damage spikes.
 */
export function normalizeHealingEvents(details: any): CombatEventSet {
      const players: any[] = Array.isArray(details?.players) ? details.players : [];
      const addon = getHealAddonPlayers(details);
      const map: AllyIndexMap = buildAllyIndexMap(details);
      const events: CombatEvent[] = [];
      let unattributed = 0;

    const coverageOf = (p: any): HealingCoverage => {
              if (typeof p?.name === 'string' && addon.has(p.name)) return 'full';
              return 'partial';
    };

    // Only the three scaling buckets are emitted; `healing` itself is their sum and
    // would double-count if included alongside them.
    const BUCKETS: { field: string; sub: CombatSubcategory }[] = [
      { field: 'healingPowerHealing', sub: 'healingPower' },
      { field: 'conversionHealing', sub: 'conversion' },
      { field: 'hybridHealing', sub: 'hybrid' },
          ];

    players.forEach((healer, healerIdx) => {
              const allies = healer?.extHealingStats?.outgoingHealingAllies;
              if (!Array.isArray(allies)) return;
              const source = agentOf(healer, healerIdx);
              const coverage = coverageOf(healer);

                            allies.forEach((allyPhases: any, allyIdx: number) => {
                                          const slot = map.slots[allyIdx];
                                          const isPlayerSlot = slot?.kind === 'player' && typeof slot.playerIndex === 'number';
                                          const target = isPlayerSlot
                                              ? agentOf(players[slot.playerIndex!], slot.playerIndex)
                                                            : UNIDENTIFIED_ALLY;

                                                       // Healing onto an unidentified ally slot is real but unattributable.
                                                       // Track the magnitude separately rather than crediting a player.
                                                       if (!isPlayerSlot) {
                                                                         unattributed += sumPhases(allyPhases, 'healing');
                                                                         return;
                                                       }

                                                       for (const { field, sub } of BUCKETS) {
                                                                         const amount = sumPhases(allyPhases, field);
                                                                         if (amount <= 0) continue;
                                                                         events.push({
                                                                                               timestampMs: null,
                                                                                               source,
                                                                                               target,
                                                                                               category: 'healing',
                                                                                               subcategory: sub,
                                                                                               amount,
                                                                                               hits: 1,
                                                                                               origin: 'healingStats',
                                                                                               confidence: map.confidence,
                                                                                               coverage,
                                                                         });
                                                       }

                                                       const downed = sumPhases(allyPhases, 'downedHealing');
                                          if (downed > 0) {
                                                            events.push({
                                                                                  timestampMs: null,
                                                                                  source,
                                                                                  target,
                                                                                  category: 'healing',
                                                                                  subcategory: 'downed',
                                                                                  amount: downed,
                                                                                  hits: 1,
                                                                                  origin: 'healingStats',
                                                                                  confidence: map.confidence,
                                                                                  coverage,
                                                                                  // Downed healing overlaps the scaling buckets rather than
                                                                                  // partitioning alongside them — it is the same healing, tagged.
                                                                                  metadata: { overlapsScalingBuckets: true },
                                                            });
                                          }
                            });

                            // A healer's own recorded total can EXCEED everything on the ally axis:
                            // in one reference log 96,907 healing onto minions/pets was counted toward
                            // outgoing totals while never appearing as an ally slot at all. Without
                            // this, the event stream silently under-reports that healing rather than
                            // declaring it unattributable.
                            const axisRow = allies.reduce((s: number, a: any) => s + sumPhases(a, 'healing'), 0);
              const recordedTotal = num(healer?.extHealingStats?.outgoingHealing?.[0]?.healing);
              if (recordedTotal > axisRow) unattributed += recordedTotal - axisRow;

                            // Barrier rides the same extension stream but its amount semantics on the
                            // raw event are still unverified. The EI-derived figure is used here; the
                            // raw overstack_value reading is NOT.
                            const barrierAllies = healer?.extBarrierStats?.outgoingBarrierAllies;
              if (Array.isArray(barrierAllies)) {
                            barrierAllies.forEach((allyPhases: any, allyIdx: number) => {
                                              const slot = map.slots[allyIdx];
                                              if (slot?.kind !== 'player' || typeof slot.playerIndex !== 'number') return;
                                              const amount = sumPhases(allyPhases, 'barrier');
                                              if (amount <= 0) return;
                                              events.push({
                                                                    timestampMs: null,
                                                                    source,
                                                                    target: agentOf(players[slot.playerIndex], slot.playerIndex),
                                                                    category: 'barrier',
                                                                    subcategory: 'barrierApplied',
                                                                    amount,
                                                                    hits: 1,
                                                                    origin: 'healingStats',
                                                                    confidence: map.confidence,
                                                                    coverage,
                                              });
                            });
              }
    });

    // Per-skill outgoing healing, kept as separate events with skill identity. These
    // intentionally duplicate the per-ally totals along a different axis, so they
    // carry a marker and must not be summed together with them.
    players.forEach((healer, healerIdx) => {
              const dist = healer?.extHealingStats?.totalHealingDist;
              const rows = Array.isArray(dist) ? dist[0] ?? [] : [];
              if (!Array.isArray(rows) || rows.length === 0) return;
              const source = agentOf(healer, healerIdx);
              const coverage = coverageOf(healer);
              for (const row of rows) {
                            const amount = num(row?.totalHealing);
                            if (amount <= 0) continue;
                            const skillId = num(row?.id);
                            const scaling = classifyHealingSkill(skillId, details?.skillMap, details?.buffMap);
                            events.push({
                                              timestampMs: null,
                                              source,
                                              category: 'healing',
                                              subcategory: scaling === 'unknown' ? 'unknown' : (scaling as CombatSubcategory),
                                              amount,
                                              hits: num(row?.hits) || 1,
                                              skillId,
                                              skillName:
                                                                    details?.skillMap?.[`s${skillId}`]?.name ??
                                                                    details?.buffMap?.[`b${skillId}`]?.name,
                                              origin: 'healingStats',
                                              confidence: map.confidence,
                                              coverage,
                                              metadata: {
                                                                    // Same healing as the per-ally events, sliced by skill instead of
                                                  // by target. Summing both axes together double-counts.
                                                  axis: 'perSkill',
                                                                    indirectHealing: row?.indirectHealing === true,
                                              },
                            });
              }
    });

    return {
              events,
              origin: 'healingStats',
              confidence: map.confidence,
              note: map.note,
              unattributed,
    };
}

/** Per-target healing events only (excludes the per-skill axis) — safe to sum. */
export const perTargetEvents = (set: CombatEventSet): CombatEvent[] =>
      set.events.filter((e) => e.category === 'healing' && e.metadata?.axis !== 'perSkill' && e.subcategory !== 'downed');

/** Per-skill healing events only — safe to sum. */
export const perSkillEvents = (set: CombatEventSet): CombatEvent[] =>
      set.events.filter((e) => e.metadata?.axis === 'perSkill');
