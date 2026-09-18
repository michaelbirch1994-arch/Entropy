import type { WvWReport } from '../../types/report';
import type { Gw2Skill } from '../../types/buildEditor';
import { rechargeWindow } from './supportOpportunities';

export function skillCastTiming(report: WvWReport, account: string, skill: Gw2Skill) {
  const recharge = skill.facts?.find(f => f.type === 'Recharge')?.value;
  const cooldownMs = typeof recharge === 'number' && Number.isFinite(recharge) && recharge > 0 ? recharge * 1000 : null;
  const ordinary = ['Heal', 'Utility', 'Elite'].includes(skill.type ?? '') && !skill.flip_skill
    && !skill.bundle_skills?.length && !skill.transform_skills?.length
    && !skill.facts?.some(f => /recharge|count/i.test(f.type ?? '') && /ammo|ammunition/i.test(f.text ?? ''));
  const fights = (report.stats.rotations?.fights ?? []).flatMap(fight => {
    const player = fight.players.find(p => p.account === account);
    const casts = [...new Set((player?.casts ?? []).filter(c => c.skillId === skill.id).map(c => c.castTime)
      .filter(t => Number.isFinite(t) && t >= 0 && t <= fight.durationMs))].sort((a, b) => a - b);
    if (!casts.length) return [];
    const track = report.stats.replayFights?.find(f => f.fightId === fight.fightId)?.data.players.find(p => p.account === account);
    const gaps = casts.slice(1).map((next, index) => {
      const previous = casts[index];
      return { previousCastMs: previous, nextCastMs: next, gapMs: next - previous,
        referenceRecharge: ordinary && cooldownMs ? rechargeWindow(previous, next, cooldownMs, track?.effects ?? []) : null,
        survivalOverlap: track ? [...(track.downIntervals ?? []), ...(track.deadIntervals ?? [])]
          .some(([start, end]) => start < next && end > previous) : null,
      };
    }).sort((a, b) => b.gapMs - a.gapMs).slice(0, 3);
    return [{ fightId: fight.fightId, fightName: fight.fightName, durationMs: fight.durationMs,
      recordedCasts: casts.length, firstCastMs: casts[0], lastCastMs: casts.at(-1),
      totalInterCastGaps: Math.max(0, casts.length - 1), longestRecordedGaps: gaps }];
  });
  return { referenceCooldownMs: cooldownMs, rechargeComparison: ordinary && cooldownMs ? 'Conditional reference model' : 'Not modeled: missing cooldown or special skill access/recharge',
    fightsWithRecordedUse: fights.length, includedFights: fights.slice(0, 4),
    interpretation: 'Longest gaps between observed casts, not missed uses. Recharge model begins at cast start and assumes reference rules. Cast completion, trait reductions, resets, ammo, skill access and opportunity are not established. No casts are invented before first use or after last use.' };
}
