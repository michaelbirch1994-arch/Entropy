import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const catalogUrl = new URL('../src/data/wvwReferenceCatalog.json', import.meta.url);

const sorted = (values) => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const sameList = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

function factValue(skill, type) {
  return skill.facts?.find((fact) => fact.type === type)?.value;
}

function distanceValue(skill, text) {
  return skill.facts?.find((fact) => fact.type === 'Distance' && fact.text === text)?.distance;
}

export function auditReferenceCatalog(catalog, apiSkills) {
  const errors = [];
  const apiById = new Map(apiSkills.map((skill) => [skill.id, skill]));
  const seenIds = new Set();
  const seenNames = new Set();

  for (const reference of catalog.skills) {
    if (seenIds.has(reference.skillId)) errors.push(`Duplicate catalog skill id ${reference.skillId}.`);
    if (seenNames.has(reference.name)) errors.push(`Duplicate catalog skill name ${reference.name}.`);
    seenIds.add(reference.skillId);
    seenNames.add(reference.name);

    const skill = apiById.get(reference.skillId);
    if (!skill) {
      errors.push(`${reference.name} (${reference.skillId}) is missing from the ArenaNet response.`);
      continue;
    }
    if (skill.name !== reference.api.name) errors.push(`${reference.name}: API name changed from ${reference.api.name} to ${skill.name}.`);

    const recharge = factValue(skill, 'Recharge');
    if (recharge !== reference.api.rechargeSeconds) errors.push(`${reference.name}: API baseline recharge changed from ${reference.api.rechargeSeconds}s to ${recharge ?? 'missing'}.`);

    if (reference.api.range !== undefined) {
      const range = factValue(skill, 'Range');
      if (range !== reference.api.range) errors.push(`${reference.name}: API range changed from ${reference.api.range} to ${range ?? 'missing'}.`);
    }

    for (const [label, expected] of Object.entries(reference.api.distanceFacts ?? {})) {
      const actual = distanceValue(skill, label);
      if (actual !== expected) errors.push(`${reference.name}: API ${label} changed from ${expected} to ${actual ?? 'missing'}.`);
    }

    const statuses = (skill.facts ?? []).filter((fact) => fact.type === 'Buff' && typeof fact.status === 'string').map((fact) => fact.status);
    if (!sameList(statuses, reference.api.buffStatuses)) errors.push(`${reference.name}: API buff statuses changed from [${sorted(reference.api.buffStatuses).join(', ')}] to [${sorted(statuses).join(', ')}].`);

    if (reference.api.stunBreak !== undefined) {
      const stunBreak = Boolean((skill.facts ?? []).find((fact) => fact.type === 'StunBreak')?.value);
      if (stunBreak !== reference.api.stunBreak) errors.push(`${reference.name}: API stun-break fact changed from ${reference.api.stunBreak} to ${stunBreak}.`);
    }

    if (reference.api.flipSkillId !== undefined && skill.flip_skill !== reference.api.flipSkillId) {
      errors.push(`${reference.name}: API flip skill changed from ${reference.api.flipSkillId} to ${skill.flip_skill ?? 'missing'}.`);
    }
  }

  return {
    errors,
    checkedSkills: catalog.skills.length,
    modeSplits: catalog.skills.filter((skill) => skill.wvw.rechargeMs !== skill.api.rechargeSeconds * 1000).length,
  };
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
  const ids = catalog.skills.map((skill) => skill.skillId).join(',');
  const response = await fetch(`${catalog.sources.arenaNetApi}?ids=${ids}`);
  if (!response.ok) throw new Error(`ArenaNet API returned HTTP ${response.status}.`);
  const result = auditReferenceCatalog(catalog, await response.json());
  if (result.errors.length) {
    for (const error of result.errors) console.error(`REFERENCE DRIFT: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Reference catalog ${catalog.id} matches ${result.checkedSkills} ArenaNet skill records; ${result.modeSplits} WvW recharge overrides remain explicitly separated.`);
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entryUrl === import.meta.url) main().catch((error) => {
  console.error(`Reference audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
