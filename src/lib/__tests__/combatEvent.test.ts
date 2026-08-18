// Unified CombatEvent model + the first normalizer (EI healing).
//
// The normalizer must reproduce figures already validated through the existing
// bridge-metrics path. If these drift apart, the migration is unsafe.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
      sumAmount,
      groupBy,
      isLifeSiphonHealing,
      eventIdentity,
      mergeEventSets,
      type CombatEvent,
      type CombatEventSet,
} from '../combat/CombatEvent';
import { normalizeHealingEvents, perTargetEvents, perSkillEvents } from '../combat/normalizeHealing';

const __dirname = dirname(fileURLToPath(import.meta.url));
const modern = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'wvw-modern-ei.json'), 'utf-8'));
const legacy = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'sample-wvw-log.json'), 'utf-8'));

describe('normalizeHealingEvents', () => {
      const set = normalizeHealingEvents(modern);

             it('carries source confidence onto every event', () => {
                       expect(set.confidence).toBe('high');
                       expect(set.events.every((e) => e.confidence === 'high')).toBe(true);
                       expect(set.events.every((e) => e.origin === 'healingStats')).toBe(true);
             });

             it('preserves the raw scaling classification rather than flattening it', () => {
                       const subs = new Set(perTargetEvents(set).map((e) => e.subcategory));
                       expect(subs.has('healingPower')).toBe(true);
                       expect(subs.has('conversion')).toBe(true);
                       expect(subs.has('hybrid')).toBe(true);
             });

             it('reproduces the validated life-siphon total', () => {
                       expect(sumAmount(perTargetEvents(set), isLifeSiphonHealing)).toBe(4128);
             });

             it('reproduces "who kept me alive" exactly from events alone', () => {
                       // Independently derived: group per-target events by source for one target
                        // and compare against EI's own incomingHealing for that player.
                        const toDan = perTargetEvents(set).filter((e) => e.target?.name === 'Dan Is My New Name');
                       const byHealer = groupBy(toDan, (e) => e.source.name);
                       const total = sumAmount(toDan);
                       expect(total).toBe(124879);

                        const ranked = [...byHealer.entries()]
                           .map(([name, evs]) => [name, sumAmount(evs)] as const)
                           .sort((a, b) => b[1] - a[1]);
                       expect(ranked[0][0]).toBe('Mithril Knight');
                       expect(ranked[0][1]).toBe(61256);
             });

             it('counts healing outside the ally axis as unattributed, never as zero', () => {
                       // In this log 96,907 healing onto minions/pets counts toward outgoing totals
                        // while never appearing as an ally slot. It must surface as unattributable
                        // rather than silently vanishing from the event stream.
                        expect(set.unattributed).toBe(96907);
                       const axisTotal = sumAmount(perTargetEvents(set));
                       expect(axisTotal + set.unattributed).toBe(818067);
             });

             it('keeps the per-skill axis separate so the two are never summed together', () => {
                       const perTarget = perTargetEvents(set);
                       const perSkill = perSkillEvents(set);
                       expect(perSkill.length).toBeGreaterThan(0);
                       expect(perSkill.every((e) => e.metadata?.axis === 'perSkill')).toBe(true);
                       // Same underlying healing sliced two ways - overlapping, not additive.
                        expect(perTarget.some((e) => e.metadata?.axis === 'perSkill')).toBe(false);
                       expect(perSkill.every((e) => e.skillId !== undefined)).toBe(true);
             });

             it('never emits a timestamp it does not have', () => {
                       // EI per-ally data is a phase aggregate. Inventing a timestamp would corrupt
                        // any later correlation against deaths or damage spikes.
                        expect(set.events.every((e) => e.timestampMs === null)).toBe(true);
             });

             it('propagates medium confidence from a legacy log', () => {
                       const legacySet = normalizeHealingEvents(legacy);
                       expect(legacySet.confidence).toBe('medium');
                       expect(legacySet.note).toMatch(/unconfirmed/i);
             });

             it('returns an empty set rather than throwing on junk input', () => {
                       expect(normalizeHealingEvents({}).events).toHaveLength(0);
                       expect(normalizeHealingEvents({ players: [] }).confidence).toBe('none');
             });
});

describe('cross-source merging', () => {
      const base = (over: Partial<CombatEvent> = {}): CombatEvent => ({
                timestampMs: 1000,
                source: { name: 'Healer', account: 'H.1', kind: 'player' },
                target: { name: 'Target', account: 'T.2', kind: 'player' },
                category: 'healing',
                subcategory: 'healingPower',
                amount: 500,
                hits: 1,
                skillId: 718,
                origin: 'eliteInsights',
                confidence: 'high',
                coverage: 'full',
                ...over,
      });
      const setOf = (events: CombatEvent[], over: Partial<CombatEventSet> = {}): CombatEventSet => ({
                events, origin: 'eliteInsights', confidence: 'high', unattributed: 0, ...over,
      });

             it('collapses the same event from two sources instead of double-counting', () => {
                       const merged = mergeEventSets([
                                     setOf([base()]),
                                     setOf([base({ origin: 'nativeEvtc' })], { origin: 'nativeEvtc' }),
                                 ]);
                       expect(merged.events).toHaveLength(1);
                       // Native EVTC is closest to the raw log, so it wins.
                        expect(merged.events[0].origin).toBe('nativeEvtc');
                       expect(sumAmount(merged.events)).toBe(500);
             });

             it('keeps genuinely different events apart', () => {
                       const merged = mergeEventSets([setOf([base(), base({ amount: 501 })])]);
                       expect(merged.events).toHaveLength(2);
             });

             it('does not fold a phase aggregate into an instantaneous event', () => {
                       // Different identity by design: a near-miss is far more likely to be two
                        // real events than one duplicate.
                        expect(eventIdentity(base())).not.toBe(eventIdentity(base({ timestampMs: null })));
             });

             it('takes the worst confidence across merged sources', () => {
                       const merged = mergeEventSets([
                                     setOf([base()]),
                                     setOf([base({ amount: 9, confidence: 'medium' })], { confidence: 'medium', note: 'unconfirmed' }),
                                 ]);
                       expect(merged.confidence).toBe('medium');
                       expect(merged.note).toBe('unconfirmed');
                       expect(merged.origin).toBe('combined');
             });

             it('sums unattributed across sources without redistributing it', () => {
                       const merged = mergeEventSets([
                                     setOf([base()], { unattributed: 100 }),
                                     setOf([base({ amount: 7 })], { unattributed: 50 }),
                                 ]);
                       expect(merged.unattributed).toBe(150);
                       expect(sumAmount(merged.events)).toBe(507);
             });

             it('handles an empty merge', () => {
                       expect(mergeEventSets([]).confidence).toBe('none');
             });
});
