import type { RotationCast } from '../../types/report';
import type { Gw2Skill } from '../../types/buildEditor';
import { assessCooldownInterval, type CooldownAssessmentContext } from './cooldownModifiers';

export type PlayerSkillStateContext = Omit<CooldownAssessmentContext, 'casts' | 'skillId' | 'skill'>;

/** A deliberately limited base-recharge scenario, never an availability verdict. */
export function playerSkillState(casts: RotationCast[], skillId: number, timeMs: number, skill?: Gw2Skill, context?: PlayerSkillStateContext) {
  const uses = [...new Set(casts.filter(c => c.skillId === skillId && Number.isFinite(c.castTime) && c.castTime >= 0).map(c => c.castTime))].sort((a,b) => a-b);
  const validTime = Number.isFinite(timeMs) && timeMs >= 0;
  const observed = validTime ? uses.filter(t => t <= timeMs) : [];
  const lastUseMs = observed.at(-1) ?? null;
  const recharge = skill?.id === skillId ? skill.facts?.find(f => f.type === 'Recharge')?.value : undefined;
  const baseMs = typeof recharge === 'number' && Number.isFinite(recharge) && recharge > 0 ? recharge * 1000 : null;
  const supported = skill?.id === skillId && baseMs !== null && !skill.bundle_skills?.length && !skill.transform_skills?.length
    && !skill.facts?.some(f => /ammo|ammunition/i.test(`${f.type} ${f.text}`));
  const gapAssessments = supported && baseMs !== null ? observed.slice(1).map((endMs, index) => {
    const startMs = observed[index], gapMs = endMs - startMs;
    const assessment = context ? assessCooldownInterval(startMs, endMs, baseMs, { ...context, casts, skillId, skill }) : null;
    const unexplained = assessment ? assessment.status === 'recharging' : gapMs < baseMs;
    return { startMs, endMs, gapMs, shorterByMs: Math.max(0, (assessment?.adjustedBaseMs ?? baseMs) - gapMs), unexplained, assessment };
  }) : [];
  const shortGaps = gapAssessments.filter(gap => gap.unexplained);
  const uncertainGaps = gapAssessments.filter(gap => gap.assessment?.status === 'uncertain');
  const reason = !validTime ? 'Invalid analysis time' : !skill || skill.id !== skillId ? 'Skill reference unavailable'
    : baseMs === null ? 'No positive recharge reference' : !supported ? 'Bundle, transform, or ammunition recharge is not modeled'
    : lastUseMs === null ? 'No recorded use before this moment' : shortGaps.length ? 'Recorded use remains earlier than the captured cooldown model permits' : null;
  const modeled = reason === null;
  const scenarioEndMs = supported && lastUseMs !== null ? lastUseMs + baseMs! : null;
  const scenarioRemainingMs = scenarioEndMs === null || !validTime ? null : Math.max(0, scenarioEndMs - timeMs);
  const adjusted = context && supported && baseMs !== null && lastUseMs !== null && validTime
    ? assessCooldownInterval(lastUseMs, timeMs, baseMs, { ...context, casts, skillId, skill }) : null;
  const referenceEndMs = modeled && !adjusted ? scenarioEndMs : null;
  const adjustedRemainingMs = adjusted ? adjusted.remainingMaxMs : null;
  const adjustedStatus = adjusted?.status === 'ready' ? 'adjusted-elapsed'
    : adjusted?.status === 'recharging' ? 'adjusted-recharging'
      : adjusted?.status === 'uncertain' ? 'adjusted-uncertain' : null;
  return { lastUseMs, recordedUses: observed.length, baseMs, reason,
    shortGapCount: shortGaps.length, recentShortGaps: shortGaps.slice(-3),
    uncertainGapCount: uncertainGaps.length, unexplainedGapEndMs: shortGaps.map(gap => gap.endMs),
    scenarioEndMs, scenarioRemainingMs,
    referenceEndMs, remainingMs: adjustedRemainingMs ?? (referenceEndMs === null ? null : Math.max(0, referenceEndMs - timeMs)),
    adjusted,
    status: shortGaps.length ? 'reference-conflict' : adjustedStatus ?? (referenceEndMs === null ? 'unknown' : timeMs < referenceEndMs ? 'base-recharging' : 'base-elapsed'),
    limitations: context
      ? 'Recharge starts at the recorded cast. API base recharge and timestamped Alacrity, Chill, Resistance, and completed supported resets are modeled. Uncaptured traits, sigils, hit/kill triggers, ammo, resource costs, chains, loadout changes, and historical balance rules remain unresolved. Elapsed does not mean usable.'
      : 'Reference recharge from cast start only. Completion, linked follow-ups, resource costs, chains, ammo, resets, traits, Alacrity/Chill, skill access and historical WvW rules are not verified. Elapsed does not mean usable.' };
}
