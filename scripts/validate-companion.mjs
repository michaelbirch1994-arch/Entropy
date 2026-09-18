import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCompanionRecording, matchCompanionRecording } from '../src/lib/insight/companionRecording.ts';
import { compareCompanionCasts } from '../src/lib/insight/companionAlignment.ts';
import { auditCompanionInput } from './audit-companion-input.mjs';

async function readBounded(path, maximum) {
  const info = await stat(path);
  if (!info.isFile() || info.size > maximum) throw new Error('Input is not a file or exceeds its size limit.');
  return readFile(path, 'utf8');
}

export async function validateCompanionFiles(logPath, eiPath, companionPath, toleranceMs = 100) {
  const recording = parseCompanionRecording(await readBounded(companionPath, 5_000_000));
  const raw = JSON.parse(await readBounded(eiPath, 100_000_000));
  const audit = auditCompanionInput(raw);
  if (!Number.isSafeInteger(raw.durationMS) || raw.durationMS <= 0 || !Number.isSafeInteger(raw.gW2Build) || raw.gW2Build <= 0) throw new Error('EI duration or game build is missing.');
  if (!(await stat(logPath)).isFile()) throw new Error('Original log must be a file.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(logPath)) hash.update(chunk);
  const binding = matchCompanionRecording(recording, { logSha256: hash.digest('hex'), durationMs: raw.durationMS,
    gameBuild: raw.gW2Build, accounts: raw.players.map(p => p?.account).filter(a => typeof a === 'string') });
  const players = raw.players.filter(p => p?.account === recording.account);
  if (players.length !== 1) binding.errors.push('EI must contain exactly one matching player.');
  binding.matched = binding.errors.length === 0;
  if (!binding.matched) return { binding, alignment: null };
  const rotations = players[0].rotation;
  if (!Array.isArray(rotations)) return { binding, alignment: null, reason: 'Rotation data is absent; cast alignment cannot be assessed.' };
  const reference = rotations.flatMap(r => Array.isArray(r?.skills) ? r.skills.map(c => ({ skillId: r.id, timeMs: c?.castTime })) : []);
  return { binding, alignment: compareCompanionCasts(recording, reference, toleranceMs), inputAudit: audit.totals,
    limitation: 'The supplied EI JSON is not independently proven to derive from this raw log. The raw file is fingerprinted, not parsed by this tool.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length < 5 || process.argv.length > 6) throw new Error('Usage: node scripts/validate-companion.mjs <original.evtc|zevtc> <ei.json> <companion.json> [tolerance-ms]');
    const result = await validateCompanionFiles(...process.argv.slice(2, 5), process.argv[5] === undefined ? 100 : Number(process.argv[5]));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.binding.matched) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`Validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
