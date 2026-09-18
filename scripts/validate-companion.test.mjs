import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateCompanionFiles } from './validate-companion.mjs';
import { compareCompanionCasts } from '../src/lib/insight/companionAlignment.ts';
import { parseCompanionRecording } from '../src/lib/insight/companionRecording.ts';

const event = (timeMs, sequence = 1) => ({ kind: 'cast', skillId: 123, timeMs, sequence, source: 'collector-observed' });
const fixture = () => ({ schemaVersion: 1, recordingId: 'synthetic-only', account: 'Example.1234', collectorVersion: 'test', gameBuild: 42,
  encounter: { logSha256: createHash('sha256').update('synthetic-log').digest('hex'), durationMs: 5000 },
  clock: { basis: 'encounter-relative', uncertaintyMs: 10 }, gaps: [], events: [event(1010)] });

test('matches only unique observations and reports timing differences', () => {
  const recording = parseCompanionRecording(JSON.stringify(fixture()));
  const result = compareCompanionCasts(recording, [{ skillId: 123, timeMs: 1000 }], 20);
  assert.equal(result.matched, 1);
  assert.equal(result.maximumAbsoluteDifferenceMs, 10);
  assert.equal(result.matchRatePercent, 100);
  assert.equal(compareCompanionCasts(recording, [{ skillId: 999, timeMs: 1000 }], 20).unmatched, 1);
  assert.equal(compareCompanionCasts(recording, [{ skillId: 123, timeMs: 1000 }, { skillId: 123, timeMs: 1020 }], 20).ambiguous, 1);
  recording.events.push(event(1020, 2));
  assert.equal(compareCompanionCasts(recording, [{ skillId: 123, timeMs: 1000 }], 20).ambiguous, 2);
});

test('gaps, inferred events and invalid input never manufacture agreement', () => {
  const recording = fixture();
  recording.gaps.push({ startMs: 1025, endMs: 2000 });
  assert.equal(compareCompanionCasts(recording, [{ skillId: 123, timeMs: 1000 }], 20).suppressedByGaps, 1);
  recording.events[0].source = 'model-estimated';
  assert.equal(compareCompanionCasts(recording, [], 20).matchRatePercent, null);
  assert.throws(() => compareCompanionCasts(recording, [], -1));
  assert.throws(() => compareCompanionCasts(recording, [{ skillId: 123, timeMs: '1000' }], 20));
});

test('file validation fingerprints source, rejects mismatches and handles absent rotations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'entropy-companion-test-'));
  const paths = ['source.zevtc', 'ei.json', 'companion.json'].map(name => join(directory, name));
  const raw = { durationMS: 5000, gW2Build: 42, players: [{ account: 'Example.1234', rotation: [{ id: 123, skills: [{ castTime: 1000 }] }] }] };
  try {
    await writeFile(paths[0], 'synthetic-log');
    await writeFile(paths[1], JSON.stringify(raw));
    await writeFile(paths[2], JSON.stringify(fixture()));
    const valid = await validateCompanionFiles(...paths, 20);
    assert.equal(valid.binding.matched, true);
    assert.equal(valid.alignment.matched, 1);
    delete raw.players[0].rotation;
    await writeFile(paths[1], JSON.stringify(raw));
    assert.equal((await validateCompanionFiles(...paths)).alignment, null);
    await writeFile(paths[0], 'different-log');
    const invalid = await validateCompanionFiles(...paths);
    assert.equal(invalid.binding.matched, false);
    assert.equal(invalid.alignment, null);
    assert.ok(invalid.binding.errors.includes('Original log fingerprint differs.'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
