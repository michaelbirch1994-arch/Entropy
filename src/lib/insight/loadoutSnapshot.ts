/** Offline baseline contract. Source labels are claims, not authentication. */
export type LoadoutField = { state: 'unknown' } | {
  state: 'unequipped'; source: 'collector-observed' | 'player-provided';
} | { state: 'value'; source: 'collector-observed' | 'player-provided'; ids: number[] };
export const LOADOUT_FIELDS = ['specializations', 'traits', 'healSkill', 'utilitySkills', 'eliteSkill', 'weaponSkills'] as const;
export const EQUIPMENT_SLOTS = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'back', 'amulet', 'ring1', 'ring2', 'accessory1', 'accessory2', 'relic', 'weapon1Main', 'weapon1Off', 'weapon2Main', 'weapon2Off', 'aquaticHead', 'aquaticWeapon1', 'aquaticWeapon2'] as const;
type Source = 'collector-observed' | 'player-provided';
type Reference = { namespace: 'gw2:item' | 'gw2:itemstat'; id: number };
type Detail = { state: 'unknown' } | { state: 'unequipped'; source: Source } | { state: 'value'; source: Source; references: Reference[] };
export type EquipmentSlot = { state: 'unknown' } | { state: 'unequipped'; source: Source }
  | { state: 'value'; source: Source; item: Reference; stats: Detail; upgrades: Detail; infusions: Detail };
export interface LoadoutSnapshot {
  schemaVersion: 2;
  kind: 'loadout-baseline';
  sessionId: string;
  snapshotId: string;
  account: string;
  collectorVersion: string;
  gameBuild: number;
  mode: 'wvw' | 'pve' | 'pvp';
  clock: { basis: 'session-relative'; observedMs: number; uncertaintyMs: number };
  fields: Record<typeof LOADOUT_FIELDS[number], LoadoutField>;
  equipment: Record<typeof EQUIPMENT_SLOTS[number], EquipmentSlot>;
}
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const label = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));

export function parseLoadoutSnapshot(text: string): LoadoutSnapshot {
  if (text.length > 32768 || new TextEncoder().encode(text).length > 32768) throw Error('Loadout snapshot too large');
  const r: unknown = JSON.parse(text);
  if (!object(r) || !exact(r, ['schemaVersion','kind','sessionId','snapshotId','account','collectorVersion','gameBuild','mode','clock','fields','equipment']) || r.schemaVersion !== 2 || r.kind !== 'loadout-baseline') throw Error('Unsupported loadout schema');
  if (![r.sessionId,r.snapshotId,r.account,r.collectorVersion].every(label) || !integer(r.gameBuild,1) || !['wvw','pve','pvp'].includes(r.mode as string)) throw Error('Invalid loadout identity');
  if (!object(r.clock) || !exact(r.clock,['basis','observedMs','uncertaintyMs']) || r.clock.basis !== 'session-relative' || !integer(r.clock.observedMs) || !integer(r.clock.uncertaintyMs)) throw Error('Invalid loadout clock');
  if (!object(r.fields) || !exact(r.fields,[...LOADOUT_FIELDS])) throw Error('Baseline requires every field, including unknowns');
  for (const key of LOADOUT_FIELDS) {
    const f = r.fields[key];
    if (!object(f)) throw Error('Invalid loadout field');
    if (f.state === 'unknown' && exact(f,['state'])) continue;
    if (!['collector-observed','player-provided'].includes(f.source as string)) throw Error('Invalid field provenance');
    if (f.state === 'unequipped' && exact(f,['state','source'])) continue;
    if (f.state !== 'value' || !exact(f,['state','source','ids']) || !Array.isArray(f.ids) || !f.ids.length || f.ids.length > 32 || !f.ids.every(id => integer(id,1))) throw Error('Invalid field IDs');
    if (['healSkill','eliteSkill'].includes(key) && f.ids.length !== 1) throw Error('Expected one ID');
  }
  if (!object(r.equipment) || !exact(r.equipment, [...EQUIPMENT_SLOTS])) throw Error('Baseline requires every equipment slot');
  const sourced = (v: Record<string, unknown>) => ['collector-observed','player-provided'].includes(v.source as string);
  const reference = (v: unknown, ns: string) => object(v) && exact(v,['namespace','id']) && v.namespace === ns && integer(v.id,1);
  const detail = (v: unknown, ns: string, maximum: number) => {
    if (!object(v)) return false;
    if (v.state === 'unknown') return exact(v,['state']);
    if (!sourced(v)) return false;
    if (v.state === 'unequipped') return exact(v,['state','source']);
    return v.state === 'value' && exact(v,['state','source','references']) && Array.isArray(v.references)
      && v.references.length > 0 && v.references.length <= maximum && v.references.every(ref => reference(ref,ns));
  };
  for (const key of EQUIPMENT_SLOTS) {
    const slot = r.equipment[key];
    if (!object(slot)) throw Error('Invalid equipment slot');
    if (slot.state === 'unknown' && exact(slot,['state'])) continue;
    if (!sourced(slot)) throw Error('Invalid equipment provenance');
    if (slot.state === 'unequipped' && exact(slot,['state','source'])) continue;
    if (slot.state !== 'value' || !exact(slot,['state','source','item','stats','upgrades','infusions'])
      || !reference(slot.item,'gw2:item') || !detail(slot.stats,'gw2:itemstat',1)
      || !detail(slot.upgrades,'gw2:item',4) || !detail(slot.infusions,'gw2:item',4)) throw Error('Invalid slot item or details');
  }
  return r as unknown as LoadoutSnapshot;
}

/** Match session/account explicitly. No encounter or indefinite freshness inference. */
export function loadoutSnapshotAt(snapshot: LoadoutSnapshot, context: { sessionId: string; account: string; timeMs: number; maximumAgeMs: number }) {
  if (snapshot.sessionId !== context.sessionId || snapshot.account !== context.account) return { matched: false, reason: 'Identity mismatch' };
  if (!integer(context.timeMs) || !integer(context.maximumAgeMs)) return { matched: false, reason: 'Invalid time policy' };
  const ageMs = context.timeMs - snapshot.clock.observedMs;
  if (ageMs < snapshot.clock.uncertaintyMs) return { matched: false, reason: 'Observation may be after selected time' };
  if (ageMs + snapshot.clock.uncertaintyMs > context.maximumAgeMs) return { matched: false, reason: 'Snapshot exceeds explicit age policy' };
  return { matched: true, ageMs, fields: snapshot.fields, equipment: snapshot.equipment, limitation: 'Point snapshot within age policy; unchanged active state is not proven' };
}

export interface LoadoutSelectionContext {
  sessionId: string; account: string; gameBuild: number; mode: LoadoutSnapshot['mode'];
  timeMs: number; maximumAgeMs: number;
  /** Same session/clock; intervals include both boundaries conservatively. */
  gaps: { startMs: number; endMs: number }[];
}

/** Full baselines only. Inputs must pass parseLoadoutSnapshot before selection. */
export function selectLoadoutSnapshot(snapshots: LoadoutSnapshot[], context: LoadoutSelectionContext) {
  const unknown = (reason: string) => ({ status: 'unknown' as const, reason });
  if (!label(context.sessionId) || !label(context.account) || !integer(context.gameBuild,1)
    || !['wvw','pve','pvp'].includes(context.mode) || !integer(context.timeMs) || !integer(context.maximumAgeMs)
    || !Array.isArray(context.gaps) || context.gaps.length > 10000 || context.gaps.some(g => !g || !integer(g.startMs) || !integer(g.endMs) || g.endMs < g.startMs)
    || snapshots.length > 10000) return unknown('Invalid selection context or limits');
  const scoped = snapshots.filter(s => s.sessionId === context.sessionId && s.account === context.account);
  // Include uncertain observations that might already apply; never silently use an older baseline.
  const candidates = scoped.filter(s => s.clock.observedMs - s.clock.uncertaintyMs <= context.timeMs)
    .sort((a,b) => b.clock.observedMs - a.clock.observedMs);
  const latest = candidates[0];
  if (!latest) return unknown('No baseline at this moment');
  if (latest.gameBuild !== context.gameBuild || latest.mode !== context.mode) return unknown('Latest baseline has incompatible game context');
  if (candidates.filter(s => s.snapshotId === latest.snapshotId).length !== 1) return unknown('Duplicate snapshot identity; deduplicate verified retransmissions during import');
  const lower = latest.clock.observedMs - latest.clock.uncertaintyMs;
  if (candidates.slice(1).some(s => s.clock.observedMs + s.clock.uncertaintyMs >= lower)) return unknown('Baseline observation order is ambiguous');
  if (context.gaps.some(g => g.startMs <= context.timeMs && g.endMs >= lower)) return unknown('Recording gap invalidates baseline');
  const point = loadoutSnapshotAt(latest, context);
  if (!point.matched) return unknown(point.reason ?? 'Baseline not usable');
  return { status: 'snapshot' as const, snapshot: latest, ageMs: point.ageMs,
    limitation: 'Fresh point evidence only; no verified continuous active state or skill availability' };
}
