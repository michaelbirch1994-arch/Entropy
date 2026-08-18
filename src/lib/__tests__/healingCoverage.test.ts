// Healing scaling split (life siphon) + heal-addon coverage classification.
//
// Runs against the same real WvW fixture as the smoke test, which happens to be
// an ideal case: only 1 of its 3 squad members ("Haro Forge") was running
// arcdps_healing_stats, and that player's healing splits cleanly across all three
// scaling buckets. See ENTROPY_HEALING_INVESTIGATION.md for the forensic work
// behind these expectations.
//
// Why this matters: Guild Wars 2 only reports healing to the healing player's own
// client. EI nonetheless emits a populated extHealingStats object for *every*
// player, so "has data" must never be treated as "has the addon" - the only ground
// truth is usedExtensions.runningExtension.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildReportFromFights, type FightInput } from '../buildReportFromFights';
import { summarizeRawFight, type RawFightLog } from '../../types/rawFight';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(): FightInput {
    const path = join(__dirname, 'fixtures', 'sample-wvw-log.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as RawFightLog;
    return { summary: summarizeRawFight(raw), raw };
}

const report = buildReportFromFights([loadFixture()]);
const healers = report.stats.healingPlayers;
const byAccount = new Map(healers.map((h) => [h.account, h]));

describe('healing scaling split (life siphon)', () => {
    it('surfaces conversion healing instead of collapsing it into the total', () => {
          // Haro Forge: 14,511 healing-power + 2,684 conversion + 208 hybrid = 17,403.
           // conversionHealing is the life-steal bucket - healing derived from damage
           // dealt rather than from the Healing Power stat.
           const haro = byAccount.get('GildedBloom.1887');
          expect(haro).toBeTruthy();
          expect(haro!.healingTotals.healing).toBe(17403);
          expect(haro!.healingTotals.healingPowerHealing).toBe(14511);
          expect(haro!.healingTotals.conversionHealing).toBe(2684);
          expect(haro!.healingTotals.hybridHealing).toBe(208);
    });

           it('keeps the three buckets a partition of the total', () => {
                 // If this ever stops holding, either EI changed shape or a phase is being
                  // double-counted - both are silent-corruption bugs worth failing loudly on.
                  for (const h of healers) {
                          const t = h.healingTotals;
                          const parts =
                                    (t.healingPowerHealing ?? 0) + (t.conversionHealing ?? 0) + (t.hybridHealing ?? 0);
                          expect(parts).toBe(t.healing ?? 0);
                  }
           });
});

describe('heal addon coverage', () => {
    it("marks the one addon user 'full' and the rest not, from usedExtensions alone", () => {
          // The fixture's usedExtensions lists exactly one runningExtension entry.
           expect(byAccount.get('GildedBloom.1887')!.hasHealAddon).toBe(true);
          expect(byAccount.get('GildedBloom.1887')!.healingCoverage).toBe('full');

           expect(byAccount.get('WovenThorn.5639')!.hasHealAddon).toBe(false);
          expect(byAccount.get('HiddenThorn.9126')!.hasHealAddon).toBe(false);
    });

           it("reports a non-addon player's zero as 'none' (unknown), never as a real zero", () => {
                 // This is the distinction that stops Entropy claiming someone healed nothing
                  // when in truth nobody was in a position to observe them.
                  const eve = byAccount.get('WovenThorn.5639')!;
                 expect(eve.healingTotals.healing ?? 0).toBe(0);
                 expect(eve.healingCoverage).toBe('none');
           });

           it('never labels a player full without the addon', () => {
                 for (const h of healers) {
                         if (h.healingCoverage === 'full') expect(h.hasHealAddon).toBe(true);
                         else expect(h.hasHealAddon).toBe(false);
                 }
           });
});
