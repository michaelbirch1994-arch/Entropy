import type { WvWReport } from '../../types/report';
import type { Gw2Skill } from '../../types/buildEditor';
import type { InsightEvidence } from './evidence';
import { fetchGw2Skills } from '../gw2/gw2Api';
import { skillCastTiming } from './skillCastTiming';

export function investigationSkillIds(report: WvWReport, account: string): number[] {
  const counts = new Map<number, number>();
  for (const fight of report.stats.rotations?.fights ?? []) {
    for (const cast of fight.players.find(p => p.account === account)?.casts ?? []) {
      if (Number.isSafeInteger(cast.skillId) && cast.skillId > 0) counts.set(cast.skillId, (counts.get(cast.skillId) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 20).map(([id]) => id);
}

export function skillKnowledgeRecord(ids: number[], skills: Gw2Skill[], status = 'loaded', context?: { report: WvWReport; account: string }): InsightEvidence {
  const records = skills.filter(s => ids.includes(s.id)).map(s => ({
    skillId: s.id, name: s.name, description: s.description?.slice(0, 1000), type: s.type, slot: s.slot,
    facts: s.facts?.slice(0, 16).map(f => ({ type: f.type, text: f.text, value: f.value, duration: f.duration, status: f.status, apply_count: f.apply_count })),
    bundleSkillIds: s.bundle_skills, transformSkillIds: s.transform_skills, flipSkillId: s.flip_skill,
    source: `https://api.guildwars2.com/v2/skills/${s.id}`,
    ...(context ? { recordedTiming: skillCastTiming(context.report, context.account, s) } : {}),
  }));
  // Reserve a small, predictable budget for references without renumbering combat evidence.
  while (new TextEncoder().encode(JSON.stringify(records)).length > 18000) records.pop();
  return { id: 'K1', label: 'Skill reference knowledge (API facts, not fight state)', data: {
    status, retrievedAt: status === 'loaded' ? new Date().toISOString() : null,
    requestedSkillIds: ids, includedSkills: records,
    unresolvedSkillIds: ids.filter(id => !records.some(s => s.skillId === id)),
    selection: 'Up to 20 most frequently recorded skill IDs for this player; not a complete loadout.',
    limitations: ['Reference API facts are not certified for the fight game mode, balance patch or traits.',
      'A skill cast proves recorded use, not ongoing equipment or skill availability.',
      'Bundle, transform and flip skills require access to the relevant state.',
      'Do not use a reference cooldown to prove a missed save. Conditional cooldown evidence retains its own assumptions.',
      'Descriptions and facts can explain a skill; they do not establish who received its effects.'],
  } };
}

export async function loadSkillKnowledge(report: WvWReport, account: string): Promise<InsightEvidence> {
  const ids = investigationSkillIds(report, account);
  if (!ids.length) return skillKnowledgeRecord([], [], 'No timestamped skills recorded');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const skills = await Promise.race([fetchGw2Skills(ids), new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Reference timeout')), 8000);
    })]);
    return skillKnowledgeRecord(ids, skills, 'loaded', { report, account });
  } catch { return skillKnowledgeRecord(ids, [], 'References unavailable; use combat evidence only'); }
  finally { clearTimeout(timeout); }
}
