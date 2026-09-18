import { describe, expect, it } from 'vitest';
import { eventResponses, RESPONSE_RULES, responseKind } from '../insight/eventResponses';
import type { WvWReport } from '../../types/report';
import type { CombatMoment } from '../insight/combatConnections';
const event: CombatMoment = { time: 150000, end: 160000, kind: 'down', label: 'Downstate', account: 'victim' };
function fixture() {
  const provider = (account: string, name: number, castTime: number) => ({ account, profession: 'Guardian', casts: [{ skillId: name, castTime }] });
  return { stats: { rotations: { skillMeta: { 1: { name: 'Signet of Mercy' }, 2: { name: '"Eye of the Storm!"' }, 3: { name: '"Stand Your Ground!"' } }, fights: [{ fightId: 'f', durationMs: 200000, players: [provider('ready', 1, 0), provider('cooling', 1, 145000), provider('unknown', 1, 151000), provider('enemy', 1, 0), provider('break', 2, 0), provider('self', 3, 0)] }] },
    replayFights: [{ fightId: 'f', data: { players: ['victim', 'ready', 'cooling', 'unknown', 'enemy', 'break', 'self'].map(account => ({ account, inSquad: account !== 'enemy', downIntervals: [], deadIntervals: [], effects: [] })) } }] } } as unknown as WvWReport;
}
describe('Timeline response assessment', () => {
  it('uses reviewed WvW recharge and reach references', () => {
    expect(RESPONSE_RULES.find(rule => rule.name === 'Purging Flames')).toMatchObject({ skillId: 9187, cooldownMs: 28_000, maxReach: 1_080 });
    expect(RESPONSE_RULES.find(rule => rule.name === 'Battle Standard')).toMatchObject({ skillId: 14419, cooldownMs: 120_000, maxReach: 960 });
  });
  it('separates cooldown states, future-only anchors, and enemies', () => {
    const report = fixture(), before = JSON.stringify(report);
    const rows = eventResponses(report, 'f', event, 'revive').candidates;
    expect(rows.map(r => [r.account, r.status])).toEqual([['ready', 'Estimated recharged'], ['cooling', 'Estimated recharging'], ['unknown', 'No prior cast anchor']]);
    expect(rows[2].recordedFollowingCastsMs).toEqual([151000]);
    expect(rows[0].explanations[0].assessment).toBe('Counterevidence in evidence model');
    expect(rows[1].explanations[0].assessment).toBe('Supported in evidence model');
    expect(rows[2].explanations[0].assessment).toBe('Unresolved');
    expect(rows[2].explanations[2].assessment).toBe('Recorded');
    expect(rows[0].explanations[3].assessment).toBe('Unresolved');
    expect(rows[0].evidenceCoverage).toMatchObject({ percent: 38, completedChecks: 3, totalChecks: 8 });
    expect(rows[2].evidenceCoverage).toMatchObject({ percent: 25, completedChecks: 2 });
    expect(JSON.stringify(report)).toBe(before);
    const unresolved = eventResponses(report, 'other', event, 'revive');
    expect(unresolved.candidates).toEqual([]);
    expect(unresolved.provenance).toEqual([expect.objectContaining({ kind: 'recorded-event', id: 'response-event' })]);
  });
  it('counts only ally stunbreaks and refuses to infer immobilize response', () => {
    const stun = { ...event, kind: 'mechanic', label: 'Stunned' } as CombatMoment;
    expect(responseKind(stun)).toBe('stunbreak');
    expect(responseKind({ ...stun, label: 'Immobilized' })).toBe('cleanse');
    expect(['Knocked Down', 'Knocked Back/Pulled', 'Float', 'Lockout (Stun, Daze, Petrify, etc...)'].map(label => responseKind({ ...stun, label }))).toEqual(['stunbreak', 'stunbreak', 'stunbreak', 'stunbreak']);
    expect(responseKind({ ...stun, label: 'Downed' })).toBe('revive');
    expect(responseKind({ ...stun, label: 'Dead' })).toBe('unknown');
    const candidates = eventResponses(fixture(), 'f', stun, 'stunbreak').candidates;
    expect(candidates.filter(c => c.opportunity.verdict !== 'Prevention only, not an ally stunbreak').map(c => c.account)).toEqual(['break']);
  });
  it('includes uncast meta loadouts without assuming readiness or inventing casts', () => {
    const report = fixture();
    report.stats.rotations!.fights[0].players[0].profession = 'Firebrand';
    report.stats.rotations!.fights[0].players[0].casts = [];
    report.stats.rotations!.fights[0].players[1].profession = 'Druid';
    report.stats.rotations!.fights[0].players[1].casts = [];
    const stun = { ...event, kind: 'mechanic' as const, label: 'Stunned' };
    const assumed = eventResponses(report, 'f', stun, 'stunbreak').candidates.filter(c => c.account === 'ready');
    expect(assumed.map(c => c.name)).toEqual(['Mantra of Liberation', 'Stand Your Ground!']);
    expect(assumed.map(c => c.skillId)).toEqual([43357, 9153]);
    expect(assumed[0].status).toBe('Mantra charges unresolved');
    expect(assumed[0].loadoutEvidence).toContain('Assumed equipped');
    expect(assumed[0].recordedFollowingCastsMs).toEqual([]);
    expect(assumed[1].opportunity.verdict).toBe('Prevention only, not an ally stunbreak');
    const spirit = eventResponses(report, 'f', event, 'revive').candidates.find(c => c.name === 'Spirit of Nature')!;
    expect(spirit.lastCastMs).toBeNull();
    expect(spirit.referenceCooldownMs).toBe(120000);
    expect(spirit.opportunity.verdict).toBe('Insufficient evidence');
  });
  it('matches cleanses to conditions, not existing stuns or downstate', () => {
    const report = fixture();
    report.stats.rotations!.skillMeta[4] = { name: 'Purging Flames' };
    report.stats.rotations!.fights[0].players[0].casts = [{ skillId: 4, castTime: 0, duration: 500 }];
    const condition = { ...event, kind: 'mechanic' as const, label: 'Immobilized' };
    expect(eventResponses(report, 'f', condition, responseKind(condition)).candidates.map(c => c.name)).toEqual(['Purging Flames']);
    expect(eventResponses(report, 'f', event, 'cleanse').candidates[0].opportunity.verdict).toBe('Response mismatch');
    expect(eventResponses(report, 'f', { ...condition, label: 'Stunned' }, 'stunbreak').candidates.map(c => c.name)).not.toContain('Purging Flames');
  });
  it('requires positional and survival evidence for a potential opportunity', () => {
    const report = fixture(), replay = report.stats.replayFights![0].data;
    replay.map = { width: 100, height: 100, images: [], inchToPixel: 0.5 };
    for (const p of replay.players) p.points = [{ t: event.time, x: p.account === 'victim' ? 100 : 0, y: 0 }];
    expect(eventResponses(report, 'f', event, 'revive').candidates[0].opportunity.verdict).toBe('Potential help opportunity');
    replay.players.find(p => p.account === 'victim')!.points[0].x = 1000;
    expect(eventResponses(report, 'f', event, 'revive').candidates[0].opportunity.verdict).toBe('Outside reference reach');
    replay.map.inchToPixel = 0;
    expect(eventResponses(report, 'f', event, 'revive').candidates[0].opportunity.verdict).toBe('Insufficient evidence');
  });
  it('updates checkpoints from later casts without leaking future anchors', () => {
    const report = fixture(), before = JSON.stringify(report);
    const row = eventResponses(report, 'f', event, 'revive').candidates.find(c => c.account === 'unknown')!;
    expect(row.responseTimeline[0]).toMatchObject({ status: 'No prior cast anchor', lastCastMs: null });
    expect(row.responseTimeline[1]).toMatchObject({ status: 'Recorded cast', timeMs: 151000 });
    expect(row.responseTimeline[2]).toMatchObject({ status: 'Estimated recharging', lastCastMs: 151000 });
    expect(JSON.stringify(report)).toBe(before);
  });
  it('ends checkpoints before target death and honors provider state changes', () => {
    const report = fixture();
    report.stats.replayFights![0].data.players.find(p => p.account === 'victim')!.deadIntervals = [[153000, 200000]];
    report.stats.replayFights![0].data.players.find(p => p.account === 'ready')!.downIntervals = [[151000, 152000]];
    const row = eventResponses(report, 'f', event, 'revive').candidates[0];
    expect(row.responseTimeline.map(p => p.timeMs)).toEqual([150000, 151000, 152000]);
    expect(row.responseTimeline[1].status).toBe('Recorded incapacitation');
    expect(row.responseTimeline[2].status).toBe('Estimated recharged');
    expect(eventResponses(report, 'f', { ...event, end: 151000 }, 'revive').candidates[2].recordedFollowingCastsMs).toEqual([]);
  });
  it('preserves provider incapacitation and does not suggest reviving defeated players', () => {
    const report = fixture();
    report.stats.replayFights![0].data.players.find(p => p.account === 'ready')!.downIntervals = [[149000, 155000]];
    expect(eventResponses(report, 'f', event, 'revive').candidates[0].status).toBe('Incapacitated at event');
    expect(eventResponses(report, 'f', event, 'revive').candidates[0].evidenceCoverage.percent).toBe(38);
    expect(eventResponses(report, 'f', { ...event, kind: 'death' }, 'revive').candidates).toEqual([]);
  });
  it('uses recorded Alacrity in the same cooldown model as the player palette', () => {
    const report = fixture();
    const actor = report.stats.rotations!.fights[0].players.find(player => player.account === 'ready')!;
    actor.casts = [{ skillId: 1, castTime: 78_000, duration: 0 }];
    const track = report.stats.replayFights![0].data.players.find(player => player.account === 'ready')!;
    track.effects = [
      { id: 1, name: 'Alacrity', classification: 'Boon', states: [[78_000, 1]] },
      { id: 2, name: 'Chilled', classification: 'Condition', states: [[78_000, 0]] },
      { id: 3, name: 'Resistance', classification: 'Boon', states: [[78_000, 0]] },
    ];
    const candidate = eventResponses(report, 'f', event, 'revive').candidates.find(row => row.account === 'ready')!;
    expect(candidate.status).toBe('Estimated recharged');
    expect(candidate.recharge).toMatchObject({ status: 'ready', earliestReadyMs: 150_000, latestReadyMs: 150_000 });
    expect(candidate.recharge!.modifiers.find(modifier => modifier.id === 'effect-alacrity')).toMatchObject({ applied: true, certaintyPct: 98 });
  });
  it('suppresses recorded Chill while Resistance is active', () => {
    const report = fixture();
    const actor = report.stats.rotations!.fights[0].players.find(player => player.account === 'ready')!;
    actor.casts = [{ skillId: 1, castTime: 60_000, duration: 0 }];
    const track = report.stats.replayFights![0].data.players.find(player => player.account === 'ready')!;
    track.effects = [
      { id: 1, name: 'Alacrity', classification: 'Boon', states: [[60_000, 0]] },
      { id: 2, name: 'Chilled', classification: 'Condition', states: [[60_000, 1]] },
      { id: 3, name: 'Resistance', classification: 'Boon', states: [[60_000, 1]] },
    ];
    const candidate = eventResponses(report, 'f', event, 'revive').candidates.find(row => row.account === 'ready')!;
    expect(candidate.status).toBe('Estimated recharged');
    expect(candidate.recharge!.modifiers.find(modifier => modifier.id === 'effect-chilled')?.detail).toContain('90.0s suppressed');
  });
});
