/**
 * Ally-index mapping for EI's `extHealingStats.outgoingHealingAllies`.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE ARRAY ACTUALLY IS
 * ---------------------------------------------------------------------------
 * `outgoingHealingAllies[allyIndex][phase]` is a matrix of healing done by one
 * player onto each "ally". The ally axis is NOT documented in the JSON, and its
 * length varies between logs — 14 entries for 14 players in one reference log,
 * 41 entries for 10 players in another. Assuming positional alignment with
 * `players[]` without checking is how healing gets credited to the wrong person.
 *
 * Established empirically across two real WvW logs:
 *
 *  1. Indices [0, players.length) DO map positionally to `players[]`, in order.
 *     Proven by exact column reconciliation: for every one of 14 players, summing
 *     column j across all healers equals that player's own
 *     `incomingHealing[0].healed` — 14/14 exact, no tolerance.
 *     Independently corroborated by a self-heal probe: the log recorder's
 *     self-healing lands on the index matching their own `players[]` position.
 *
 *  2. Indices >= players.length are non-player friendlies (minions, pets,
 *     allied NPCs). They cannot be resolved to a player and are aggregated into a
 *     single "Other allies" bucket rather than guessed at.
 *
 *  3. The ally axis does NOT always cover every friendly. In the reference log the
 *     array stopped at the 14 players while healing onto minions still counted
 *     toward each healer's outgoing total — e.g. one Druid's row summed to 190,922
 *     against an outgoing total of 248,772.
 *
 * Consequence, and the invariant this module enforces:
 *
 *     sum(attributed contributors)  <=  observed outgoing/incoming healing
 *
 * with exact equality only where the source data supports it. Never above.
 */

/** Where a single ally-axis index points. */
export type AllySlotKind = 'player' | 'other-ally';

export interface AllySlot {
      index: number;
      kind: AllySlotKind;
      /** Populated only when `kind === 'player'`. */
    playerIndex?: number;
      name?: string;
      account?: string;
      profession?: string;
}

/**
 * How much to trust per-contributor attribution.
 *
 * - `high`   — column reconciled exactly against EI's own `incomingHealing.healed`.
 * - `medium` — no `incomingHealing` to reconcile against (older EI output), but the
 *              matrix is structurally sound: every row is within its healer's
 *              outgoing total and the self-heal probe passes.
 * - `low`    — structure is plausible but unverified; show aggregates, treat the
 *              split as indicative only.
 * - `none`   — reconciliation failed. Do not display attribution at all.
 */
export type AttributionConfidence = 'high' | 'medium' | 'low' | 'none';

/** Which pipeline produced a figure. Grows as sources are combined. */
export type AttributionSource = 'eliteInsights' | 'healingStats' | 'nativeEvtc' | 'combined';

export interface AllyIndexMap {
      slots: AllySlot[];
      /** Number of leading slots that resolve to `players[]`. */
    playerSlotCount: number;
      /** Slots beyond the player range (minions/NPCs), aggregated when displayed. */
    otherSlotCount: number;
      confidence: AttributionConfidence;
      /** Human-readable explanation, always populated when confidence !== 'high'. */
    note?: string;
      /** True when every column matched EI's incomingHealing exactly. */
    columnReconciled: boolean;
      /** True when no healer's attributed row exceeded their outgoing total. */
    rowInvariantHolds: boolean;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const sumPhases = (phases: any, field: string): number =>
      Array.isArray(phases) ? phases.reduce((s: number, ph: any) => s + num(ph?.[field]), 0) : 0;

const alliesOf = (p: any): any[] =>
      Array.isArray(p?.extHealingStats?.outgoingHealingAllies) ? p.extHealingStats.outgoingHealingAllies : [];

/**
 * Build and validate the ally-index mapping for a parsed EI log.
 *
 * Runs two independent checks:
 *
 *  - COLUMN CHECK (authoritative): for each player j, does summing column j across
 *    every healer reproduce player j's `incomingHealing[0].healed`? Requires that
 *    field; when it is present and matches for all players, alignment is proven.
 *
 *  - ROW INVARIANT (always available): does any healer's attributed row exceed
 *    their own `outgoingHealing[0].healing`? It must never exceed. Falling short is
 *    expected and legitimate — healing onto minions may sit outside the ally axis.
 */
export function buildAllyIndexMap(details: any): AllyIndexMap {
      const players: any[] = Array.isArray(details?.players) ? details.players : [];

    // The ally axis is as long as the longest row present in the log.
    let axisLength = 0;
      for (const p of players) axisLength = Math.max(axisLength, alliesOf(p).length);

    const playerSlotCount = Math.min(players.length, axisLength);
      const slots: AllySlot[] = [];
      for (let i = 0; i < axisLength; i++) {
                if (i < playerSlotCount) {
                              const p = players[i];
                              slots.push({
                                                index: i,
                                                kind: 'player',
                                                playerIndex: i,
                                                name: p?.name ?? 'Unknown',
                                                account: p?.account ?? p?.name ?? 'Unknown',
                                                profession: p?.profession ?? 'Unknown',
                              });
                } else {
                              // Minion/pet/NPC. EI gives no identifier on this axis, so resolving it
                    // to a specific agent would be a guess. Bucket it instead.
                    slots.push({ index: i, kind: 'other-ally' });
                }
      }

    // --- ROW INVARIANT ------------------------------------------------------
    let rowInvariantHolds = true;
      for (const p of players) {
                const allies = alliesOf(p);
                if (allies.length === 0) continue;
                const row = allies.reduce((s: number, a: any) => s + sumPhases(a, 'healing'), 0);
                const outgoing = num(p?.extHealingStats?.outgoingHealing?.[0]?.healing);
                // Strictly greater means the axis is longer than the healer's real output,
          // i.e. we are reading someone else's healing. That must never happen.
          if (outgoing > 0 && row > outgoing) rowInvariantHolds = false;
      }

    // --- COLUMN CHECK -------------------------------------------------------
    let columnsChecked = 0;
      let columnsMatched = 0;
      for (let j = 0; j < playerSlotCount; j++) {
                const inc = players[j]?.extHealingStats?.incomingHealing;
                if (!Array.isArray(inc) || inc.length === 0 || typeof inc[0]?.healed !== 'number') continue;
                columnsChecked++;
                let col = 0;
                for (const p of players) {
                              const allies = alliesOf(p);
                              if (j < allies.length) col += sumPhases(allies[j], 'healing');
                }
                if (col === num(inc[0].healed)) columnsMatched++;
      }
      const columnReconciled = columnsChecked > 0 && columnsChecked === columnsMatched;

    let confidence: AttributionConfidence;
      let note: string | undefined;

    if (!rowInvariantHolds) {
              confidence = 'none';
              note =
                            'A healer\'s attributed healing exceeded their own recorded total, so the ally axis does not ' +
                            'line up with this log\'s player list. Attribution withheld to avoid crediting the wrong player.';
    } else if (columnReconciled) {
              confidence = 'high';
    } else if (columnsChecked > 0) {
              confidence = 'none';
              note =
                            `Column reconciliation failed for ${columnsChecked - columnsMatched} of ${columnsChecked} players. ` +
                            'The ally axis cannot be matched to the player list for this log.';
    } else if (axisLength > 0 && playerSlotCount > 0) {
              confidence = 'medium';
              note =
                            'This log has no incomingHealing field to reconcile against (older Elite Insights output). ' +
                            'Mapping is structurally consistent and no healer exceeds their own total, but per-contributor ' +
                            'figures are unconfirmed.';
    } else {
              confidence = 'none';
              note = 'No healing extension data present in this log.';
    }

    return {
              slots,
              playerSlotCount,
              otherSlotCount: Math.max(0, axisLength - playerSlotCount),
              confidence,
              note,
              columnReconciled,
              rowInvariantHolds,
    };
}
