// Smoke test: runs the full report-assembly pipeline against a real raw
// Elite Insights WvW log (fixture captured from a live fight, not synthetic)
// and asserts the shape holds together end to end.
//
// This exists specifically to catch the kind of regression we hit this
// session with Top Skills: a field on the raw EI JSON gets misread (wrong
// key, wrong type) and a view silently renders broken data (missing icons,
// unnamed skills) instead of throwing. A real fixture surfaces that kind of
// bug immediately instead of waiting for a user to notice a broken image.
//
// If Elite Insights changes its JSON schema in a way that breaks this test,
// that's useful signal - re-verify the affected field against
// https://baaron4.github.io/GW2-Elite-Insights-Parser/Json/ before fixing.

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

describe('buildReportFromFights (real WvW log fixture)', () => {
    const fight = loadFixture();
    const report = buildReportFromFights([fight]);

           it('produces a report with the expected top-level shape', () => {
                 expect(report.meta).toBeTruthy();
                 expect(report.stats).toBeTruthy();
           });

           it('finds the squad players in the fixture log', () => {
                 // The fixture has 3 squad members and 7 non-squad "Non Squad Player N"
                  // entries (arcdps includes anyone nearby, not just the recorder's squad).
                  expect(report.stats.offensePlayers.length).toBeGreaterThan(0);
                 expect(report.stats.offensePlayers.length).toBeLessThanOrEqual((fight.raw.players ?? []).length);
           });

           it('resolves Top Skills with names and no numeric-id leakage into icon', () => {
                 const { topSkills } = report.stats;
                 expect(topSkills).toBeTruthy();
                 for (const s of topSkills ?? []) {
                         expect(typeof s.id).toBe('number');
                         // Regression guard for the bug fixed this session: icon must never
                   // silently hold the raw skill id instead of a real icon URL.
                   if (s.icon !== undefined) expect(typeof s.icon).toBe('string');
                         expect(s.name).toBeTruthy();
                 }
           });


           it('synthesizes Untamed Natural Fortitude damage from Savage Slash hits', () => {
                 const raw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const player = (raw.players ?? []).find((p: any) => !p.notInSquad) as any;
                 expect(player).toBeTruthy();

                 const skillId = 987654;
                 (raw as any).skillMap = { ...((raw as any).skillMap ?? {}), [`s${skillId}`]: { name: 'Savage Slash', icon: 'https://example.invalid/savage-slash.png' } };
                 player.profession = 'Untamed';
                 player.totalDamageDist = player.totalDamageDist ?? [[]];
                 player.totalDamageDist[0] = [
                         ...(player.totalDamageDist[0] ?? []),
                         { id: skillId, totalDamage: 0, connectedHits: 2, downContribution: 0 },
                 ];

                 const original = buildReportFromFights([fight]);
                 const synthetic = buildReportFromFights([{ summary: summarizeRawFight(raw), raw }]);
                 const naturalFortitude = synthetic.stats.topSkills.find((s) => s.name === 'Natural Fortitude');
                 expect(naturalFortitude).toBeTruthy();
                 expect(naturalFortitude!.damage).toBe(3558);
                 expect(naturalFortitude!.hits).toBe(2);
                 expect(naturalFortitude!.icon).toContain('Natural%20Fortitude');

                 const before = original.stats.offensePlayers.find((p) => p.account === player.account);
                 const after = synthetic.stats.offensePlayers.find((p) => p.account === player.account && p.profession === 'Untamed');
                 expect(before).toBeTruthy();
                 expect(after).toBeTruthy();
                 expect(after!.offenseTotals.damage).toBe((before!.offenseTotals.damage || 0) + 3558);
           });

           it('synthesizes Natural Fortitude from Solar Brilliance, Relentless Whirl, and Rampant Growth trigger rates', () => {
                 const raw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const player = (raw.players ?? []).find((p: any) => !p.notInSquad) as any;
                 expect(player).toBeTruthy();

                 const solarBrillianceId = 900001;
                 const relentlessWhirlId = 900002;
                 const rampantGrowthId = 900003;
                 (raw as any).skillMap = {
                         ...((raw as any).skillMap ?? {}),
                         [`s${solarBrillianceId}`]: { name: 'Solar Brilliance', icon: 'https://example.invalid/solar-brilliance.png' },
                         [`s${relentlessWhirlId}`]: { name: 'Relentless Whirl', icon: 'https://example.invalid/relentless-whirl.png' },
                         [`s${rampantGrowthId}`]: { name: 'Rampant Growth', icon: 'https://example.invalid/rampant-growth.png' },
                 };
                 player.profession = 'Untamed';
                 player.totalDamageDist = player.totalDamageDist ?? [[]];
                 player.totalDamageDist[0] = [
                         ...(player.totalDamageDist[0] ?? []),
                         { id: solarBrillianceId, totalDamage: 0, connectedHits: 12, downContribution: 0 },
                         { id: relentlessWhirlId, totalDamage: 0, connectedHits: 10, downContribution: 0 },
                         { id: rampantGrowthId, totalDamage: 0, connectedHits: 3, downContribution: 0 },
                 ];

                 const original = buildReportFromFights([fight]);
                 const synthetic = buildReportFromFights([{ summary: summarizeRawFight(raw), raw }]);
                 const naturalFortitude = synthetic.stats.topSkills.find((s) => s.name === 'Natural Fortitude');
                 const expectedTriggers = 7;
                 const expectedDamage = expectedTriggers * 1779;
                 expect(naturalFortitude).toBeTruthy();
                 expect(naturalFortitude!.damage).toBe(expectedDamage);
                 expect(naturalFortitude!.hits).toBe(expectedTriggers);

                 const before = original.stats.offensePlayers.find((p) => p.account === player.account);
                 const after = synthetic.stats.offensePlayers.find((p) => p.account === player.account && p.profession === 'Untamed');
                 expect(before).toBeTruthy();
                 expect(after).toBeTruthy();
                 expect(after!.offenseTotals.damage).toBe((before!.offenseTotals.damage || 0) + expectedDamage);
           });

           it('builds a squad rotation timeline covering the same players', () => {
                 expect(report.stats.rotations?.fights.length).toBeGreaterThan(0);
                 const rotFight = report.stats.rotations!.fights[0];
                 expect(rotFight.players.length).toBeGreaterThan(0);
           });

           it('builds buff generation tables without throwing', () => {
                 expect(Array.isArray(report.stats.buffGeneration)).toBe(true);
           });

           it('never crashes building death recaps even with no deaths in a short log', () => {
                 expect(Array.isArray(report.stats.deathRecaps)).toBe(true);
           });

           it('builds fight highlights with real, non-empty descriptions', () => {
                 const highlights = report.stats.fightHighlights;
                 expect(Array.isArray(highlights)).toBe(true);
                 for (const h of highlights ?? []) {
                         expect(h.title).toBeTruthy();
                         expect(h.description).toBeTruthy();
                         expect(h.fightName).toBeTruthy();
                 }
           });

           // Regression guard for the survivalSupport wiring bug caught in pre-push
           // review: buildReportFromFights was passing computeAllIncomingHealing the
           // { details } wrapper instead of .details, so every call silently returned
           // [] and the "Who Kept Me Alive?" panel rendered empty on every report with
           // no error and no failing test anywhere in the suite. This fixture has a
           // known addon user (GildedBloom.1887, 17,403 healing) whose incoming-healing
           // breakdown for at least one squadmate should be non-empty if the wiring is
           // correct - if this ever goes back to returning [], this test must fail.
           it('produces non-empty survivalSupport when the fixture has a healing-addon user', () => {
                 expect(Array.isArray(report.stats.survivalSupport)).toBe(true);
                 expect(report.stats.survivalSupport!.length).toBeGreaterThan(0);
                 const withHealing = report.stats.survivalSupport!.find((b) => b.healed > 0);
                 expect(withHealing).toBeTruthy();
           });
});
