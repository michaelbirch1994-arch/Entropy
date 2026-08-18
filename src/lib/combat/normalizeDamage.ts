/**
 * Adapter: raw per-second incoming-damage arrays -> timestamped CombatEvents.
 *
 * ---------------------------------------------------------------------------
 * SCOPE -- read before extending this file
 * ---------------------------------------------------------------------------
 * This produces events for damage TAKEN BY squad players, not damage dealt
 * to the enemy. That is a deliberate choice, not an oversight:
 *
 *  - The report's player list only carries squad + squad-adjacent allies
 *    (see squadOf() below, same shape as its twin in normalizeDeaths.ts).
 *    There is no enemy player roster or enemy damage-output data anywhere
 *    in the ingestion pipeline today (EI's `targets` array is empty for
 *    WvW logs, and FightInput.players never includes non-allied agents).
 *  - The one per-second timing field that exists on OUR players --
 *    `damageTaken1S` -- already answers the question the original "Enemy
 *    Spike" detector needs: when did the squad take a burst of incoming
 *    damage. So this file normalizes damageTaken1S, and any spike detector
 *    built on top of it (after this file is proven by tests) should be
 *    framed as "squad took a damage spike", not "enemy Player X spiked" --
 *    we cannot identify which enemy dealt it.
 *  - `damageTaken1S` (and its sibling `damage1S`, already consumed by
 *    computeDpsGraph in buildReportFromFights.ts) is confirmed present when
 *    a report is fetched via the dps.report hosted API, and confirmed
 *    ABSENT on raw local Elite Insights JSON exports -- verified against
 *    src/lib/__tests__/fixtures/wvw-modern-ei.json, where no player object
 *    has any `*1S` field, only phase-aggregate totalDamageDist/dpsAll with
 *    no timing. Per the project's standing rule (never fabricate precision
 *    the source doesn't support), this normalizer returns
 *    confidence: 'none' and zero events whenever no squad player has a
 *    populated damageTaken1S[0] array, rather than inventing per-second
 *    timing from an aggregate total.
 *  - The identity of who dealt the damage is not resolvable from this
 *    field -- arcdps/EI does not attribute a player's incoming damage to a
 *    specific enemy actor in this series. `source` is therefore always an
 *    explicit `side: 'enemy'`, `kind: 'unknown'` placeholder agent, never a
 *    guessed name.
 *  - `damageTaken1S[phase]` is only read at phase 0. WvW logs in this
 *    codebase have a single "Detailed Full Fight" phase (confirmed on the
 *    real fixture: 1 phase covering the whole encounter) -- there is no
 *    boss-style sub-phase split to preserve here.
 */

import type { ParsedReport } from '../bridge-metrics/positioning';
import type { CombatAgent, CombatEvent, CombatEventSet } from './CombatEvent';

const UNKNOWN_ENEMY: CombatAgent = {
  name: 'Unidentified enemy',
  kind: 'unknown',
  side: 'enemy',
};

function agentOf(p: any, playerIndex?: number): CombatAgent {
  return {
    name: p?.name ?? 'Unknown',
    account: p?.account ?? undefined,
    profession: p?.profession ?? undefined,
    kind: 'player',
    side: 'friendly',
    playerIndex,
  };
}

const squadOf = (r: ParsedReport): any[] =>
  ((r as any).details?.players ?? []).filter((p: any) => !p?.notInSquad);

/**
 * Build damage-taken CombatEvents for one log.
 *
 * Requires `damageTaken1S` on at least one squad player: a per-phase,
 * per-second array of *cumulative* incoming damage, read straight from the
 * source data. See the file header for when this is and isn't populated.
 */
export function normalizeDamageTakenEvents(report: ParsedReport): CombatEventSet {
  const squad = squadOf(report);
  const events: CombatEvent[] = [];
  let anyData = false;

  squad.forEach((player: any, index: number) => {
    const series = (player?.damageTaken1S ?? []) as number[][];
    const phase0 = Array.isArray(series) ? series[0] : undefined;
    if (!Array.isArray(phase0) || phase0.length === 0) return;

    anyData = true;
    const target = agentOf(player, index);

    let last = 0;
    for (let second = 0; second < phase0.length; second++) {
      const cumulative = Number(phase0[second]) || 0;
      const delta = cumulative - last;
      last = cumulative;
      if (delta <= 0) continue;

      events.push({
        timestampMs: second * 1000,
        source: UNKNOWN_ENEMY,
        target,
        category: 'damage',
        // damageTaken1S mixes power + condition damage with no breakdown --
        // labeling this 'strike' or 'conditionTick' would fabricate a
        // distinction the source doesn't support. See damageTaxonomy.ts.
        subcategory: 'unknown',
        amount: delta,
        hits: 1,
        origin: 'dpsReport',
        confidence: 'medium',
        coverage: 'full',
        metadata: { secondIndex: second, phase: 0 },
      });
    }
  });

  if (!anyData) {
    return {
      events: [],
      origin: 'dpsReport',
      confidence: 'none',
      note:
        'This log has no per-second incoming-damage timing (damageTaken1S). ' +
        'That field is only populated for reports fetched via the dps.report ' +
        'hosted API; raw local Elite Insights JSON exports do not include it, ' +
        'so incoming-damage timing is unavailable for this log.',
      unattributed: 0,
    };
  }

  return {
    events,
    origin: 'dpsReport',
    confidence: 'medium',
    unattributed: 0,
  };
}

export const damageTakenEvents = (set: CombatEventSet): CombatEvent[] =>
  set.events.filter((e) => e.category === 'damage');
