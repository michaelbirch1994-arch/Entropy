/** Prototype interchange format. A source label is a claim, not authentication. */
export interface CompanionRecording {
  schemaVersion: 1;
  recordingId: string;
  account: string;
  gameBuild: number;
  collectorVersion: string;
  encounter: { logSha256: string; durationMs: number };
  clock: { basis: 'encounter-relative'; uncertaintyMs: number };
  gaps: { startMs: number; endMs: number }[];
  events: CompanionEvent[];
}

interface EventBase {
  sequence: number;
  timeMs: number;
  source: 'collector-observed' | 'player-provided' | 'model-estimated';
}
export type CompanionEvent = EventBase & (
  | { kind: 'cast'; skillId: number }
  | { kind: 'loadout'; skillIds: number[] }
  | { kind: 'skill-state'; skillId: number; charges: number; maxCharges: number }
  | { kind: 'endurance'; value: number; capacity: number }
);

const MAX_BYTES = 5_000_000;
const MAX_EVENTS = 20_000;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function integer(value: unknown, min = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min;
}
function label(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

/** Reject malformed or ambiguous recordings before they enter any analysis. */
export function parseCompanionRecording(text: string): CompanionRecording {
  if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Companion recording exceeds 5 MB.');
  const r: unknown = JSON.parse(text);
  if (!record(r) || r.schemaVersion !== 1) throw new Error('Unsupported companion schema.');
  if (!label(r.recordingId) || !label(r.account) || !label(r.collectorVersion) || !integer(r.gameBuild, 1)) throw new Error('Invalid recording identity.');
  if (!record(r.encounter) || typeof r.encounter.logSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.encounter.logSha256) || !integer(r.encounter.durationMs, 1)) throw new Error('Invalid encounter binding.');
  if (!record(r.clock) || r.clock.basis !== 'encounter-relative' || !integer(r.clock.uncertaintyMs)) throw new Error('Invalid recording clock.');
  const duration = r.encounter.durationMs;
  if (!Array.isArray(r.gaps) || r.gaps.length > MAX_EVENTS || r.gaps.some(g => !record(g) || !integer(g.startMs) || !integer(g.endMs) || g.startMs >= g.endMs || g.endMs > duration)) throw new Error('Invalid recording gaps.');
  if (!Array.isArray(r.events) || r.events.length > MAX_EVENTS) throw new Error('Invalid event count.');
  let sequence = -1;
  let time = -1;
  for (const e of r.events) {
    if (!record(e) || !integer(e.sequence) || e.sequence <= sequence || !integer(e.timeMs) || e.timeMs < time || e.timeMs > duration || !['collector-observed', 'player-provided', 'model-estimated'].includes(e.source as string)) throw new Error('Invalid event order, timestamp or source.');
    sequence = e.sequence;
    time = e.timeMs;
    if (e.kind === 'cast') {
      if (!integer(e.skillId, 1)) throw new Error('Invalid cast skill.');
    } else if (e.kind === 'loadout') {
      if (!Array.isArray(e.skillIds) || e.skillIds.length > 50 || !e.skillIds.every(id => integer(id, 1)) || new Set(e.skillIds).size !== e.skillIds.length) throw new Error('Invalid loadout.');
    } else if (e.kind === 'skill-state') {
      if (!integer(e.skillId, 1) || !integer(e.maxCharges, 1) || !integer(e.charges) || e.charges > e.maxCharges) throw new Error('Invalid skill state.');
    } else if (e.kind === 'endurance') {
      if (typeof e.value !== 'number' || !Number.isFinite(e.value) || typeof e.capacity !== 'number' || !Number.isFinite(e.capacity) || e.capacity <= 0 || e.value < 0 || e.value > e.capacity) throw new Error('Invalid endurance state.');
    } else throw new Error('Unsupported companion event.');
  }
  return r as unknown as CompanionRecording;
}

/** Requires the original file digest; names and approximate times are insufficient. */
export function matchCompanionRecording(r: CompanionRecording, encounter: {
  logSha256: string; durationMs: number; gameBuild: number; accounts: string[];
}) {
  const errors: string[] = [];
  if (r.encounter.logSha256 !== encounter.logSha256) errors.push('Original log fingerprint differs.');
  if (r.encounter.durationMs !== encounter.durationMs) errors.push('Encounter duration differs.');
  if (r.gameBuild !== encounter.gameBuild) errors.push('Game build differs.');
  if (!encounter.accounts.includes(r.account)) errors.push('Player is absent from this encounter.');
  return { matched: errors.length === 0, errors };
}

/** Returns point observations only: snapshots never imply continuous readiness. */
export function companionObservationsAt(r: CompanionRecording, timeMs: number, toleranceMs = 0) {
  if (!integer(timeMs) || !integer(toleranceMs) || timeMs > r.encounter.durationMs) return [];
  const window = toleranceMs + r.clock.uncertaintyMs;
  if (r.gaps.some(g => g.startMs <= timeMs + window && g.endMs > timeMs - window)) return [];
  return r.events.filter(e => Math.abs(e.timeMs - timeMs) <= toleranceMs)
    .map(event => ({ event, timingUncertaintyMs: r.clock.uncertaintyMs,
      provenance: 'Imported companion claim; not independently authenticated' as const }));
}
