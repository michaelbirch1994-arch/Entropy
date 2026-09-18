import { describe, expect, it } from 'vitest';
import type { Gw2Skill } from '../../types/buildEditor';
import type { WvWReport } from '../../types/report';
import { firebrandTomeSkills } from '../axiforge/nestedMechanicSkills';
import { breaksAlliedStun, buildUtilityEffectiveness, conditionReference, grantsAegis, grantsResistance, grantsStability, hardControlReference } from '../insight/utilityEffectiveness';

const stabilitySkill: Gw2Skill = {
  id: 1, name: 'Hold the Line', description: 'Grant stability to nearby allies.', professions: ['Guardian'], slot: 'Utility',
  facts: [{ type: 'Buff', status: 'Stability', duration: 5 }],
};
const breakSkill: Gw2Skill = {
  id: 2, name: 'Fast Recovery', description: 'Breaks stun for nearby allies.', professions: ['Elementalist'], slot: 'Utility', facts: [],
};
const enemyControlSkill: Gw2Skill = {
  id: 3, name: 'Driving Hammer', description: 'Smash your target and knock them back.', professions: ['Revenant'], slot: 'Weapon_5',
  facts: [{ type: 'Distance', text: 'Knockback', value: 450 }],
};
const aegisSkill: Gw2Skill = {
  id: 4, name: 'Advance', description: 'Grant aegis to nearby allies.', professions: ['Guardian'], slot: 'Utility',
  facts: [{ type: 'Buff', status: 'Aegis', duration: 5 }],
};
const enemyStrikeSkill: Gw2Skill = {
  id: 5, name: 'Heavy Slash', description: 'Strike your target.', professions: ['Warrior'], slot: 'Weapon_1', facts: [],
};
const resistanceSkill: Gw2Skill = {
  id: 6, name: 'Shared Resolve', description: 'Grant resistance to nearby allies.', professions: ['Guardian'], slot: 'Utility',
  facts: [{ type: 'Buff', status: 'Resistance', duration: 3 }],
};
const enemyChillSkill: Gw2Skill = {
  id: 7, name: 'Frozen Strike', description: 'Strike your target and chill them.', professions: ['Elementalist'], slot: 'Weapon_2',
  icon: '/frozen-strike.png', facts: [{ type: 'Buff', status: 'Chilled', duration: 2 }],
};

function report(): WvWReport {
  return { meta: { id: 'r' }, stats: {
    rotations: { skillMeta: {}, fights: [{ fightId: 'f', fightName: 'Test fight', durationMs: 20_000, players: [
      { account: 'Support.1', profession: 'Firebrand', professionList: ['Firebrand'], casts: [
        { skillId: 1, castTime: 1_000, duration: 0 }, { skillId: 4, castTime: 1_500, duration: 0 },
        { skillId: 2, castTime: 7_000, duration: 0 }, { skillId: 4, castTime: 10_000, duration: 0 },
        { skillId: 1, castTime: 12_000, duration: 0 },
      ] },
      { account: 'Target.2', profession: 'Druid', professionList: ['Druid'], casts: [] },
    ] }] },
    mechanics: { fights: [{ fightId: 'f', fightName: 'Test fight', durationMs: 20_000, mechanics: [{
      key: 'stun', def: { name: 'Lockout', fullName: 'Knocked Back / Lockout', severity: 'Sev2' }, events: [
        { time: 4_000, actor: 'Target', account: 'Target.2', isPlayer: true },
        { time: 6_500, actor: 'Target', account: 'Target.2', isPlayer: true },
      ],
    }] }] },
    incomingSkillEvents: { fights: [{ fightId: 'f', fightName: 'Test fight', clockSource: 'squad-combat-start', events: [
      { timeMs: 3_000, sourceName: 'Enemy', targetName: 'Target', targetAccount: 'Target.2', skillId: 5, skillName: 'Heavy Slash', result: 3, amount: 0, isBuff: false },
      { timeMs: 4_000, sourceName: 'Enemy', targetName: 'Target', targetAccount: 'Target.2', skillId: 3, skillName: 'Driving Hammer', result: 0, amount: 500, isBuff: false },
      { timeMs: 6_500, sourceName: 'Enemy', targetName: 'Target', targetAccount: 'Target.2', skillId: 3, skillName: 'Driving Hammer', result: 12, amount: 0, isBuff: false },
      { timeMs: 11_000, sourceName: 'Enemy', targetName: 'Target', targetAccount: 'Target.2', skillId: 5, skillName: 'Heavy Slash', result: 0, amount: 900, isBuff: false },
    ] }] },
    replayFights: [{ fightId: 'f', fightName: 'Test fight', data: { durationMs: 20_000, players: [
      { account: 'Support.1', name: 'Support', profession: 'Firebrand', inSquad: true, isCommander: false, points: [], facings: [], casts: [], downIntervals: [], deadIntervals: [], effects: [] },
      { account: 'Target.2', name: 'Target', profession: 'Druid', inSquad: true, isCommander: false, points: [], facings: [], casts: [], downIntervals: [], deadIntervals: [], effects: [
        { id: 1122, name: 'Stability', classification: 'Boon', states: [[0, 0], [1_100, 2], [4_050, 1], [6_000, 0]] },
        { id: 743, name: 'Aegis', classification: 'Boon', states: [[0, 0], [1_600, 1], [3_025, 0], [10_100, 1], [15_000, 0]] },
      ] },
    ], enemies: [], map: null, mechanics: [], bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 }, skillMeta: {} } }],
    supportPlayers: [{ account: 'Support.1', profession: 'Firebrand', professionList: ['Firebrand'], activeMs: 20_000, logsJoined: 1,
      supportTotals: { condiCleanse: 0, condiCleanseTime: 0, condiCleanseSelf: 0, condiCleanseTimeSelf: 0, boonStrips: 0, boonStripsTime: 0,
        boonStripDownContribution: 0, boonStripDownContributionTime: 0, stunBreak: 2, removedStunDuration: 2.4, resurrects: 0, resurrectTime: 0 } }],
    buffGeneration: [{ id: '1122', name: 'Stability', stacking: true, classification: 'Boons', rows: [{ account: 'Support.1', profession: 'Firebrand', activeTimeMs: 20_000,
      numFights: 1, groupSupported: 5, squadSupported: 10, categories: {
        selfBuffs: { generationMs: 0, wastedMs: 0, overstackMs: 0 }, groupBuffs: { generationMs: 8_000, wastedMs: 2_000, overstackMs: 0 },
        squadBuffs: { generationMs: 2_000, wastedMs: 0, overstackMs: 0 },
      } }] }, { id: '743', name: 'Aegis', stacking: false, classification: 'Boons', rows: [{ account: 'Support.1', profession: 'Firebrand', activeTimeMs: 20_000,
        numFights: 1, groupSupported: 5, squadSupported: 10, categories: {
          selfBuffs: { generationMs: 0, wastedMs: 0, overstackMs: 0 }, groupBuffs: { generationMs: 6_000, wastedMs: 2_000, overstackMs: 0 },
          squadBuffs: { generationMs: 2_000, wastedMs: 0, overstackMs: 0 },
        } }] }],
    attendanceData: [
      { account: 'Support.1', characterNames: ['Support'], combatTimeMs: 20_000, squadTimeMs: 20_000, classTimes: [{ profession: 'Firebrand', timeMs: 20_000 }], group: 1 },
      { account: 'Target.2', characterNames: ['Target'], combatTimeMs: 20_000, squadTimeMs: 20_000, classTimes: [{ profession: 'Druid', timeMs: 20_000 }], group: 1 },
    ],
  } } as unknown as WvWReport;
}

describe('utility effectiveness', () => {
  it('recognizes only ally-facing Stability and stun-break references', () => {
    expect(grantsStability(stabilitySkill)).toBe(true);
    expect(grantsStability({ ...stabilitySkill, id: 4, description: 'Gain stability.' })).toBe(false);
    expect(grantsStability({ ...stabilitySkill, id: 5, description: 'Grant protection to nearby allies. Gain stability.' })).toBe(false);
    expect(grantsAegis(aegisSkill)).toBe(true);
    expect(grantsAegis({ ...aegisSkill, description: 'Gain aegis.' })).toBe(false);
    expect(grantsResistance(resistanceSkill)).toBe(true);
    expect(grantsResistance({ ...resistanceSkill, description: 'Gain resistance.' })).toBe(false);
    expect(grantsResistance(firebrandTomeSkills().find(skill => skill.id === 40988)!)).toBe(true);
    expect(breaksAlliedStun(breakSkill)).toBe(true);
    expect(breaksAlliedStun({ ...breakSkill, id: 3, description: 'Breaks stun.' })).toBe(false);
    expect(breaksAlliedStun({ ...breakSkill, id: 6, description: 'Break stuns on yourself and grant stability to nearby allies.' })).toBe(false);
    expect(hardControlReference(enemyControlSkill)).toMatchObject({ types: ['knockback'], source: 'api-facts', conditional: false });
    expect(hardControlReference({ ...enemyControlSkill, facts: [], traited_facts: [{ type: 'Buff', status: 'Daze', requires_trait: 99 }] }))
      .toMatchObject({ types: ['daze'], source: 'api-traited-facts', conditional: true });
    expect(hardControlReference(breakSkill).types).toEqual([]);
    expect(hardControlReference({
      ...stabilitySkill,
      facts: [{ type: 'Buff', status: 'Stability', description: 'Cannot be knocked down, pushed back, pulled, launched, stunned, dazed, floated, sunk, feared, or taunted.' }],
    }).types).toEqual([]);
    expect(conditionReference(enemyChillSkill)).toMatchObject({ conditions: ['Chilled'], source: 'api-facts', conditional: false });
    expect(conditionReference({ ...enemyChillSkill, facts: [], description: 'Remove chilled from yourself.' }).conditions).toEqual([]);
  });

  it('measures Resistance against observed non-damaging condition pressure without assigning unique source credit', () => {
    const input = report();
    input.stats.rotations!.fights[0].players[0].casts.push(
      { skillId: 6, castTime: 900, duration: 0 },
      { skillId: 6, castTime: 7_900, duration: 0 },
    );
    input.stats.incomingSkillEvents!.fights[0].events.push({ timeMs: 2_000, sourceName: 'Enemy', targetName: 'Target', targetAccount: 'Target.2',
      skillId: 7, skillName: 'Frozen Strike', result: 0, amount: 200, isBuff: false });
    input.stats.incomingSkillEvents!.fights[0].events.push({ timeMs: 6_000, sourceName: 'Enemy Two', targetName: 'Target', targetAccount: 'Target.2',
      skillId: 8, skillName: 'Uncatalogued Hex', result: 0, amount: 150, isBuff: false });
    input.stats.replayFights![0].data.players[1].effects.push(
      { id: 26980, name: 'Resistance', classification: 'Boon', states: [[0, 0], [1_000, 1], [4_000, 0], [8_000, 1], [10_000, 0]] },
      { id: 722, name: 'Chilled', classification: 'Condition', states: [[0, 0], [2_000, 1], [5_000, 0], [9_000, 1], [11_000, 0]] },
      { id: 742, name: 'Weakness', classification: 'Condition', states: [[0, 0], [3_000, 1], [3_500, 0], [6_000, 1], [7_000, 0]] },
    );
    input.stats.buffGeneration!.push({ id: '26980', name: 'Resistance', stacking: false, classification: 'Boons', rows: [{
      account: 'Support.1', profession: 'Firebrand', activeTimeMs: 20_000, numFights: 1, groupSupported: 5, squadSupported: 10,
      categories: {
        selfBuffs: { generationMs: 0, wastedMs: 0, overstackMs: 0 },
        groupBuffs: { generationMs: 4_000, wastedMs: 1_000, overstackMs: 0 },
        squadBuffs: { generationMs: 1_000, wastedMs: 0, overstackMs: 0 },
      },
    }] });

    const result = buildUtilityEffectiveness(input, 'f', [stabilitySkill, breakSkill, enemyControlSkill, aegisSkill, enemyStrikeSkill, resistanceSkill, enemyChillSkill]);
    expect(result.coverage).toMatchObject({ resistanceTrackedPlayers: 1, conditionTrackedPlayers: 1,
      observedConditionIntervals: 4, observedConditionArrivals: 4, conditionPressureMs: 6_500, suppressedConditionMs: 3_500 });
    expect(result.overall.resistance).toMatchObject({ providerAccounts: ['Support.1'], conditionPressureMs: 6_500,
      suppressedConditionMs: 3_500, conditionArrivals: 4, coveredArrivals: 3, readinessRating: .75,
      casts: 2, alignedCasts: 2, conditionTrackedPlayers: 1, resistanceTrackedPlayers: 1 });
    expect(result.overall.resistance.effectiveRating).toBeCloseTo(3_500 / 6_500);
    expect(result.overall.resistance.conditions).toMatchObject([
      { condition: 'Chilled', affectedPlayers: 1, conditionPressureMs: 5_000, suppressedConditionMs: 3_000,
        conditionArrivals: 2, coveredArrivals: 2, readinessRating: 1, attributedArrivals: 1, verifiedArrivals: 1,
        candidateArrivals: 0, ambiguousArrivals: 0,
        sources: [{ skillId: 7, skillName: 'Frozen Strike', matchedArrivals: 1, coveredArrivals: 1,
          unprotectedArrivals: 0, averageCertainty: 95, sourceNames: ['Enemy'], targetAccounts: ['Target.2'] }] },
      { condition: 'Weakness', affectedPlayers: 1, conditionPressureMs: 1_500, suppressedConditionMs: 500,
        conditionArrivals: 2, coveredArrivals: 1, readinessRating: .5, attributedArrivals: 1, verifiedArrivals: 0,
        candidateArrivals: 1, ambiguousArrivals: 0, sources: [{ skillId: 8, skillName: 'Uncatalogued Hex', matchedArrivals: 1,
          coveredArrivals: 0, unprotectedArrivals: 1, averageCertainty: 60, sourceNames: ['Enemy Two'], targetAccounts: ['Target.2'],
          referenceSource: 'timing-candidate' }] },
    ]);
    expect(result.overall.resistance.conditions[0].effectiveRating).toBeCloseTo(.6);
    expect(result.overall.resistance.conditions[0].attributionCoverage).toBeCloseTo(.5);
    expect(result.overall.resistance.conditions[1].effectiveRating).toBeCloseTo(1 / 3);
    expect(result.coverage).toMatchObject({ verifiedConditionArrivals: 1, candidateConditionArrivals: 1,
      attributedConditionArrivals: 2, ambiguousConditionArrivals: 0 });
    expect(result.resistance[0]).toMatchObject({ account: 'Support.1', casts: 2, pressureAlignedCasts: 2,
      conditionPressureMs: 4_300, suppressedConditionMs: 3_400, conditionArrivals: 3, coveredArrivals: 3,
      readinessRating: 1, correlatedRecipientGains: 2, generatedSeconds: 5, wastedSeconds: 1 });
    expect(result.resistance[0].conditions).toMatchObject([
      { condition: 'Chilled', conditionPressureMs: 3_800, suppressedConditionMs: 2_900, conditionArrivals: 2, coveredArrivals: 2 },
      { condition: 'Weakness', conditionPressureMs: 500, suppressedConditionMs: 500, conditionArrivals: 1, coveredArrivals: 1 },
    ]);
    expect(result.resistance[0].effectiveRating).toBeCloseTo(3_400 / 4_300);
    expect(result.resistance[0].applications).toMatchObject([
      { skillId: 6, timeMs: 900, endMs: 3_900, conditionNames: ['Chilled', 'Weakness'],
        conditionPressureMs: 2_400, suppressedConditionMs: 2_400, conditionArrivals: 2, coveredArrivals: 2 },
      { skillId: 6, timeMs: 7_900, endMs: 10_900, conditionNames: ['Chilled'],
        conditionPressureMs: 1_900, suppressedConditionMs: 1_000, conditionArrivals: 1, coveredArrivals: 1 },
    ]);
    expect(result.resistance[0].applications[0].conditions).toMatchObject([
      { condition: 'Chilled', conditionPressureMs: 1_900, suppressedConditionMs: 1_900 },
      { condition: 'Weakness', conditionPressureMs: 500, suppressedConditionMs: 500 },
    ]);
  });

  it('keeps timing, candidate negations, aggregate prevention, and correlated delay separate', () => {
    const result = buildUtilityEffectiveness(report(), 'f', [stabilitySkill, breakSkill, enemyControlSkill, aegisSkill, enemyStrikeSkill]);
    expect(result.coverage).toMatchObject({ controlEvents: 2, targetableControlEvents: 2, stabilityCoveredControlEvents: 1,
      ambiguousStabilityGains: 0, ambiguousStabilityLossUnits: 0,
      stabilityTrackedPlayers: 1, replayRosterPlayers: 2, incomingControlSource: 'native-evtc', incomingControlAttempts: 2,
      realizedInterceptions: 1, resolvedControlContests: 2, successfulControls: 1, unresolvedAttempts: 0, evidenceCoverage: 1 });
    expect(result.provenance.map(source => source.kind)).toEqual([
      'recorded-event', 'parser-derived-state', 'arena-net-api', 'wvw-override', 'bounded-inference',
    ]);
    expect(result.stability[0]).toMatchObject({ account: 'Support.1', casts: 2, pressureAlignedCasts: 1, pressureTimingRating: .5,
      pressureCoveredControls: 1, pressureCoverageRating: 1, threatAttempts: 1, protectedAttempts: 1,
      resolvedControlContests: 1, realizedInterceptions: 1, realizedEffectiveness: 1,
      correlatedRecipientGains: 1, candidateNegatedControls: 1, generatedStackSeconds: 10, wastedStackSeconds: 2 });
    expect(result.stability[0].applications).toMatchObject([
      { skillId: 1, timeMs: 1_000, endMs: 6_000, correlatedRecipientGains: 1, candidateNegatedControls: 1,
        controlAttempts: [{ timeMs: 4_000, targetAccount: 'Target.2', skillName: 'Driving Hammer', outcome: 'intercepted' }] },
      { skillId: 1, timeMs: 12_000, endMs: 17_000, correlatedRecipientGains: 0, candidateNegatedControls: 0, controlAttempts: [] },
    ]);
    expect(result.stability[0].generationEfficiency).toBeCloseTo(10 / 12);
    expect(result.coverage).toMatchObject({ aegisTrackedPlayers: 1, incomingAttackSource: 'native-evtc', incomingAttackAttempts: 4,
      confirmedAegisBlocks: 1, ambiguousAegisBlocks: 0 });
    expect(result.aegis[0]).toMatchObject({ account: 'Support.1', casts: 2, realizedCasts: 1, castConversion: .5,
      confirmedBlocks: 1, threatAttempts: 4, readyAttempts: 2, readinessRating: .5,
      landedWhileAegisPresent: 1, correlatedRecipientGains: 2, generatedSeconds: 8, wastedSeconds: 2 });
    expect(result.aegis[0].applications).toMatchObject([
      { skillId: 4, timeMs: 1_500, endMs: 6_500, confirmedBlocks: 1, correlatedRecipientGains: 1 },
      { skillId: 4, timeMs: 10_000, endMs: 15_000, confirmedBlocks: 0, correlatedRecipientGains: 1 },
    ]);
    expect(result.stunbreak[0]).toMatchObject({ account: 'Support.1', confirmedBreaks: 2, removedControlSeconds: 2.4,
      averagePreventedSeconds: 1.2, correlatedResponses: 2, averageCorrelatedDelayMs: 1750, responseShare: 1 });
    expect(result.stunbreak[0].responseEvents).toMatchObject([
      { eventTimeMs: 4_000, targetAccount: 'Target.2', label: 'Knocked Back / Lockout', castTimeMs: 7_000, delayMs: 3_000,
        skillId: 2, skillName: 'Fast Recovery' },
      { eventTimeMs: 6_500, targetAccount: 'Target.2', label: 'Knocked Back / Lockout', castTimeMs: 7_000, delayMs: 500,
        skillId: 2, skillName: 'Fast Recovery' },
    ]);
    expect(result.subgroups).toMatchObject([{ group: 1, label: 'Party 1', memberCount: 2,
      stability: { providerAccounts: ['Support.1'], effectiveRating: .5, coveredControls: 1, eligibleControls: 2, casts: 2, alignedCasts: 1 },
      stunbreak: { providerAccounts: ['Support.1'], effectiveRating: 1, matchedResponses: 2, eligibleControls: 2, confirmedBreaks: 2 } }]);
    expect(result.overall).toMatchObject({ group: null, label: 'Overall', memberCount: 2,
      stability: { effectiveRating: .5 }, aegis: { castConversion: .5, confirmedBlocks: 1, threatAttempts: 4, readyAttempts: 2 },
      stunbreak: { effectiveRating: 1 } });
  });

  it('keeps subgroup ratings scoped while the overall rating retains cross-party timing', () => {
    const input = report();
    input.stats.attendanceData.push({ account: 'Target.3', characterNames: ['Other target'], combatTimeMs: 20_000, squadTimeMs: 20_000,
      classTimes: [{ profession: 'Scrapper', timeMs: 20_000 }], group: 2 });
    input.stats.mechanics!.fights[0].mechanics[0].events.push({ time: 13_000, actor: 'Other target', account: 'Target.3', isPlayer: true });
    input.stats.incomingSkillEvents!.fights[0].events.push({ timeMs: 13_000, sourceName: 'Enemy', targetName: 'Other target', targetAccount: 'Target.3',
      skillId: 3, skillName: 'Driving Hammer', result: 12, amount: 0, isBuff: false });
    const result = buildUtilityEffectiveness(input, 'f', [stabilitySkill, breakSkill, enemyControlSkill]);
    expect(result.subgroups.map(scope => ({ group: scope.group, stability: scope.stability.effectiveRating, stunbreak: scope.stunbreak.effectiveRating })))
      .toEqual([{ group: 1, stability: .5, stunbreak: 1 }, { group: 2, stability: 0, stunbreak: 0 }]);
    expect(result.overall.stability.effectiveRating).toBeCloseTo(1 / 3);
    expect(result.overall.stunbreak.effectiveRating).toBeCloseTo(2 / 3);
  });

  it('keeps missing boon timelines out of readiness denominators and exposes bounds', () => {
    const input = report();
    input.stats.rotations!.fights[0].players[0].casts.push({ skillId: 6, castTime: 4_500, duration: 0 });
    input.stats.attendanceData.push({ account: 'Unknown.3', characterNames: ['Unknown target'], combatTimeMs: 20_000,
      squadTimeMs: 20_000, classTimes: [{ profession: 'Scrapper', timeMs: 20_000 }], group: 1 });
    input.stats.replayFights![0].data.players.push({ account: 'Unknown.3', name: 'Unknown target', profession: 'Scrapper',
      inSquad: true, isCommander: false, points: [], facings: [], casts: [], downIntervals: [], deadIntervals: [], effects: [
        { id: 722, name: 'Chilled', classification: 'Condition', states: [[5_000, 1], [6_000, 0]] },
      ] });
    input.stats.incomingSkillEvents!.fights[0].events.push(
      { timeMs: 5_000, sourceName: 'Enemy', targetName: 'Unknown target', targetAccount: 'Unknown.3',
        skillId: 3, skillName: 'Driving Hammer', result: 12, amount: 0, isBuff: false },
      { timeMs: 5_200, sourceName: 'Enemy', targetName: 'Unknown target', targetAccount: 'Unknown.3',
        skillId: 5, skillName: 'Heavy Slash', result: 0, amount: 900, isBuff: false },
    );

    const result = buildUtilityEffectiveness(input, 'f', [stabilitySkill, breakSkill, enemyControlSkill, aegisSkill,
      enemyStrikeSkill, resistanceSkill, enemyChillSkill]);

    expect(result.overall.stability).toMatchObject({ threatAttempts: 3, knownThreatAttempts: 2, unknownThreatAttempts: 1,
      protectedAttempts: 1, readinessRating: .5, readinessEvidenceCoverage: 2 / 3, readinessBounds: [1 / 3, 2 / 3] });
    expect(result.overall.aegis).toMatchObject({ threatAttempts: 6, knownThreatAttempts: 4, unknownThreatAttempts: 2,
      readyAttempts: 2, readinessRating: .5, readinessEvidenceCoverage: 2 / 3, readinessBounds: [1 / 3, 2 / 3] });
    expect(result.overall.resistance).toMatchObject({ conditionArrivals: 1, knownArrivals: 0, unknownArrivals: 1,
      coveredArrivals: 0, readinessRating: null, readinessEvidenceCoverage: 0, readinessBounds: [0, 1] });
    expect(result.overall.resistance.conditions[0]).toMatchObject({ condition: 'Chilled', knownArrivals: 0,
      unknownArrivals: 1, readinessRating: null, readinessBounds: [0, 1] });
  });

  it('quantifies legacy reports from mechanic and boon timelines without claiming native confirmation', () => {
    const input = report();
    delete input.stats.incomingSkillEvents;
    const result = buildUtilityEffectiveness(input, 'f', [stabilitySkill, breakSkill, enemyControlSkill, aegisSkill, enemyStrikeSkill]);
    expect(result.coverage).toMatchObject({
      incomingControlSource: 'mechanic-boon-inference',
      realizedInterceptions: 0,
      inferredStabilityInterceptions: 0,
      evidenceCoverage: .5,
      incomingAttackSource: 'boon-transition-inference',
      confirmedAegisBlocks: 0,
      inferredAegisConsumptions: 1,
      aegisEvidenceCoverage: .5,
    });
    expect(result.overall.stability).toMatchObject({ effectiveRating: 0, coveredControls: 0, eligibleControls: 2 });
    expect(result.stability[0]).toMatchObject({ realizedInterceptions: 0, inferredInterceptions: 0,
      realizedEffectiveness: 0, successfulControls: 1 });
    expect(result.overall.aegis).toMatchObject({ castConversion: .5, realizedCasts: 1, casts: 2,
      confirmedBlocks: 0, inferredConsumptions: 1, evidenceCoverage: .5 });
    expect(result.aegis[0].applications).toMatchObject([
      { timeMs: 1_500, confirmedBlocks: 0, inferredConsumptions: 1 },
      { timeMs: 10_000, confirmedBlocks: 0, inferredConsumptions: 0 },
    ]);
  });

  it('does not invent ratings when there is no recorded control pressure', () => {
    const input = report();
    input.stats.mechanics!.fights[0].mechanics = [];
    input.stats.incomingSkillEvents!.fights[0].events = [];
    const result = buildUtilityEffectiveness(input, 'f', [stabilitySkill, breakSkill, enemyControlSkill]);
    expect(result.stability[0].pressureTimingRating).toBeNull();
    expect(result.overall.stability.effectiveRating).toBeNull();
    expect(result.stunbreak[0].averageCorrelatedDelayMs).toBeNull();
    expect(result.stunbreak[0].responseShare).toBeNull();
  });

  it('prefers selected-fight replay subgroups over report-aggregate assignments', () => {
    const input = report();
    input.stats.replayFights![0].data.players[0].group = 2;
    input.stats.replayFights![0].data.players[1].group = 2;

    const result = buildUtilityEffectiveness(input, 'f', [stabilitySkill, breakSkill, enemyControlSkill]);

    expect(result.subgroupEvidence).toEqual({ source: 'fight-replay', fightAssignments: 2, aggregateFallbacks: 0, unresolved: 0 });
    expect(result.stability[0].group).toBe(2);
    expect(result.subgroups.map(scope => scope.group)).toEqual([2]);
  });

  it('keeps aggregate subgroup fallback for reports built before replay groups were persisted', () => {
    const input = report();
    const result = buildUtilityEffectiveness(input, 'f', [stabilitySkill, breakSkill, enemyControlSkill]);

    expect(result.subgroupEvidence).toEqual({ source: 'report-aggregate', fightAssignments: 0, aggregateFallbacks: 2, unresolved: 0 });
    expect(result.stability[0].group).toBe(1);
  });

  it('reuses a completed analysis for the same immutable report and reference set', () => {
    const input = report();
    const references = [stabilitySkill, breakSkill, enemyControlSkill];
    const first = buildUtilityEffectiveness(input, 'f', references);
    expect(buildUtilityEffectiveness(input, 'f', [...references].reverse())).toBe(first);
  });
});
