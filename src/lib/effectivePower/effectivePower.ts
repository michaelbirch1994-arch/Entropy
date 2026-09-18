export type EffectivePowerGameMode = "wvw" | "pve";

export interface EffectivePowerInput {
  power: number;
  precision: number;
  ferocity: number;
  gameMode: EffectivePowerGameMode;
  furyUptimePercent: number;
  mightStacks: number;
  mightUptimePercent: number;
  vulnerabilityStacks: number;
  bonusCriticalChancePercent: number;
  bonusCriticalDamagePercent: number;
  strikeDamageModifierPercent: number;
}

export interface EffectivePowerMarginal {
  stat: "power" | "precision" | "ferocity";
  next100EffectivePower: number;
  gain: number;
  gainPercent: number;
  gainPerPoint: number;
  relativeToPower: number;
}

export interface CriticalBreakpoint {
  criticalChancePercent: number;
  precisionToCap: number;
  excessPrecision: number;
}

export interface EffectivePowerResult {
  input: EffectivePowerInput;
  unbuffedEffectivePower: number;
  effectivePower: number;
  adjustedEffectivePower: number;
  averagePower: number;
  averageCriticalChancePercent: number;
  criticalDamagePercent: number;
  averageCriticalExpectation: number;
  vulnerabilityMultiplier: number;
  strikeModifierMultiplier: number;
  breakpoints: {
    withoutFury: CriticalBreakpoint;
    withFury: CriticalBreakpoint;
  };
  marginals: EffectivePowerMarginal[];
  bestNext100: EffectivePowerMarginal["stat"];
}

export const EFFECTIVE_POWER_RULESET = {
  id: "gw2-level-80-2026-09-17",
  level: 80,
  basePower: 1000,
  basePrecision: 1000,
  baseCriticalChancePercent: 5,
  precisionPerCriticalChancePercent: 21,
  baseCriticalDamagePercent: 150,
  ferocityPerCriticalDamagePercent: 15,
  mightPowerPerStack: 30,
  maximumMightStacks: 25,
  maximumVulnerabilityStacks: 25,
  furyCriticalChancePercent: { wvw: 20, pve: 25 } satisfies Record<EffectivePowerGameMode, number>,
  sources: [
    "https://wiki.guildwars2.com/wiki/Precision",
    "https://wiki.guildwars2.com/wiki/Ferocity",
    "https://wiki.guildwars2.com/wiki/Fury",
    "https://wiki.guildwars2.com/wiki/Might",
    "https://wiki.guildwars2.com/wiki/Vulnerability",
    "https://wiki.guildwars2.com/wiki/Damage_calculation",
  ],
} as const;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

export function normalizeEffectivePowerInput(input: EffectivePowerInput): EffectivePowerInput {
  return {
    power: clamp(input.power, 0, 100000),
    precision: clamp(input.precision, 0, 100000),
    ferocity: clamp(input.ferocity, 0, 100000),
    gameMode: input.gameMode === "pve" ? "pve" : "wvw",
    furyUptimePercent: clamp(input.furyUptimePercent, 0, 100),
    mightStacks: clamp(input.mightStacks, 0, EFFECTIVE_POWER_RULESET.maximumMightStacks),
    mightUptimePercent: clamp(input.mightUptimePercent, 0, 100),
    vulnerabilityStacks: clamp(input.vulnerabilityStacks, 0, EFFECTIVE_POWER_RULESET.maximumVulnerabilityStacks),
    bonusCriticalChancePercent: clamp(input.bonusCriticalChancePercent, -100, 100),
    bonusCriticalDamagePercent: clamp(input.bonusCriticalDamagePercent, 0, 500),
    strikeDamageModifierPercent: clamp(input.strikeDamageModifierPercent, -100, 1000),
  };
}

function criticalChance(input: EffectivePowerInput, furyActive: boolean) {
  const precisionChance = EFFECTIVE_POWER_RULESET.baseCriticalChancePercent
    + (input.precision - EFFECTIVE_POWER_RULESET.basePrecision) / EFFECTIVE_POWER_RULESET.precisionPerCriticalChancePercent;
  const fury = furyActive ? EFFECTIVE_POWER_RULESET.furyCriticalChancePercent[input.gameMode] : 0;
  return clamp(precisionChance + input.bonusCriticalChancePercent + fury, 0, 100);
}

function criticalDamage(input: EffectivePowerInput) {
  return Math.max(100, EFFECTIVE_POWER_RULESET.baseCriticalDamagePercent
    + input.ferocity / EFFECTIVE_POWER_RULESET.ferocityPerCriticalDamagePercent
    + input.bonusCriticalDamagePercent);
}

function breakpoint(input: EffectivePowerInput, furyActive: boolean): CriticalBreakpoint {
  const chance = criticalChance(input, furyActive);
  const fury = furyActive ? EFFECTIVE_POWER_RULESET.furyCriticalChancePercent[input.gameMode] : 0;
  const precisionAtCap = EFFECTIVE_POWER_RULESET.basePrecision
    + (100 - EFFECTIVE_POWER_RULESET.baseCriticalChancePercent - input.bonusCriticalChancePercent - fury)
      * EFFECTIVE_POWER_RULESET.precisionPerCriticalChancePercent;
  return {
    criticalChancePercent: chance,
    precisionToCap: Math.max(0, Math.ceil(precisionAtCap - input.precision)),
    excessPrecision: Math.max(0, Math.floor(input.precision - precisionAtCap)),
  };
}

interface CoreResult {
  input: EffectivePowerInput;
  unbuffedEffectivePower: number;
  effectivePower: number;
  adjustedEffectivePower: number;
  averagePower: number;
  averageCriticalChancePercent: number;
  criticalDamagePercent: number;
  averageCriticalExpectation: number;
  vulnerabilityMultiplier: number;
  strikeModifierMultiplier: number;
  breakpoints: EffectivePowerResult["breakpoints"];
}

function computeCore(rawInput: EffectivePowerInput): CoreResult {
  const input = normalizeEffectivePowerInput(rawInput);
  const furyUptime = input.furyUptimePercent / 100;
  const mightUptime = input.mightUptimePercent / 100;
  const critDamagePercent = criticalDamage(input);
  const critDamageMultiplier = critDamagePercent / 100;
  const states = [
    { fury: false, might: false, probability: (1 - furyUptime) * (1 - mightUptime) },
    { fury: true, might: false, probability: furyUptime * (1 - mightUptime) },
    { fury: false, might: true, probability: (1 - furyUptime) * mightUptime },
    { fury: true, might: true, probability: furyUptime * mightUptime },
  ];

  let effectivePower = 0;
  let averagePower = 0;
  let averageCriticalChancePercent = 0;
  let averageCriticalExpectation = 0;
  for (const state of states) {
    if (state.probability <= 0) continue;
    const power = input.power + (state.might ? input.mightStacks * EFFECTIVE_POWER_RULESET.mightPowerPerStack : 0);
    const chancePercent = criticalChance(input, state.fury);
    const expectation = 1 + (chancePercent / 100) * (critDamageMultiplier - 1);
    effectivePower += state.probability * power * expectation;
    averagePower += state.probability * power;
    averageCriticalChancePercent += state.probability * chancePercent;
    averageCriticalExpectation += state.probability * expectation;
  }

  const unbuffedChance = criticalChance(input, false) / 100;
  const unbuffedEffectivePower = input.power * (1 + unbuffedChance * (critDamageMultiplier - 1));
  const vulnerabilityMultiplier = 1 + input.vulnerabilityStacks / 100;
  const strikeModifierMultiplier = Math.max(0, 1 + input.strikeDamageModifierPercent / 100);
  return {
    input,
    unbuffedEffectivePower,
    effectivePower,
    adjustedEffectivePower: effectivePower * vulnerabilityMultiplier * strikeModifierMultiplier,
    averagePower,
    averageCriticalChancePercent,
    criticalDamagePercent: critDamagePercent,
    averageCriticalExpectation,
    vulnerabilityMultiplier,
    strikeModifierMultiplier,
    breakpoints: { withoutFury: breakpoint(input, false), withFury: breakpoint(input, true) },
  };
}

export function calculateEffectivePower(rawInput: EffectivePowerInput): EffectivePowerResult {
  const core = computeCore(rawInput);
  const base = core.adjustedEffectivePower;
  const powerPoint = computeCore({ ...core.input, power: core.input.power + 1 }).adjustedEffectivePower - base;
  const marginalInputs: Array<[EffectivePowerMarginal["stat"], EffectivePowerInput]> = [
    ["power", { ...core.input, power: core.input.power + 100 }],
    ["precision", { ...core.input, precision: core.input.precision + 100 }],
    ["ferocity", { ...core.input, ferocity: core.input.ferocity + 100 }],
  ];
  const marginals = marginalInputs.map(([stat, nextInput]) => {
    const next100EffectivePower = computeCore(nextInput).adjustedEffectivePower;
    const pointInput = stat === "power"
      ? { ...core.input, power: core.input.power + 1 }
      : stat === "precision"
        ? { ...core.input, precision: core.input.precision + 1 }
        : { ...core.input, ferocity: core.input.ferocity + 1 };
    const gainPerPoint = computeCore(pointInput).adjustedEffectivePower - base;
    return {
      stat,
      next100EffectivePower,
      gain: next100EffectivePower - base,
      gainPercent: base > 0 ? ((next100EffectivePower / base) - 1) * 100 : 0,
      gainPerPoint,
      relativeToPower: powerPoint > 0 ? gainPerPoint / powerPoint : 0,
    };
  });
  const bestNext100 = [...marginals].sort((a, b) => b.gain - a.gain)[0]?.stat ?? "power";
  return { ...core, marginals, bestNext100 };
}

export function compareEffectivePower(left: EffectivePowerResult, right: EffectivePowerResult) {
  const difference = right.adjustedEffectivePower - left.adjustedEffectivePower;
  return {
    difference,
    differencePercent: left.adjustedEffectivePower > 0 ? difference / left.adjustedEffectivePower * 100 : 0,
    stronger: difference === 0 ? "equal" as const : difference > 0 ? "right" as const : "left" as const,
  };
}
