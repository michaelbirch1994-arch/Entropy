// Tests for the damage taxonomy, incoming-healing transposition, the data
// integrity report, and the native EVTC parser.
//
// Expectations are grounded in forensic work against real WvW logs — see
// ENTROPY_HEALING_INVESTIGATION.md. Where a value looks arbitrary it is usually a
// figure measured from a real fight.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classifyDamage, classifyHealingSkill, isLifeStealHealingSkill } from '../bridge-metrics/damageTaxonomy';
import { computeIncomingHealing, getHealAddonPlayers, computeAllIncomingHealing } from '../bridge-metrics/incomingHealing';
import { buildAllyIndexMap } from '../bridge-metrics/allyIndex';
import { computeHealingIntegrity, formatHealingIntegrity } from '../bridge-metrics/dataIntegrity';
import { parseEvtc, EvtcParseError, EVENT_SIZE, CBTS } from '../evtc/parseEvtc';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Three fixtures spanning the confidence tiers, so each is exercised for real
// rather than assumed:
//   A - modern EI (14 players, real incomingHealing) -> high
//   B - legacy EI (10 players, no incomingHealing)   -> medium
//   C - synthetic empty                              -> none
const modern = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'wvw-modern-ei.json'), 'utf-8'));
const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'sample-wvw-log.json'), 'utf-8'));

describe('damage taxonomy', () => {
      it('partitions damage into strike vs condition using EI classification', () => {
                const t = classifyDamage([
                  { id: 1, totalDamage: 1000, indirectDamage: false },
                  { id: 2, totalDamage: 250, indirectDamage: true },
                  { id: 3, totalDamage: 750, indirectDamage: false },
                          ]);
                expect(t.buckets.find((b) => b.category === 'strike')!.value).toBe(1750);
                expect(t.buckets.find((b) => b.category === 'condition')!.value).toBe(250);
                expect(t.total).toBe(2000);
      });

             it('treats breakbar/barrier/downContribution as overlays, not partition members', () => {
                       const t = classifyDamage([
                         { id: 1, totalDamage: 1000, indirectDamage: false, shieldDamage: 400, downContribution: 300, totalBreakbarDamage: 50 },
                                 ]);
                       // Overlays describe damage already counted in `total` - summing them into
                        // the total would double-count.
                        expect(t.total).toBe(1000);
                       expect(t.overlays.find((o) => o.category === 'barrierAbsorbed')!.value).toBe(400);
                       expect(t.overlays.find((o) => o.category === 'downContribution')!.value).toBe(300);
             });

             it('reports life-steal damage as unavailable with a reason rather than guessing', () => {
                       const t = classifyDamage([{ id: 1, totalDamage: 100, indirectDamage: false }]);
                       const ls = t.unavailable.find((u) => u.category === 'lifeSteal');
                       expect(ls).toBeTruthy();
                       expect(ls!.reason).toMatch(/no distinguishing flag/i);
                       // Retaliation no longer exists in the game at all.
                        expect(t.unavailable.find((u) => u.category === 'retaliation')!.reason).toMatch(/removed/i);
             });

             it('handles missing/garbage input without throwing', () => {
                       expect(classifyDamage(undefined).total).toBe(0);
                       expect(classifyDamage([{ id: 1 } as any]).total).toBe(0);
             });
});

describe('healing skill scaling classification', () => {
      const skillMap = {
                s79344: { name: 'Lesser Signet of the Locust', conversionBasedHealing: true, hybridHealing: false },
                s71813: { name: 'Hungering Maelstrom', conversionBasedHealing: false, hybridHealing: true },
                s21762: { name: 'Signet of Vampirism', conversionBasedHealing: false, hybridHealing: false },
      };
      const buffMap = { b718: { name: 'Regeneration', conversionBasedHealing: false, hybridHealing: false } };

             it('matches the three skills verified against real aggregate buckets', () => {
                       expect(classifyHealingSkill(79344, skillMap, buffMap)).toBe('conversion');
                       expect(classifyHealingSkill(71813, skillMap, buffMap)).toBe('hybrid');
                       expect(classifyHealingSkill(21762, skillMap, buffMap)).toBe('healingPower');
             });

             it('falls back to buffMap for trait/buff procs', () => {
                       expect(classifyHealingSkill(718, skillMap, buffMap)).toBe('healingPower');
             });

             it('identifies life-steal healing skills, and reports unknown ids honestly', () => {
                       expect(isLifeStealHealingSkill(79344, skillMap, buffMap)).toBe(true);
                       expect(isLifeStealHealingSkill(21762, skillMap, buffMap)).toBe(false);
                       expect(classifyHealingSkill(999999, skillMap, buffMap)).toBe('unknown');
             });
});

describe('incoming healing', () => {
      const players = [
        {
                      name: 'Receiver', account: 'R.1', profession: 'Guardian',
                      extHealingStats: {
                                        incomingHealing: [{ healed: 300, healingPowerHealed: 250, conversionHealed: 50, hybridHealed: 0, downedHealed: 20 }],
                                        totalIncomingHealingDist: [[{ id: 718, totalHealing: 300, hits: 3 }]],
                                        outgoingHealingAllies: [[{ healing: 0 }], [{ healing: 0 }]],
                      },
        },
        {
                      name: 'Healer', account: 'H.2', profession: 'Druid',
                      extHealingStats: { outgoingHealingAllies: [[{ healing: 300 }], [{ healing: 0 }]] },
        },
            ];

             it('transposes the outgoing matrix to find who healed the target', () => {
                       const bd = computeIncomingHealing(players, 0, new Set(['Receiver']))!;
                       expect(bd.healed).toBe(300);
                       expect(bd.contributors).toHaveLength(1);
                       expect(bd.contributors[0].name).toBe('Healer');
                       expect(bd.contributors[0].share).toBeCloseTo(1);
                       expect(bd.conversionHealed).toBe(50);
             });

             it('applies the mirror rule: coverage depends on the RECEIVER, not the healer', () => {
                       // Receiver has the addon -> complete, even though the healer does not.
                        expect(computeIncomingHealing(players, 0, new Set(['Receiver']))!.coverage).toBe('full');
                       // Receiver lacks it -> only heals from addon-running sources were observed.
                        expect(computeIncomingHealing(players, 0, new Set(['Healer']))!.coverage).toBe('partial');
                       // Nothing observed at all is unknown, not zero.
                        expect(computeIncomingHealing(players, 1, new Set())!.coverage).toBe('none');
             });

             it('reads the addon roster from usedExtensions on the real fixture', () => {
                       const addon = getHealAddonPlayers(fixture);
                       expect(addon.has('Haro Forge')).toBe(true);
                       expect(addon.size).toBe(1);
             });

             it('maps player slots positionally and buckets the rest as other allies', () => {
                       // The fixture's ally axis has 41 entries for 10 players: the leading 10 are
                        // the players, the remaining 31 are minions/pets/allied NPCs which carry no
                        // identifier and must not be guessed at.
                        const map = buildAllyIndexMap(fixture);
                       expect(map.playerSlotCount).toBe(10);
                       expect(map.otherSlotCount).toBe(31);
                       expect(map.slots[0]).toMatchObject({ kind: 'player', playerIndex: 0, name: 'Haro Forge' });
                       expect(map.slots[40].kind).toBe('other-ally');
             });

             it("reports 'medium' confidence when there is no incomingHealing to reconcile", () => {
                       // Older EI output omits incomingHealing entirely. Structure is sound and the
                        // row invariant holds, but the split is unconfirmed - not the same as proven.
                        const map = buildAllyIndexMap(fixture);
                       expect(map.confidence).toBe('medium');
                       expect(map.rowInvariantHolds).toBe(true);
                       expect(map.columnReconciled).toBe(false);
                       expect(map.note).toMatch(/unconfirmed/i);
             });

             it("reports 'none' for a log with no healing extension data", () => {
                       const map = buildAllyIndexMap({ players: [{ name: 'A' }, { name: 'B' }] });
                       expect(map.confidence).toBe('none');
                       expect(map.playerSlotCount).toBe(0);
             });

             it('never lets attributed contributors exceed the observed total', () => {
                       // The invariant: attribution may fall short (healing onto minions can sit
                        // outside the ally axis) but must never exceed. Exceeding means we are
                        // reading another player's healing.
                        for (const bd of computeAllIncomingHealing(fixture)) {
                                      const summed = bd.contributors.reduce((s, c) => s + c.healing, 0);
                                      expect(summed).toBeLessThanOrEqual(bd.healed);
                                      expect(bd.unattributed).toBeGreaterThanOrEqual(0);
                                      expect(summed + bd.unattributed).toBe(bd.healed);
                        }
             });

             it('withholds attribution and explains why when the invariant breaks', () => {
                       // Force a mismatch: EI reports less incoming than the transpose produces.
                        const skewed = JSON.parse(JSON.stringify(players));
                       skewed[0].extHealingStats.incomingHealing[0].healed = 10;
                       const bad = computeIncomingHealing(skewed, 0, new Set(['Receiver']))!;
                       expect(bad.attributionConfidence).toBe('none');
                       expect(bad.contributors).toHaveLength(0);
                       expect(bad.attributionNote).toMatch(/withheld/i);
                       // Aggregate survives - only the split is suppressed.
                        expect(bad.healed).toBe(10);
             });

             it('is immune to duplicate display names because it maps by index, not name', () => {
                       const dupes = [
                         { name: 'Twin', account: 'A.1', profession: 'Guardian',
                                        extHealingStats: { incomingHealing: [{ healed: 100 }], outgoingHealingAllies: [[{ healing: 0 }], [{ healing: 0 }]] } },
                         { name: 'Twin', account: 'B.2', profession: 'Druid',
                                        extHealingStats: { outgoingHealingAllies: [[{ healing: 100 }], [{ healing: 0 }]] } },
                                 ];
                       const bd = computeIncomingHealing(dupes, 0, new Set(['Twin']))!;
                       expect(bd.contributors).toHaveLength(1);
                       // Distinguished by account even though display names collide.
                        expect(bd.contributors[0].account).toBe('B.2');
             });

});

describe('confidence tiers across EI versions', () => {
      it("A: modern EI reconciles 14/14 columns exactly -> high", () => {
                const map = buildAllyIndexMap(modern);
                expect(map.playerSlotCount).toBe(14);
                expect(map.otherSlotCount).toBe(0);
                expect(map.columnReconciled).toBe(true);
                expect(map.confidence).toBe('high');
                expect(map.note).toBeUndefined();
      });

             it('B: legacy EI lacks incomingHealing -> medium', () => {
                       expect(buildAllyIndexMap(fixture).confidence).toBe('medium');
             });

             it('C: empty log -> none', () => {
                       expect(buildAllyIndexMap({ players: [] }).confidence).toBe('none');
             });

             it('attributes real contributors on the modern fixture, summing exactly', () => {
                       // "Dan Is My New Name" received 124,879 from 8 distinct healers. Notably the
                        // largest contributor (Mithril Knight, 61,256) ran no addon - the receiver's
                        // own client observed it. That is the mirror rule doing real work.
                        const bd = computeAllIncomingHealing(modern).find((b) => b.player === 'Dan Is My New Name')!;
                       expect(bd.healed).toBe(124879);
                       expect(bd.attributionConfidence).toBe('high');
                       expect(bd.coverage).toBe('full');
                       expect(bd.contributors.length).toBe(8);
                       expect(bd.contributors[0].name).toBe('Mithril Knight');
                       expect(bd.contributors[0].contributorHasAddon).toBe(false);
                       expect(bd.contributors.reduce((s, c) => s + c.healing, 0)).toBe(bd.healed);
                       expect(bd.unattributed).toBe(0);
             });

             it('never redistributes unattributed healing across known players', () => {
                       for (const bd of computeAllIncomingHealing(modern)) {
                                     const summed = bd.contributors.reduce((s, c) => s + c.healing, 0);
                                     expect(summed).toBeLessThanOrEqual(bd.healed);
                                     expect(summed + bd.unattributed).toBe(bd.healed);
                       }
             });

             it('surfaces real life-siphon healing on the modern fixture', () => {
                       const r = computeHealingIntegrity(modern);
                       expect(r.players).toBe(14);
                       expect(r.healAddonUsers).toBe(8);
                       expect(r.fullCoverage).toBe(8);
                       expect(r.lifeSiphonHealing).toBe(4128);
             });
});

describe('data integrity report', () => {
      const r = computeHealingIntegrity(fixture);

             it('counts coverage from usedExtensions, not from presence of data', () => {
                       expect(r.players).toBe(3);
                       expect(r.healAddonUsers).toBe(1);
                       expect(r.fullCoverage).toBe(1);
                       expect(r.fullCoverage + r.partialCoverage + r.noCoverage).toBe(r.players);
             });

             it('keeps barrier UNVERIFIED and overheal NOT AVAILABLE', () => {
                       expect(r.lines.find((l) => l.metric === 'Barrier (applied)')!.status).toBe('unverified');
                       expect(r.lines.find((l) => l.metric === 'Overheal')!.status).toBe('not-available');
                       // Damage-side barrier is spec-confirmed and must NOT be marked unverified.
                        expect(r.lines.find((l) => l.metric === 'Barrier (absorbed, damage side)')!.status).toBe('available');
             });

             it('marks native EVTC disabled by default', () => {
                       expect(r.lines.find((l) => l.metric === 'Native EVTC parsing')!.status).toBe('not-enabled');
                       expect(computeHealingIntegrity(fixture, { nativeEvtcEnabled: true })
                                          .lines.find((l) => l.metric === 'Native EVTC parsing')!.status).toBe('available');
             });

             it('renders a readable plain-text report', () => {
                       const text = formatHealingIntegrity(r);
                       expect(text).toContain('HEALING DATA INTEGRITY');
                       expect(text).toContain('UNVERIFIED');
             });
});

// --- Native EVTC parser -----------------------------------------------------
// Built as a synthetic buffer rather than vendoring a multi-megabyte binary.

function buildEvtc(opts: { agentName?: string; account?: string } = {}): ArrayBuffer {
      const enc = new TextEncoder();
      const agentCount = 1;
      const skillCount = 1;
      const eventCount = 2;
      const size = 16 + 4 + agentCount * 96 + 4 + skillCount * 68 + eventCount * EVENT_SIZE;
      const buf = new ArrayBuffer(size);
      const b = new Uint8Array(buf);
      const v = new DataView(buf);

    b.set(enc.encode('EVTC'), 0);
      b.set(enc.encode('20260718'), 4);
      b[12] = 1; // revision
    v.setUint16(13, 1, true); // WvW

    let o = 16;
      v.setUint32(o, agentCount, true); o += 4;
      const agentBase = o;
      v.setBigUint64(agentBase, 1234n, true);
      v.setUint32(agentBase + 12, 5, true); // is_elite != 0xffffffff -> player
    // "name\0account\0subgroup\0" - deliberately non-ASCII to catch byte/char bugs.
    const packed = enc.encode(`${opts.agentName ?? 'Geiromül'}\0${opts.account ?? ':svava.4182'}\0${'2'}\0`);
      b.set(packed, agentBase + 28);
      o += 96;

    v.setUint32(o, skillCount, true); o += 4;
      v.setInt32(o, 718, true);
      b.set(enc.encode('Regeneration'), o + 4);
      o += 68;

    // Event 1: extension registration. Signature lives in src_agent (offset 8).
    v.setUint32(o + 8, 2627419289, true);
      b.set(enc.encode('2.18rc1'), o + 16);
      b[o + 56] = CBTS.EXTENSION;
      o += EVENT_SIZE;

    // Event 2: extension combat, direct heal of 2085 written as negative.
    v.setBigUint64(o, 500n, true);
      v.setInt32(o + 24, -2085, true);
      v.setUint32(o + 32, 2085, true); // overstack (unverified meaning)
    v.setUint32(o + 36, 718, true);
      v.setUint16(o + 40, 7, true);
      v.setUint16(o + 42, 9, true);
      b[o + 49] = 0; // buff = 0 -> direct heal, amount in `value`
    b[o + 56] = CBTS.EXTENSION_COMBAT;
      b[o + 58] = 1; // is_shields
    v.setUint32(o + 60, 2627419289, true); // signature in pad61-64
    return buf;
}

describe('native EVTC parser', () => {
      it('parses the header, agents and skills', () => {
                const log = parseEvtc(buildEvtc());
                expect(log.header.build).toBe('20260718');
                expect(log.header.revision).toBe(1);
                expect(log.header.isWvW).toBe(true);
                expect(log.skills.get(718)).toBe('Regeneration');
                expect(log.agents[0].isPlayer).toBe(true);
      });

             it('splits name/account by BYTE offset so non-ASCII names do not desync', () => {
                       // Regression: advancing by JS string .length shifts the account field by one
                        // byte for every multi-byte character, landing the account in the subgroup.
                        const log = parseEvtc(buildEvtc());
                       expect(log.agents[0].name).toBe('Geiromül');
                       expect(log.agents[0].account).toBe(':svava.4182');
                       expect(log.agents[0].subgroup).toBe('2');
             });

             it('reads the extension signature from src_agent, not pad61', () => {
                       const log = parseEvtc(buildEvtc());
                       expect(log.extensions).toHaveLength(1);
                       expect(log.extensions[0].signature).toBe(2627419289);
                       expect(log.extensions[0].version).toBe('2.18rc1');
             });

             it('sign-corrects healing and keeps overstack explicitly unverified', () => {
                       const log = parseEvtc(buildEvtc());
                       expect(log.extensionCombat).toHaveLength(1);
                       const e = log.extensionCombat[0];
                       expect(e.healing).toBe(2085);
                       expect(e.isBuffHeal).toBe(false);
                       expect(e.shieldFlag).toBe(true);
                       // Named to make misuse obvious at the call site.
                        expect(e.overstackValueUnverified).toBe(2085);
                       expect(e.signature).toBe(2627419289);
             });

             it('rejects non-EVTC and unsupported revisions instead of misparsing', () => {
                       expect(() => parseEvtc(new ArrayBuffer(8))).toThrow(EvtcParseError);
                       const bad = buildEvtc();
                       new Uint8Array(bad)[12] = 0; // revision 0 has a different layout
                        expect(() => parseEvtc(bad)).toThrow(/revision/i);
             });
});
