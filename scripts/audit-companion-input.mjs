import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const array = value => Array.isArray(value) ? value : [];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => Array.isArray(value) && value.length > 0;

/** Structural audit only. Field presence does not prove complete capture. */
export function auditCompanionInput(raw) {
  if (!object(raw) || !Array.isArray(raw.players)) throw new Error('Expected an Elite Insights JSON object with a players array.');
  const extensions = array(raw.usedExtensions).filter(object);
  const healingNames = new Set(extensions.filter(e => /healing/i.test(e.name ?? '')).flatMap(e => array(e.runningExtension)));
  const players = raw.players.filter(object).map(p => {
    const healing = object(p.extHealingStats) ? p.extHealingStats : {};
    const replay = object(p.combatReplayData) ? p.combatReplayData : {};
    const rotations = array(p.rotation).filter(object);
    const casts = rotations.flatMap(r => array(r.skills)).filter(object);
    const timestampedCasts = casts.filter(c => Number.isFinite(c.castTime) && c.castTime >= 0);
    const buffEntries = [...array(p.buffUptimes), ...array(p.buffUptimesActive)].filter(object);
    const stateEntries = buffEntries.filter(b => array(b.states).some(s => Array.isArray(s) && s.length >= 2 && Number.isFinite(s[0]) && Number.isFinite(s[1])));
    return {
      account: typeof p.account === 'string' ? p.account : null,
      character: typeof p.name === 'string' ? p.name : null,
      profession: p.profession ?? null,
      extensionParticipantListed: healingNames.has(p.name),
      casts: { fieldPresent: Array.isArray(p.rotation), records: casts.length, timestamped: timestampedCasts.length,
        withDuration: timestampedCasts.filter(c => Number.isFinite(c.duration)).length,
        note: 'Duration does not independently establish successful completion or cooldown.' },
      effects: { entriesWithStateSamples: stateEntries.length, note: 'Presence is not a guarantee of complete effect coverage.' },
      healing: {
        aggregateFields: ['outgoingHealing', 'outgoingHealingAllies', 'incomingHealing', 'totalHealingDist', 'totalIncomingHealingDist'].filter(k => nonempty(healing[k])),
        seriesFields: ['outgoingHealing1S', 'outgoingHealingAllies1S', 'incomingHealing1S'].filter(k => nonempty(healing[k])),
        note: 'Sampled series cannot establish individual heal timing or recipients without further schema validation.' },
      replay: { positionsPresent: nonempty(replay.positions), downIntervalsPresent: Array.isArray(replay.down), deadIntervalsPresent: Array.isArray(replay.dead) },
      directReadiness: 'Not established by this audit',
    };
  });
  return {
    auditVersion: 1,
    scope: 'Structural inventory of supplied EI JSON; no inference of absent events',
    parserVersion: raw.eliteInsightsVersion ?? null,
    gameBuild: raw.gW2Build ?? null,
    durationMs: raw.durationMS ?? null,
    totals: { players: players.length, playersWithTimestampedCasts: players.filter(p => p.casts.timestamped > 0).length,
      playersWithHealingAggregates: players.filter(p => p.healing.aggregateFields.length > 0).length,
      playersWithHealingSeries: players.filter(p => p.healing.seriesFields.length > 0).length,
      listedHealingParticipants: players.filter(p => p.extensionParticipantListed).length },
    players,
    nextChecks: [
      'Compare raw fields with Entropy normalized fields before introducing new capture.',
      'Verify recorder clock and fight boundaries using the original EVTC.',
      'Validate local callback observations against known actions in a controlled encounter.',
      'Do not infer exact charges, endurance, equipment or non-use from missing fields.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/audit-companion-input.mjs <elite-insights.json>');
    const result = auditCompanionInput(JSON.parse(await readFile(process.argv[2], 'utf8')));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Audit failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
