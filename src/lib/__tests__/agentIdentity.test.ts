import { describe, it, expect } from 'vitest';
import { resolveAgentIdentityKey, sameAgent, describeAgent } from '../combat/agentIdentity';
import type { CombatAgent } from '../combat/CombatEvent';

describe('resolveAgentIdentityKey', () => {
  it('keys players by account, not display name', () => {
    const a: CombatAgent = { name: 'Bob', account: 'Bob.1234', kind: 'player' };
    const b: CombatAgent = { name: 'Bob', account: 'Bob.5678', kind: 'player' };
    // Same display name, different accounts -> must NOT collide.
    expect(resolveAgentIdentityKey(a)).not.toBe(resolveAgentIdentityKey(b));
  });

  it('treats the same account as the same identity even if the character name differs', () => {
    const a: CombatAgent = { name: 'Bob the Warrior', account: 'Bob.1234', kind: 'player' };
    const b: CombatAgent = { name: 'Bob the Guardian', account: 'Bob.1234', kind: 'player' };
    expect(resolveAgentIdentityKey(a)).toBe(resolveAgentIdentityKey(b));
  });

  it('keys account-less players by name, distinct from any account-bearing player', () => {
    const noAccount: CombatAgent = { name: 'Legacy Player', kind: 'player' };
    const withAccount: CombatAgent = { name: 'Legacy Player', account: 'Legacy Player.9999', kind: 'player' };
    expect(resolveAgentIdentityKey(noAccount)).not.toBe(resolveAgentIdentityKey(withAccount));
  });

  it('never merges an NPC/minion/pet into a player identity that happens to share a name', () => {
    const player: CombatAgent = { name: 'Wolf', account: 'Ranger.1', kind: 'player' };
    const pet: CombatAgent = { name: 'Wolf', kind: 'minion' };
    const npc: CombatAgent = { name: 'Wolf', kind: 'npc' };
    const keys = new Set([resolveAgentIdentityKey(player), resolveAgentIdentityKey(pet), resolveAgentIdentityKey(npc)]);
    expect(keys.size).toBe(3);
  });

  it('distinguishes two same-named NPCs when playerIndex differentiates them', () => {
    const npcA: CombatAgent = { name: 'Veteran Warg', kind: 'npc', playerIndex: 0 };
    const npcB: CombatAgent = { name: 'Veteran Warg', kind: 'npc', playerIndex: 1 };
    expect(resolveAgentIdentityKey(npcA)).not.toBe(resolveAgentIdentityKey(npcB));
  });

  it('gives two same-named, index-less NPCs the same key (source cannot distinguish them either)', () => {
    const npcA: CombatAgent = { name: 'Veteran Warg', kind: 'npc' };
    const npcB: CombatAgent = { name: 'Veteran Warg', kind: 'npc' };
    expect(resolveAgentIdentityKey(npcA)).toBe(resolveAgentIdentityKey(npcB));
  });

  it('handles a fully anonymous/unknown agent without throwing', () => {
    expect(() => resolveAgentIdentityKey(undefined)).not.toThrow();
    expect(resolveAgentIdentityKey(undefined)).toBe('unknown:-');
  });
});

describe('sameAgent', () => {
  it('agrees with resolveAgentIdentityKey', () => {
    const a: CombatAgent = { name: 'X', account: 'X.1', kind: 'player' };
    const b: CombatAgent = { name: 'X-alt-char', account: 'X.1', kind: 'player' };
    const c: CombatAgent = { name: 'X', account: 'X.2', kind: 'player' };
    expect(sameAgent(a, b)).toBe(true);
    expect(sameAgent(a, c)).toBe(false);
  });
});

describe('describeAgent', () => {
  it('labels non-player agents with their kind', () => {
    expect(describeAgent({ name: 'Siege Golem', kind: 'gadget' })).toBe('Siege Golem (gadget)');
  });

  it('labels players with no kind suffix', () => {
    expect(describeAgent({ name: 'Bob', account: 'Bob.1', kind: 'player' })).toBe('Bob');
  });

  it('handles a missing agent', () => {
    expect(describeAgent(undefined)).toBe('Unknown');
  });
});
