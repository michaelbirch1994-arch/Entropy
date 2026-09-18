import { useEffect, useState } from 'react';
import { BookOpen, LoaderCircle } from 'lucide-react';
import { fetchGw2Skills } from '../../lib/gw2/gw2Api';
import type { Gw2Skill } from '../../types/buildEditor';
import InsightEvidenceDetails from './InsightEvidenceDetails';

export function evidenceSkillIds(data: unknown): number[] {
  const ids = new Set<number>();
  const add = (value: unknown) => { const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value; if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) ids.add(id); };
  const visit = (value: unknown, context = '') => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(item => visit(item, context)); return; }
    const row = value as Record<string, unknown>;
    if (row.isIndirect !== true) {
      add(row.skillId);
      if (['skills', 'nearbyCasts'].includes(context)) add(row.id);
    }
    Object.entries(row).forEach(([key, child]) => { if (child && typeof child === 'object') visit(child, key); });
  };
  visit(data);
  return [...ids].slice(0, 20);
}

export default function SkillReferences({ data }: { data: unknown }) {
  const ids = evidenceSkillIds(data);
  const [skills, setSkills] = useState<Gw2Skill[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [requested, setRequested] = useState(false);
  const key = ids.join(',');
  useEffect(() => {
    if (!requested || !key) return;
    let active = true;
    setBusy(true);
    fetchGw2Skills(key.split(',').map(Number)).then(result => { if (active) setSkills(result); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [key, requested]);
  if (!ids.length) return null;
  return <section className="insight-skill-references">
    <h3><BookOpen size={16}/> Skill reference</h3>
    <p>API reference facts may differ from this fight's mode, traits or balance patch. Recharge does not establish skill access.</p>
    {!requested && <button type="button" onClick={() => setRequested(true)}><BookOpen size={15}/>Load references ({ids.length})</button>}
    {busy && <p role="status"><LoaderCircle size={15}/> Loading skill references</p>}
    {error && <p role="alert">Skill references are unavailable. The recorded evidence remains available.</p>}
    {skills && <>{ids.filter(id => !skills.some(s => s.id === id)).length > 0 && <p>Some recorded IDs have no returned API skill. No facts are inferred for those IDs.</p>}
      {skills.map(skill => <details key={skill.id}><summary>{skill.name}<span>{skill.type ?? 'Skill'}</span></summary>
        <InsightEvidenceDetails data={{ name: skill.name, icon: skill.icon, description: skill.description, referenceFacts: skill.facts,
          ...(skill.type === 'Bundle' ? { accessRequirement: 'Requires the relevant bundle; an expired cooldown does not establish possession.' } : {}),
          ...(skill.bundle_skills?.length ? { bundleSkillIds: skill.bundle_skills } : {}),
          ...(skill.transform_skills?.length ? { transformationSkillIds: skill.transform_skills } : {}),
          ...(skill.flip_skill ? { flipSkillId: skill.flip_skill } : {}),
        }}/><a href={`https://api.guildwars2.com/v2/skills/${skill.id}`} target="_blank" rel="noreferrer">API source / {skill.id}</a>
      </details>)}
    </>}
  </section>;
}
