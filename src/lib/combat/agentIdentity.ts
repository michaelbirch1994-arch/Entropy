/**
 * Stable identity keys for CombatEvent agents.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS SEPARATELY FROM `eventIdentity()`
 * ---------------------------------------------------------------------------
 * `eventIdentity()` in CombatEvent.ts answers "is this the same EVENT",
 * for cross-source deduplication, and its tests pin that exact behavior
 * (`account ?? name`) — it is not touched here.
 *
 * This module answers a different question: "is this the same AGENT", for
 * grouping events by player/NPC across a whole fight (e.g. "everything that
 * happened to this player"). The two questions look similar but have
 * different failure modes:
 *
 *  - Two different players can share a display name (character names are not
 *    unique; account names are). Grouping by name alone would merge them.
 *  - NPCs, minions, pets and gadgets never have an account. Grouping them by
 *    name alone is usually correct (there is no better key) but they must
 *    never be merged into a player's identity just because a minion happens
 *    to share a name with something else in the fight.
 *  - Some agents resolve to neither — anonymous enemies, off-squad allies
 *    without an account. These must remain distinguishable from each other
 *    rather than collapsing into one "unknown" bucket.
 *
 * Reuses `CombatAgent.kind` (already populated by every existing normalizer)
 * rather than re-deriving player/NPC/minion classification.
 */

import type { CombatAgent } from './CombatEvent';

export type AgentIdentityKey = string;

/**
 * Build a stable grouping key for an agent.
 *
 * - Players WITH an account: keyed by account. This is the only case where
 *   two different `CombatAgent` objects (e.g. a character swap mid-raid, or
 *   the same event reaching us from two sources with slightly different
 *   `name` casing) should collapse to the same identity.
 * - Players WITHOUT an account (older logs, or a source that never
 *   populated it): keyed by `player:<name>`, since account is the only
 *   thing that would let two players collide and it is absent.
 * - Non-player agents (minion/npc/gadget/unknown): keyed by
 *   `<kind>:<name>:<playerIndex ?? '-'>`. The playerIndex suffix keeps two
 *   same-named NPCs (e.g. two "Veteran Warg" spawns) distinguishable when
 *   the source data can tell them apart, without inventing a distinction
 *   the source doesn't support when it can't.
 */
export function resolveAgentIdentityKey(agent: CombatAgent | undefined): AgentIdentityKey {
  if (!agent) return 'unknown:-';
  if (agent.kind === 'player') {
    if (agent.account) return `player:${agent.account}`;
    return `player-unverified:${agent.name}`;
  }
  return `${agent.kind}:${agent.name}:${agent.playerIndex ?? '-'}`;
}

/** True when two agents resolve to the same identity, per the rules above. */
export function sameAgent(a: CombatAgent | undefined, b: CombatAgent | undefined): boolean {
  return resolveAgentIdentityKey(a) === resolveAgentIdentityKey(b);
}

/** Human-readable label for an agent identity key, for debug/inspection output. */
export function describeAgent(agent: CombatAgent | undefined): string {
  if (!agent) return 'Unknown';
  const suffix = agent.kind === 'player' ? '' : ` (${agent.kind})`;
  return `${agent.name}${suffix}`;
}
