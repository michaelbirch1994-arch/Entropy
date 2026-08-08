/**
 * Incoming healing — "who kept this player alive?"
 *
 * Elite Insights gives per-player *outgoing* healing broken down by ally
 * (`extHealingStats.outgoingHealingAllies[allyIndex][phase]`). Transposing that
 * matrix yields, for any chosen player, who healed them and how much.
 *
 * The ally axis is undocumented and its length varies between logs, so the
 * transpose is only performed against a validated mapping — see allyIndex.ts.
 * Where that mapping cannot be proven, the aggregate totals are still reported but
 * the per-contributor split is withheld rather than guessed.
 *
 * ---------------------------------------------------------------------------
 * COVERAGE: THE MIRROR RULE
 * ---------------------------------------------------------------------------
 * Outgoing and incoming healing have *opposite* coverage conditions, because the
 * game reports a heal to both participants' clients but arcdps_healing_stats only
 * records what the local client saw:
 *
 *   outgoing healing is complete  <=>  the SOURCE player ran the addon
 *   incoming healing is complete  <=>  the TARGET player ran the addon
 *
 * Confirmed with no exceptions across all 14 players in the reference log: every
 * receiver *without* the addon showed exactly 0 healing from sources that also
 * lacked it, while every receiver *with* the addon showed a mixture.
 *
 * The practical upshot is worth stating plainly: incoming healing is often the
 * BETTER-covered metric. A player running the addon sees every heal landing on
 * them, including heals from teammates who run nothing — in the reference log the
 * single largest contributor to one player's survival was a non-addon Tempest
 * whose own outgoing total was, separately, only a lower bound.
 */

import type { HealingCoverage } from '../../types/report';
import { classifyHealingSkill, type HealingScaling } from './damageTaxonomy';
import {
      buildAllyIndexMap,
      type AllyIndexMap,
      type AttributionConfidence,
      type AttributionSource,
} from './allyIndex';

export interface HealingContributor {
      /** Character name as it appears in the log. */
    name: string;
      account: string;
      profession: string;
      healing: number;
      /** Share of this player's total observed incoming healing, 0..1. */
    share: number;
      /**
       * Whether the *contributor* ran the addon. Does not affect the accuracy of
       * this number — the receiver's client observed it either way — but it tells
       * you whether that contributor's own outgoing total elsewhere is trustworthy.
       */
    contributorHasAddon: boolean;
}

export interface HealingSource {
      skillId: number;
      name: string;
      healing: number;
      hits: number;
      scaling: HealingScaling;
}

export interface IncomingHealingBreakdown {
      player: string;
      account: string;
      /** Total observed incoming healing. */
    healed: number;
      healingPowerHealed: number;
      /** Life-siphon-style healing received (does not scale with Healing Power). */
    conversionHealed: number;
      hybridHealed: number;
      /** Healing received while downed. */
    downedHealed: number;
      barrier: number;
      coverage: HealingCoverage;
      /**
       * Sorted descending by healing. EMPTY when per-source attribution could not be
       * verified — check `contributorsAvailable` before rendering "who healed me",
       * and show the aggregate totals only in that case.
       */
    contributors: HealingContributor[];
      /**
       * False when the ally-index reconciliation failed, meaning EI's ally ordering
       * could not be matched to `players[]` for this log. Aggregate totals above
       * remain valid; only the per-contributor split is withheld.
       */
    contributorsAvailable: boolean;
      /** How far to trust the per-contributor split. See AttributionConfidence. */
    attributionConfidence: AttributionConfidence;
      /** Why confidence is not `high`. Safe to surface directly to the user. */
    attributionNote?: string;
      /** Which pipeline produced this attribution. */
    attributionSource: AttributionSource;
      /**
       * Observed healing not traceable to a named player — minions, pets and allied
       * NPCs occupy ally slots that carry no identifier. Render as "Other".
       */
    unattributed: number;
      /** Sorted descending by healing. */
    sources: HealingSource[];
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const sumPhases = (phases: any, field: string): number =>
      Array.isArray(phases) ? phases.reduce((s, ph) => s + num(ph?.[field]), 0) : 0;

/**
 * Build the incoming-healing breakdown for one player.
 *
 * @param targetIndex index into `players`, in EI's own ordering. Valid as an ally
 *   index only for the leading player slots, which `allyMap` verifies.
 * @param addonPlayers character names from `usedExtensions[].runningExtension`.
 */
export function computeIncomingHealing(
      players: any[],
      targetIndex: number,
      addonPlayers: Set<string>,
      skillMap?: Record<string, any>,
      buffMap?: Record<string, any>,
      /** Pass the log-level map to avoid rebuilding it per player. */
      allyMap?: AllyIndexMap,
  ): IncomingHealingBreakdown | null {
      const target = players?.[targetIndex];
      if (!target) return null;

    const ext = target.extHealingStats ?? {};
      const inc = Array.isArray(ext.incomingHealing) ? ext.incomingHealing[0] ?? {} : {};
      const barrierInc = Array.isArray(target.extBarrierStats?.incomingBarrier)
          ? target.extBarrierStats.incomingBarrier[0] ?? {}
                : {};

    // Transpose: walk every player's outgoing matrix and pull the column for us.
    const contributors: HealingContributor[] = [];
      for (const p of players) {
                const allies = p?.extHealingStats?.outgoingHealingAllies;
                if (!Array.isArray(allies) || targetIndex >= allies.length) continue;
                const healing = sumPhases(allies[targetIndex], 'healing');
                if (healing <= 0) continue;
                contributors.push({
                              name: p.name ?? 'Unknown',
                              account: p.account ?? p.name ?? 'Unknown',
                              profession: p.profession ?? 'Unknown',
                              healing,
                              share: 0,
                              contributorHasAddon: typeof p.name === 'string' && addonPlayers.has(p.name),
                });
      }

    const healed = num(inc.healed);
      const transposed = contributors.reduce((s, c) => s + c.healing, 0);

    // Attribution rests on the validated ally-index mapping, never on a bare
    // positional assumption. See allyIndex.ts for the proof and the failure modes.
    const map = allyMap ?? buildAllyIndexMap({ players });
      const trusted = map.confidence !== 'none';

    // INVARIANT: attributed contributors must never sum above the observed total.
    // Falling short is legitimate (healing onto minions can sit outside the ally
    // axis); exceeding it means we are reading someone else's healing.
    const observedTotal = healed > 0 ? healed : transposed;
      const withinInvariant = transposed <= observedTotal;
      const attributable = trusted && withinInvariant ? contributors : [];

    for (const c of attributable) c.share = observedTotal > 0 ? c.healing / observedTotal : 0;
      attributable.sort((a, b) => b.healing - a.healing);

    const unattributed = Math.max(0, observedTotal - transposed);

    const sources: HealingSource[] = (
              Array.isArray(ext.totalIncomingHealingDist) ? ext.totalIncomingHealingDist[0] ?? [] : []
          )
          .map((e: any) => ({
                        skillId: num(e?.id),
                        name:
                                          skillMap?.[`s${num(e?.id)}`]?.name ??
                                          buffMap?.[`b${num(e?.id)}`]?.name ??
                                          `Skill ${num(e?.id)}`,
                        healing: num(e?.totalHealing),
                        hits: num(e?.hits),
                        scaling: classifyHealingSkill(num(e?.id), skillMap, buffMap),
          }))
          .filter((s: HealingSource) => s.healing > 0)
          .sort((a: HealingSource, b: HealingSource) => b.healing - a.healing);

    const receiverHasAddon = typeof target.name === 'string' && addonPlayers.has(target.name);

    return {
              player: target.name ?? 'Unknown',
              account: target.account ?? target.name ?? 'Unknown',
              healed: observedTotal,
              healingPowerHealed: num(inc.healingPowerHealed),
              conversionHealed: num(inc.conversionHealed),
              hybridHealed: num(inc.hybridHealed),
              downedHealed: num(inc.downedHealed),
              barrier: num(barrierInc.barrier),
              // The mirror rule: it is the RECEIVER's addon that makes incoming healing
              // complete, not the healer's.
              coverage: receiverHasAddon ? 'full' : observedTotal > 0 ? 'partial' : 'none',
              contributors: attributable,
              contributorsAvailable: attributable.length > 0 || (trusted && withinInvariant),
              attributionConfidence: withinInvariant ? map.confidence : 'none',
              attributionNote: withinInvariant
                  ? map.note
                            : 'Attributed healing exceeded this player\'s observed incoming total; attribution withheld.',
              attributionSource: 'eliteInsights',
              /** Healing that could not be traced to a specific player (minions, allied NPCs). */
              unattributed,
              sources,
    };
}

/** Character names running the heal addon, from EI's `usedExtensions`. */
export function getHealAddonPlayers(details: any): Set<string> {
      const out = new Set<string>();
      const exts = Array.isArray(details?.usedExtensions) ? details.usedExtensions : [];
      for (const ext of exts) {
                if (ext?.name !== 'Healing Stats') continue;
                const running = Array.isArray(ext.runningExtension) ? ext.runningExtension : [];
                for (const n of running) if (typeof n === 'string' && n) out.add(n);
      }
      return out;
}

/** Convenience: breakdowns for every squad player in a log. */
export function computeAllIncomingHealing(details: any): IncomingHealingBreakdown[] {
      const players = Array.isArray(details?.players) ? details.players : [];
      const addon = getHealAddonPlayers(details);
      const allyMap = buildAllyIndexMap(details);
      const out: IncomingHealingBreakdown[] = [];
      players.forEach((p: any, i: number) => {
                if (p?.notInSquad) return;
                const bd = computeIncomingHealing(players, i, addon, details?.skillMap, details?.buffMap, allyMap);
                if (bd) out.push(bd);
      });
      return out.sort((a, b) => b.healed - a.healed);
}
