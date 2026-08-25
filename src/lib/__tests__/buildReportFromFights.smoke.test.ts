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

           it('records fight coverage, contributors, and per-fight range for Top Skills', () => {
                 const firstRaw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const secondRaw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 firstRaw.fightName = 'Opening Clash';
                 secondRaw.fightName = 'Final Push';
                 const firstPlayer = (firstRaw.players ?? []).find((p: any) => !p.notInSquad) as any;
                 const secondPlayer = (secondRaw.players ?? []).find((p: any) => p.account === firstPlayer?.account) as any;
                 expect(firstPlayer).toBeTruthy();
                 expect(secondPlayer).toBeTruthy();

                 const sampleSkillId = 8765432;
                 (firstRaw as any).skillMap = {
                         ...(firstRaw as any).skillMap,
                         [`s${sampleSkillId}`]: { name: 'Sample Context Strike' },
                 };
                 (secondRaw as any).skillMap = {
                         ...(secondRaw as any).skillMap,
                         [`s${sampleSkillId}`]: { name: 'Sample Context Strike' },
                 };
                 firstPlayer.totalDamageDist = firstPlayer.totalDamageDist ?? [[]];
                 secondPlayer.totalDamageDist = secondPlayer.totalDamageDist ?? [[]];
                 firstPlayer.totalDamageDist[0] = [
                         ...(firstPlayer.totalDamageDist[0] ?? []),
                         { id: sampleSkillId, totalDamage: 10_000_000, connectedHits: 10, downContribution: 2_000_000, max: 1_000_000 },
                 ];
                 secondPlayer.totalDamageDist[0] = [
                         ...(secondPlayer.totalDamageDist[0] ?? []),
                         { id: sampleSkillId, totalDamage: 30_000_000, connectedHits: 30, downContribution: 6_000_000, max: 2_000_000 },
                 ];

                 const combined = buildReportFromFights([
                         { summary: summarizeRawFight(firstRaw), raw: firstRaw },
                         { summary: summarizeRawFight(secondRaw), raw: secondRaw },
                 ]);
                 const sample = combined.stats.topSkills.find((skill) => skill.id === sampleSkillId);
                 expect(sample).toBeTruthy();
                 expect(sample?.fightCount).toBe(2);
                 expect(sample?.playerCount).toBe(1);
                 expect(sample?.activeMs).toBeGreaterThan(0);
                 expect(sample?.perFightMin).toBe(10_000_000);
                 expect(sample?.perFightAverage).toBe(20_000_000);
                 expect(sample?.perFightMax).toBe(30_000_000);
                 expect(sample?.perFightMaxContext?.fightIndex).toBe(1);
                 expect(sample?.perFightMaxContext?.fightName).toBe('Final Push');
                 expect(sample?.biggestHit?.fightIndex).toBe(1);
                 expect(sample?.biggestHit?.fightName).toBe('Final Push');
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

           it('aggregates one account across professions, characters, roles, and fights', () => {
                 const firstRaw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const secondRaw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const firstPlayer = (firstRaw.players ?? []).find((p: any) => !p.notInSquad) as any;
                 const secondPlayer = (secondRaw.players ?? []).find((p: any) => p.account === firstPlayer?.account) as any;
                 expect(firstPlayer).toBeTruthy();
                 expect(secondPlayer).toBeTruthy();

                 const firstProfession = String(firstPlayer.profession || 'Guardian');
                 const secondProfession = firstProfession === 'Chronomancer' ? 'Untamed' : 'Chronomancer';
                 secondPlayer.profession = secondProfession;
                 secondPlayer.name = `${secondPlayer.name || 'Character'} Alt`;

                 firstPlayer.support = [{ ...(firstPlayer.support?.[0] ?? {}), condiCleanse: 3, condiCleanseSelf: 1, boonStrips: 5 }];
                 secondPlayer.support = [{ ...(secondPlayer.support?.[0] ?? {}), condiCleanse: 4, condiCleanseSelf: 2, boonStrips: 7 }];
                 firstPlayer.extHealingStats = { ...(firstPlayer.extHealingStats ?? {}), outgoingHealingAllies: [[{ healing: 1000 }]] };
                 secondPlayer.extHealingStats = { ...(secondPlayer.extHealingStats ?? {}), outgoingHealingAllies: [[{ healing: 2000 }]] };

                 const modifierId = 990001;
                 const rotationSkillId = 990002;
                 for (const [raw, player, activeMs] of [[firstRaw, firstPlayer, 30_000], [secondRaw, secondPlayer, 45_000]] as const) {
                         (raw as any).damageModMap = {
                                 ...((raw as any).damageModMap ?? {}),
                                 [`d${modifierId}`]: { name: 'Build Attendance Modifier' },
                         };
                         (raw as any).skillMap = {
                                 ...((raw as any).skillMap ?? {}),
                                 [`s${rotationSkillId}`]: { name: 'Build Attendance Cast' },
                         };
                         player.activeTimes = [activeMs];
                         player.damageModifiers = [{ id: modifierId, damageModifiers: [{ damageGain: 100, totalHitCount: 2 }] }];
                         player.rotation = [{ id: rotationSkillId, skills: [{ castTime: 1_000, duration: 500 }] }];
                 }

                 const firstInput = { summary: summarizeRawFight(firstRaw), raw: firstRaw };
                 const secondInput = { summary: summarizeRawFight(secondRaw), raw: secondRaw };
                 const firstReport = buildReportFromFights([firstInput]);
                 const secondReport = buildReportFromFights([secondInput]);
                 const combined = buildReportFromFights([firstInput, secondInput]);
                 const account = String(firstPlayer.account);

                 const offenseRows = combined.stats.offensePlayers.filter((p) => p.account === account);
                 const supportRows = combined.stats.supportPlayers.filter((p) => p.account === account);
                 const healingRows = combined.stats.healingPlayers.filter((p) => p.account === account);
                 const generalRows = combined.stats.generalPlayers.filter((p) => p.account === account);
                 expect(offenseRows).toHaveLength(1);
                 expect(supportRows).toHaveLength(1);
                 expect(healingRows).toHaveLength(1);
                 expect(generalRows).toHaveLength(1);

                 const firstOffense = firstReport.stats.offensePlayers.find((p) => p.account === account)!;
                 const secondOffense = secondReport.stats.offensePlayers.find((p) => p.account === account)!;
                 expect(offenseRows[0].offenseTotals.damage).toBe(firstOffense.offenseTotals.damage + secondOffense.offenseTotals.damage);
                 expect(offenseRows[0].totalFightMs).toBe(firstOffense.totalFightMs + secondOffense.totalFightMs);
                 expect(offenseRows[0].professionList).toEqual(expect.arrayContaining([firstProfession, secondProfession]));
                 expect(supportRows[0].supportTotals.condiCleanse).toBe(7);
                 expect(supportRows[0].supportTotals.condiCleanseSelf).toBe(3);
                 expect(supportRows[0].supportTotals.boonStrips).toBe(12);
                 expect(healingRows[0].healingTotals.healing).toBe(3000);
                 expect(generalRows[0].logsJoined).toBe(2);

                 const modifierRows = combined.stats.damageModifiers?.rows.filter((row) => row.account === account) ?? [];
                 expect(combined.stats.damageModifiers?.totalFights).toBe(2);
                 expect(modifierRows).toHaveLength(2);
                 expect(modifierRows.find((row) => row.profession === firstProfession)).toMatchObject({ fightsJoined: 1, activeMs: 30_000 });
                 expect(modifierRows.find((row) => row.profession === secondProfession)).toMatchObject({ fightsJoined: 1, activeMs: 45_000 });

                 expect(combined.stats.rotations?.totalFights).toBe(2);
                 const rotationPlayers = combined.stats.rotations?.fights.flatMap((rotationFight) => rotationFight.players.filter((row) => row.account === account)) ?? [];
                 expect(rotationPlayers).toHaveLength(2);
                 expect(rotationPlayers.find((row) => row.profession === firstProfession)?.activeMs).toBe(30_000);
                 expect(rotationPlayers.find((row) => row.profession === secondProfession)?.activeMs).toBe(45_000);
           });

           it('keeps partial attendance distinct from full-session attendance', () => {
                 const firstRaw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const secondRaw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const partialPlayer = (firstRaw.players ?? []).find((p: any) => !p.notInSquad) as any;
                 expect(partialPlayer).toBeTruthy();
                 secondRaw.players = (secondRaw.players ?? []).filter((p: any) => p.account !== partialPlayer.account);

                 const combined = buildReportFromFights([
                         { summary: summarizeRawFight(firstRaw), raw: firstRaw },
                         { summary: summarizeRawFight(secondRaw), raw: secondRaw },
                 ]);
                 const partial = combined.stats.generalPlayers.find((p) => p.account === partialPlayer.account);
                 const full = combined.stats.generalPlayers.find((p) => p.account !== partialPlayer.account);
                 expect(partial?.logsJoined).toBe(1);
                 expect(full?.logsJoined).toBe(2);
                 expect(partial?.totalFightMs).toBeLessThan(full?.totalFightMs ?? 0);
           });

           it('builds a squad rotation timeline covering the same players', () => {
                 expect(report.stats.rotations?.fights.length).toBeGreaterThan(0);
                 const rotFight = report.stats.rotations!.fights[0];
                 expect(rotFight.players.length).toBeGreaterThan(0);
           });

           it('builds buff generation tables without throwing', () => {
                 expect(Array.isArray(report.stats.buffGeneration)).toBe(true);
           });

           it('treats Stability as EI-style average stacks, not presence percent', () => {
                 const raw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const player = (raw.players ?? []).find((p: any) => !p.notInSquad) as any;
                 expect(player).toBeTruthy();

                 const stabilityId = 1122;
                 (raw as any).buffMap = {
                         ...((raw as any).buffMap ?? {}),
                         [`b${stabilityId}`]: {
                                 name: 'Stability',
                                 icon: 'https://example.invalid/stability.png',
                                 classification: 'Boon',
                                 stacking: true,
                         },
                 };
                 player.buffUptimes = [
                         ...((player.buffUptimes ?? []) as any[]),
                         {
                                 id: stabilityId,
                                 buffData: [{ uptime: 0.12, presence: 3 }],
                         },
                 ];

                 const synthetic = buildReportFromFights([{ summary: summarizeRawFight(raw), raw }]);
                 const boons = synthetic.stats.buffCategoryUptimes?.Boons ?? synthetic.stats.boonUptimes;
                 expect(boons).toBeTruthy();
                 if (!boons) {
                         throw new Error('Expected boon uptime data to be populated');
                 }
                 const stability = boons.columns.find((c) => c.id === stabilityId);
                 expect(stability).toBeTruthy();
                 expect(stability!.stacking).toBe(true);

                 const row = boons.rows.find((r) => r.account === player.account);
                 expect(row).toBeTruthy();
                 expect(row!.uptimes[stabilityId]).toBeCloseTo(0.12);

                 const stabilityInsight = synthetic.stats.synergyInsights?.find((i) => i.id === 'stability');
                 expect(stabilityInsight?.detail).toContain('Stability stacks');
                 expect(stabilityInsight?.detail).not.toContain('% Stability uptime');
           });

           it('populates per-fight squad-stats drilldown skill sources', () => {
                 const firstFight = report.stats.fightBreakdown[0];
                 expect(firstFight).toBeTruthy();
                 expect(firstFight.topOutgoingDamageSkills?.length).toBeGreaterThan(0);
                 expect(firstFight.topIncomingDamageSkills?.length).toBeGreaterThan(0);
                 expect(firstFight.topOutgoingHealingSkills?.length).toBeGreaterThan(0);
                 expect(Array.isArray(firstFight.topOutgoingBarrierSkills)).toBe(true);
                 expect(firstFight.topOutgoingDamageSkills![0].name).toBeTruthy();
                 expect(firstFight.topIncomingDamageSkills![0].name).toBeTruthy();
                 expect(firstFight.topOutgoingHealingSkills![0].name).toBeTruthy();
           });

           it('keeps per-fight healing and barrier skill sources separate', () => {
                 const raw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const player = (raw.players ?? []).find((p: any) => !p.notInSquad) as any;
                 expect(player).toBeTruthy();

                 const healingSkillId = 7654301;
                 const barrierSkillId = 7654302;
                 (raw as any).skillMap = {
                         ...((raw as any).skillMap ?? {}),
                         [`s${healingSkillId}`]: { name: 'Regression Healing Source' },
                         [`s${barrierSkillId}`]: { name: 'Regression Barrier Source' },
                 };
                 player.extHealingStats = {
                         ...(player.extHealingStats ?? {}),
                         totalHealingDist: [[{ id: healingSkillId, totalHealing: 12345, hits: 12 }]],
                 };
                 player.extBarrierStats = {
                         ...(player.extBarrierStats ?? {}),
                         totalBarrierDist: [[{ id: barrierSkillId, totalBarrier: 6789, hits: 7 }]],
                 };

                 const synthetic = buildReportFromFights([{ summary: summarizeRawFight(raw), raw }]);
                 const firstFight = synthetic.stats.fightBreakdown[0];
                 expect(firstFight.topOutgoingHealingSkills?.find((skill) => skill.id === healingSkillId)?.healing).toBe(12345);
                 expect(firstFight.topOutgoingBarrierSkills?.find((skill) => skill.id === barrierSkillId)?.barrier).toBe(6789);
                 expect(firstFight.topOutgoingHealingSkills?.some((skill) => skill.id === barrierSkillId)).toBe(false);
           });

           it('prefers per-fight incoming skill sources from totalDamageTakenDist when both incoming shapes exist', () => {
                 const raw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const player = (raw.players ?? []).find((p: any) => !p.notInSquad) as any;
                 expect(player).toBeTruthy();

                 const skillId = 7654321;
                 const legacySkillId = 7654320;
                 (raw as any).skillMap = {
                         ...((raw as any).skillMap ?? {}),
                         [`s${legacySkillId}`]: { name: 'Legacy Incoming Shape', icon: 'https://example.invalid/legacy.png' },
                         [`s${skillId}`]: { name: 'Regression Incoming Spike', icon: 'https://example.invalid/incoming.png' },
                 };
                 player.totalDamageTaken = [[
                         { id: legacySkillId, totalDamage: 999999, connectedHits: 99, downContribution: 1 },
                 ]];
                 player.totalDamageTakenDist = [[
                         { id: skillId, totalDamage: 123456, connectedHits: 42, downContribution: 9876 },
                 ]];

                 const synthetic = buildReportFromFights([{ summary: summarizeRawFight(raw), raw }]);
                 const firstFight = synthetic.stats.fightBreakdown[0];
                 const incoming = firstFight.topIncomingDamageSkills?.find((skill) => skill.id === skillId);
                 expect(incoming).toBeTruthy();
                 expect(incoming!.name).toBe('Regression Incoming Spike');
                 expect(incoming!.damage).toBe(123456);
                 expect(incoming!.hits).toBe(42);
                 expect(incoming!.downContribution).toBe(9876);
                 expect(firstFight.topIncomingDamageSkills?.some((skill) => skill.id === legacySkillId)).toBe(false);
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

           it('keeps MVP down contribution as an absolute value, never a percent', () => {
                 const raw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const player = (raw.players ?? []).find((entry: any) => !entry.notInSquad) as any;
                 expect(player).toBeTruthy();
                 player.statsAll = player.statsAll ?? [{}];
                 player.statsAll[0] = { ...(player.statsAll[0] ?? {}), downContribution: 9_999_999 };

                 const synthetic = buildReportFromFights([{ summary: summarizeRawFight(raw), raw }]);
                 const mvp = synthetic.stats.fightHighlights?.find((highlight) => highlight.id === 'mvp-moment');
                 expect(mvp).toBeTruthy();
                 expect(mvp?.value).toBe(9_999_999);
                 expect(mvp?.valueFormat).toBe('number');
                 expect(mvp?.description).toContain('9,999,999 down contribution');
                 expect(mvp?.description).not.toContain('%');
           });

           it('uses canonical fight totals and target counts for commander squad metrics', () => {
                 const raw = JSON.parse(JSON.stringify(fight.raw)) as RawFightLog;
                 const commander = (raw.players ?? []).find((entry: any) => !entry.notInSquad) as any;
                 expect(commander).toBeTruthy();
                 commander.hasCommanderTag = true;
                 const aggregateTarget = (raw as any).targets?.[0];
                 expect(aggregateTarget).toBeTruthy();
                 (raw as any).targets = [
                         aggregateTarget,
                         { ...aggregateTarget, name: 'Enemy Player One', isFake: false },
                         { ...aggregateTarget, name: 'Enemy Player Two', isFake: false },
                 ];

                 const synthetic = buildReportFromFights([{ summary: summarizeRawFight(raw), raw }]);
                 const row = synthetic.stats.commanderStats.rows[0];
                 const fightRow = synthetic.stats.fightBreakdown[0];
                 expect(row).toBeTruthy();
                 expect(row.fightIndices).toEqual([0]);
                 expect(row.avgEnemySize).toBe(2);
                 expect(fightRow.enemyCount).toBe(2);
                 expect(row.squadKills).toBe(fightRow.enemyDeaths);
                 expect(row.squadDowns).toBe(fightRow.enemyDowns);
                 expect(row.alliesDown).toBe(fightRow.alliesDown);
                 expect(row.alliesDead).toBe(fightRow.alliesDead);
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
