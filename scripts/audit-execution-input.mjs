import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const array = v => Array.isArray(v) ? v : [];
export function auditExecutionInput(raw) {
  if (!raw || !Array.isArray(raw.players)) throw Error('Expected EI players array');
  const players = raw.players.filter(p => p && p.notInSquad !== true);
  const boons = ['Stability', 'Protection', 'Aegis', 'Swiftness'].map(name => {
    let tracked = 0, atZero = 0, missingClassification = 0, malformedStates = 0, conflictingTimes = 0;
    for (const p of players) {
      const entries = array(p.buffUptimes).filter(b => (raw.buffMap?.[`b${b.id}`]?.name ?? raw.buffMap?.[b.id]?.name) === name);
      const valid = entries.filter(b => {
        const meta = raw.buffMap?.[`b${b.id}`] ?? raw.buffMap?.[b.id];
        if (meta?.classification !== 'Boon') { missingClassification++; return false; }
        return true;
      });
      const states = valid.flatMap(b => array(b.states));
      const accepted = states.filter(s => Array.isArray(s) && s.length >= 2 && Number.isFinite(s[0]) && s[0] >= 0 && Number.isFinite(s[1]) && s[1] >= 0);
      malformedStates += states.length - accepted.length;
      const byTime = new Map();
      for (const [t,v] of accepted) {
        const values = byTime.get(t) ?? new Set(); values.add(v); byTime.set(t, values);
      }
      conflictingTimes += [...byTime.values()].filter(s => s.size > 1).length;
      if (accepted.length) tracked++;
      if (accepted.some(([t]) => t === 0)) atZero++;
    }
    return { name, roster: players.length, tracked, statesAtZero: atZero, missingClassification, malformedStates, conflictingTimes };
  });
  return { schema: 'execution-input-audit-v1', durationMs: raw.durationMS ?? null, gameBuild: raw.gw2Build ?? null,
    parserVersion: raw.eliteInsightsVersion ?? null, roster: players.length, boons,
    playersWithPositions: players.filter(p => array(p.combatReplayData?.positions).length).length,
    playersWithCasts: players.filter(p => array(p.rotation).some(r => array(r.skills).some(s => Number.isFinite(s.castTime)))).length,
    playersWithDamage1S: players.filter(p => array(p.damage1S).some(s => array(s).length)).length,
    playersWithHealing1S: players.filter(p => array(p.extHealingStats?.outgoingHealing1S).length).length,
    limitations: ['Structural field presence is not completeness.', 'No names or accounts are exported.', 'No engagement boundaries are inferred from file starts or missing activity.', 'Mirrors the buffUptimes source used by replay; active-only aggregate fields are not substituted.'] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const file of process.argv.slice(2)) {
    const bytes = await readFile(file);
    console.log(JSON.stringify({ file: basename(file), sha256: createHash('sha256').update(bytes).digest('hex'), ...auditExecutionInput(JSON.parse(bytes)) }));
  }
}
