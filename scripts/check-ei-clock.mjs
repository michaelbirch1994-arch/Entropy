import { readFileSync } from 'node:fs';
import { readEncounter, findStartAnchor } from './match-capture-encounters.mjs';
import { decodeCallback } from './decode-capture.mjs';

const [capture, ...paths] = process.argv.slice(2);
if (!capture || !paths.length) throw new Error('Usage: node scripts/check-ei-clock.mjs <capture> <evtc> ... (adjacent EI JSON required)');
const rows = readFileSync(capture, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const decoded = rows.filter(r => r.type === 'callback').map(decodeCallback);
const results = paths.map(path => {
  const encounter = readEncounter(readFileSync(path));
  const anchor = findStartAnchor(rows, encounter);
  const ei = JSON.parse(readFileSync(path.replace(/\.evtc$/, '_detailed_wvw_kill.json'), 'utf8'));
  if (!anchor || !anchor.fileEndTick || !encounter.recordingPlayer) return { path, status: 'Missing anchor or recorder' };
  const player = ei.players.find(p => p.account?.replace(/^:/, '') === encounter.recordingPlayer.account);
  const start = BigInt(anchor.tick), end = BigInt(anchor.fileEndTick);
  const observed = decoded.filter(e => e.kind === 'animation-start' && e.stream === 'area' && e.sourceField === encounter.recordingPlayer.id
    && BigInt(e.eventTickMs) >= start && BigInt(e.eventTickMs) <= end);
  const reference = (player?.rotation ?? []).flatMap(r => r.skills.map(c => ({ skillId: r.id, time: c.castTime })));
  // Unique skills are independent anchors; repeated casts cannot establish identity.
  const pairs = observed.filter(c => observed.filter(o => o.skillId === c.skillId).length === 1 && reference.filter(r => r.skillId === c.skillId).length === 1)
    .map(c => { const r = reference.find(r => r.skillId === c.skillId); return { skillId: c.skillId,
      callbackFromSquadStartMs: Number(BigInt(c.eventTickMs) - start), eiTimeMs: r.time,
      impliedEiZeroTick: (BigInt(c.eventTickMs) - BigInt(Math.round(r.time))).toString() }; });
  const zeros = [...new Set(pairs.map(p => p.impliedEiZeroTick))];
  return { file: path.split(/[\\/]/).at(-1), parserVersion: ei.eliteInsightsVersion, durationMs: ei.durationMS,
    observedAnimationStarts: observed.length, eiCasts: reference.length, independentPairs: pairs.length,
    status: pairs.length >= 3 && zeros.length === 1 ? 'Consistent independent cast anchors' : 'Unresolved clock',
    impliedEiZeroTicks: zeros, pairs };
});
console.log(JSON.stringify({ results, limitation: 'Diagnostic anchors only; unique skill occurrence is not proof of cast equivalence. No production timeline or metrics are changed.' }, null, 2));
