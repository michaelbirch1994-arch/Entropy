import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeDeathEvents } from '../combat/normalizeDeaths';
import { detectMassDowns, detectFailedRecoveries } from '../intelligence/criticalEvents';
import type { ParsedReport } from '../bridge-metrics/positioning';

function fullReplayReport(players: any[]): ParsedReport {
  return {
    details: {
      players,
      combatReplayMetaData: { pollingRate: 150, inchToPixel: 40, sizes: [1000, 1000] },
      durationMS: 60000,
    },
  };
}

const commander = {
  name: 'Tag',
  account: 'Tag.1234',
  hasCommanderTag: true,
  combatReplayData: { positions: [[0, 0], [0, 0], [0, 0], [0, 0]], start: 0 },
};

function playerWithDownDeath(name: string, down: Array<[number, number]>, dead: Array<[number, number]>) {
  return {
    name,
    account: `${name}.9999`,
    combatReplayData: { positions: [[0, 0], [0, 0], [0, 0], [0, 0]], start: 0, down, dead },
  };
}

describe('detectMassDowns', () => {
  it('flags a cluster of 3+ distinct players downed within the window', () => {
    const players = [
      commander,
      playerWithDownDeath('A', [[1000, 4000]], []),
      playerWithDownDeath('B', [[1500, 4500]], []),
      playerWithDownDeath('C', [[2000, 5000]], []),
    ];
    const report = fullReplayReport(players);
    const set = normalizeDeathEvents(report);
    const massDowns = detectMassDowns(set, 'fight-1', { windowMs: 3000, minPlayers: 3 });

    expect(massDowns).toHaveLength(1);
    expect(massDowns[0].relatedPlayers).toHaveLength(3);
    expect(massDowns[0].fightId).toBe('fight-1');
    expect(massDowns[0].relatedEvents).toHaveLength(3);
    expect(massDowns[0].kind).toBe('mass-down');
  });

  it('does not flag when fewer than minPlayers are downed together', () => {
    const players = [commander, playerWithDownDeath('A', [[1000, 4000]], []), playerWithDownDeath('B', [[1500, 4500]], [])];
    const report = fullReplayReport(players);
    const set = normalizeDeathEvents(report);
    expect(detectMassDowns(set, 'fight-1', { windowMs: 3000, minPlayers: 3 })).toHaveLength(0);
  });

  it('does not double-count the same down across two overlapping clusters', () => {
    const players = [
      commander,
      playerWithDownDeath('A', [[1000, 4000]], []),
      playerWithDownDeath('B', [[1200, 4200]], []),
      playerWithDownDeath('C', [[1400, 4400]], []),
      playerWithDownDeath('D', [[10000, 13000]], []),
      playerWithDownDeath('E', [[10200, 13200]], []),
      playerWithDownDeath('F', [[10400, 13400]], []),
    ];
    const report = fullReplayReport(players);
    const set = normalizeDeathEvents(report);
    const massDowns = detectMassDowns(set, 'fight-1', { windowMs: 1000, minPlayers: 3 });
    expect(massDowns).toHaveLength(2);
  });

  it('returns nothing when replay degree is not full (no fabricated events)', () => {
    const report: ParsedReport = { details: { players: [{ name: 'A', account: 'A.1' }] } };
    const set = normalizeDeathEvents(report);
    expect(detectMassDowns(set, 'fight-1')).toHaveLength(0);
  });
});

describe('detectFailedRecoveries', () => {
  it('flags a down that ends in a linked death', () => {
    const players = [commander, playerWithDownDeath('Bob', [[5000, 7500]], [[7500, 0]])];
    const report = fullReplayReport(players);
    const set = normalizeDeathEvents(report);
    const failed = detectFailedRecoveries(set, 'fight-1');

    expect(failed).toHaveLength(1);
    expect(failed[0].timestampMs).toBe(5000);
    expect(failed[0].summary).toContain('Bob');
    expect(failed[0].summary).toContain('2.5s');
    expect(failed[0].relatedPlayers[0]).toBe('player:Bob.9999');
  });

  it('does not flag a down that was rallied (no linked death)', () => {
    const players = [commander, playerWithDownDeath('Ann', [[1000, 3000]], [])];
    const report = fullReplayReport(players);
    const set = normalizeDeathEvents(report);
    expect(detectFailedRecoveries(set, 'fight-1')).toHaveLength(0);
  });

  it('does not flag an instant-execute death with no preceding down', () => {
    const players = [commander, playerWithDownDeath('Cy', [], [[9000, 0]])];
    const report = fullReplayReport(players);
    const set = normalizeDeathEvents(report);
    expect(detectFailedRecoveries(set, 'fight-1')).toHaveLength(0);
  });
});

describe('Tier 1 detectors against the real fixture', () => {
  it('produce zero critical events on wvw-modern-ei.json, because that log lacks full replay data (documented, not a bug)', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'wvw-modern-ei.json'), 'utf-8'));
    const report: ParsedReport = { details: raw };
    const set = normalizeDeathEvents(report);
    expect(set.confidence).toBe('none');
    expect(detectMassDowns(set, 'real-fight')).toHaveLength(0);
    expect(detectFailedRecoveries(set, 'real-fight')).toHaveLength(0);
  });
});
