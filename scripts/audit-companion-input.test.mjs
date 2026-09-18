import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditCompanionInput } from './audit-companion-input.mjs';

test('existing fixture distinguishes healing totals from timelines', async () => {
  const raw = JSON.parse(await readFile(new URL('../src/lib/__tests__/fixtures/wvw-modern-ei.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(raw);
  const result = auditCompanionInput(raw);
  assert.ok(result.totals.playersWithHealingAggregates > 0);
  assert.equal(result.totals.playersWithHealingSeries, 0);
  assert.ok(result.totals.listedHealingParticipants > 0);
  assert.equal(JSON.stringify(raw), before);
});

test('does not turn empty fields or aggregate totals into events', () => {
  const result = auditCompanionInput({ players: [{ account: 'Example.1234', rotation: [], extHealingStats: { outgoingHealing: [{ healing: 200 }] } }] });
  assert.equal(result.totals.playersWithTimestampedCasts, 0);
  assert.equal(result.totals.playersWithHealingSeries, 0);
  assert.equal(result.players[0].extensionParticipantListed, false);
  assert.equal(result.players[0].replay.downIntervalsPresent, false);
});

test('counts valid timestamps including zero, not malformed records', () => {
  const result = auditCompanionInput({ players: [{ rotation: [{ skills: [{ castTime: 0, duration: 200 }, { castTime: -1 }, { castTime: '100' }, null] }],
    extHealingStats: { incomingHealing1S: [[0, 100]] }, buffUptimes: [{ states: [[0, 1]] }] }] });
  assert.equal(result.players[0].casts.timestamped, 1);
  assert.equal(result.players[0].effects.entriesWithStateSamples, 1);
  assert.equal(result.totals.playersWithHealingSeries, 1);
  assert.throws(() => auditCompanionInput({}));
});
