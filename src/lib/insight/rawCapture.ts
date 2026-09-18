export interface RawEvent { sequence: string; stream: string; kind: string; tick: number | null; skillId: number | null; sourceId: string | null; details: Record<string, number | string> }
export interface RawSegment { sessionId: string; index: number; continued: boolean | null }
export interface RawEncounterMatch { name: string; status: 'start-matched' | 'unmatched'; recorder: string | null; startTick: number | null; endTick: number | null; exactEnd: boolean; skillNames?: Record<string, string> }
export interface RawCapture { name: string; version: string; events: RawEvent[]; counts: Record<string, number>; accounts: string[]; written: number; dropped: number | null; finalized: boolean; warnings: string[]; segment: RawSegment | null; boundaries: { stream: string; rawHex: string }[]; encounterMatches: RawEncounterMatch[]; retention: { attempted: number; writerDiscarded: number; savedPercent: number | null; sizeLimited: boolean | null } | null }
const kinds: Record<number, string> = { 0: 'Combat', 1: 'Enter combat', 2: 'Exit combat', 3: 'Alive', 4: 'Dead', 5: 'Down', 9: 'Squad start', 10: 'Squad end', 11: 'Weapon swap', 56: 'Stunbreak', 67: 'Animation start', 68: 'Animation stop', 69: 'Buff applied', 70: 'Buff duration changed', 71: 'Buff stack removed', 72: 'Buffs removed' };
export function parseRawCapture(text: string, name: string): RawCapture {
  if (text.length > 150_000_000) throw new Error('Capture exceeds the 150 MB limit.');
  const events: RawEvent[] = []; const counts: Record<string, number> = {}; const accounts = new Set<string>();
  const sequences = new Set<string>(); let header: Record<string, unknown> | null = null, footer: Record<string, unknown> | null = null;
  const boundaries: RawCapture['boundaries'] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (line.length > 100000) throw new Error('Capture contains an oversized record.');
    const r = JSON.parse(line);
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('Invalid capture record.');
    if (!header) { if (r.type !== 'header' || r.format !== 'entropy-arc-callbacks' || r.version !== 1) throw new Error('Unsupported capture format.'); header = r; continue; }
    if (footer) throw new Error('Records follow the shutdown summary.');
    if (r.type === 'end') { footer = r; continue; }
    if (r.type !== 'callback' || !['local', 'area'].includes(r.stream) || typeof r.sequence !== 'string' || !/^\d+$/.test(r.sequence) || sequences.has(r.sequence)) throw new Error('Invalid or duplicate callback.');
    sequences.add(r.sequence);
    let kind = 'Agent metadata', tick: number | null = null, skillId: number | null = null, sourceId: string | null = null;
    const details: RawEvent['details'] = {};
    if (r.rawHex !== null) {
      if (typeof r.rawHex !== 'string' || !/^[a-f0-9]{128}$/i.test(r.rawHex)) throw new Error('Invalid event bytes.');
      const bytes = Uint8Array.from(r.rawHex.match(/../g)!, (v: string) => parseInt(v, 16)); const data = new DataView(bytes.buffer);
      kind = r.revision === 1 ? kinds[bytes[56]] ?? `Uninterpreted ${bytes[56]}` : 'Unsupported revision';
      if (r.revision === 1 && kinds[bytes[56]]) {
        const rawTick = data.getBigUint64(0, true); tick = rawTick <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rawTick) : null;
        skillId = data.getUint32(36, true); sourceId = data.getBigUint64(8, true).toString();
        // Same revision-one subset as scripts/decode-capture.mjs. Fields are
        // observations, not inferred cooldowns, cleanse counts or cast outcomes.
        const state = bytes[56];
        if (state === 9 || state === 10) boundaries.push({ stream: r.stream, rawHex: r.rawHex.toLowerCase() });
        if ([67, 68, 69, 70, 71, 72].includes(state)) {
          details['Destination field'] = data.getBigUint64(16, true).toString();
          if (state === 67) {
            details['Significant duration (ms)'] = data.getInt32(24, true);
            details['Control-return duration (ms)'] = data.getInt32(28, true);
          } else if (state === 68) {
            details['Scaled duration (ms)'] = data.getInt32(24, true);
            details['Elapsed duration (ms)'] = data.getInt32(28, true);
            details['Raw progress code'] = bytes[51];
            details['Animation progress'] = ({ 3: 'Minimum trigger reached; animation stopped', 4: 'Stopped before minimum trigger', 5: 'Animation completed fully', 6: 'Stopped; expected duration uncertain' } as Record<number, string>)[bytes[51]] ?? 'Unknown or retired progress code';
          } else {
            details['Duration value (ms)'] = data.getInt32(24, true);
            if (state === 71 || state === 72) details['Raw removal code'] = bytes[52];
            if (state === 69) details['Meaning'] = 'Source applied a buff stack to destination';
            if (state === 70) {
              details['Meaning'] = 'Destination buff duration changed by the signed duration value';
              details['New duration (ms)'] = data.getUint32(32, true);
            }
            if (state === 71 || state === 72) {
              details['Meaning'] = 'Buff removed from source; destination is the removing agent field';
              details['Removal origin'] = ({ 1: 'Server: last or all stacks removed', 2: 'Server: single stack removed', 3: 'ArcDPS-derived single removal from all-stack removal' } as Record<number, string>)[bytes[52]] ?? 'Unknown removal origin';
            }
          }
        }
      }
    } else if (r.dst?.self === 1 && r.src?.profession > 0 && r.src?.elite !== 1 && !r.dst.nameTruncated) {
      const hex = r.dst.nameUtf8Hex;
      if (typeof hex === 'string' && /^(?:[a-f0-9]{2})+$/i.test(hex)) {
        const account = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(hex.match(/../g)!, (v: string) => parseInt(v, 16))).replace(/^:/, '');
        if (account) accounts.add(account);
      }
    }
    counts[`${r.stream}: ${kind}`] = (counts[`${r.stream}: ${kind}`] ?? 0) + 1;
    events.push({ sequence: r.sequence, stream: r.stream, kind, tick, skillId, sourceId, details });
    if (events.length > 500000) throw new Error('Capture exceeds 500,000 callbacks.');
  }
  if (!header) throw new Error('Capture is empty.');
  const segmented = header.segment !== undefined;
  if (segmented && (!Number.isSafeInteger(header.segment) || Number(header.segment) < 1 || typeof header.sessionId !== 'string' || !/^entropy-[a-zA-Z0-9-]{1,100}$/.test(header.sessionId))) throw new Error('Invalid capture segment identity.');
  const warnings: string[] = [];
  if (footer) {
    if (segmented !== (footer.scope === 'segment')) throw new Error('Capture scope mismatch.');
    for (const key of [...(segmented ? ['sessionAttempted', 'sessionWritten', 'unsupportedRevision'] : ['attempted']), 'written', 'queueDropped', 'writerDiscarded']) {
      if (typeof footer[key] !== 'number' || !Number.isSafeInteger(footer[key]) || Number(footer[key]) < 0) throw new Error('Invalid shutdown accounting.');
    }
    if (footer.written !== events.length) throw new Error('Shutdown totals do not match capture.');
    if (segmented) {
      if (typeof footer.continued !== 'boolean' || Number(footer.sessionWritten) < events.length) throw new Error('Invalid segment summary.');
      if (!footer.continued && footer.sessionAttempted !== Number(footer.sessionWritten) + Number(footer.queueDropped) + Number(footer.writerDiscarded) + Number(footer.unsupportedRevision)) throw new Error('Session accounting mismatch.');
    } else if (footer.attempted !== Number(footer.written) + Number(footer.queueDropped) + Number(footer.writerDiscarded) + Number(footer.unsupportedRevision ?? 0)) throw new Error('Shutdown totals do not match capture.');
    if (footer.sizeLimited !== false) warnings.push('Capture size limit reached or status unknown.');
    if (footer.writeFailed !== false) warnings.push('Writer failure reported or status unknown.');
    if (Number(footer.writerDiscarded) > 0) warnings.push(`${footer.writerDiscarded} callbacks discarded by writer.`);
    if (Number(footer.queueDropped) > 0) warnings.push(`${footer.queueDropped} callbacks dropped before writing.`);
  } else warnings.push('No shutdown summary: recording completeness is unknown.');
  const segment: RawSegment | null = segmented ? { sessionId: String(header.sessionId), index: Number(header.segment), continued: typeof footer?.continued === 'boolean' ? footer.continued : null } : null;
  if (segment) warnings.push(`Segment ${segment.index} only. Full-session continuity and retention have not been verified. ${segment.continued ? 'Another segment is expected.' : 'Other segments may be required.'}`);
  const retention = footer && !segmented ? { attempted: Number(footer.attempted), writerDiscarded: Number(footer.writerDiscarded), savedPercent: Number(footer.attempted) > 0 ? events.length / Number(footer.attempted) * 100 : null, sizeLimited: typeof footer.sizeLimited === 'boolean' ? footer.sizeLimited : null } : null;
  return { name, version: String(header.collectorVersion ?? 'Unknown'), events, counts, accounts: [...accounts], written: events.length, dropped: footer && !segmented ? Number(footer.queueDropped) : null, finalized: Boolean(footer), warnings, retention, segment, boundaries, encounterMatches: [] };
}

export function captureSignals(capture: RawCapture) {
  // Area stream only: local callbacks can duplicate the same observations.
  const count = (kind: string) => capture.counts[`area: ${kind}`] ?? 0;
  return [
    { label: 'Buff applications', count: count('Buff applied'), filter: 'Buff applied' },
    { label: 'Animation starts', count: count('Animation start'), filter: 'Animation start' },
    { label: 'Down observations', count: count('Down'), filter: 'Down' },
    { label: 'Death observations', count: count('Dead'), filter: 'Dead' },
  ];
}

export function rawCaptureEvidence(capture: RawCapture, account: string) {
  if (!capture.accounts.includes(account)) return null;
  const detailAvailability: Record<string, number> = {};
  for (const event of capture.events) {
    if (event.stream !== 'area') continue;
    for (const field of Object.keys(event.details)) detailAvailability[field] = (detailAvailability[field] ?? 0) + 1;
  }
  return { id: 'RAW_CAPTURE', label: 'User-associated companion session: recording integrity and event inventory', data: {
    account, collectorVersion: capture.version, callbacks: capture.written, queueDropped: capture.dropped,
    finalized: capture.finalized, warnings: capture.warnings, countsByStream: capture.counts,
    retention: capture.retention, areaSignals: captureSignals(capture),
    segment: capture.segment,
    encounterStartChecks: capture.encounterMatches.map(({ skillNames: _names, ...match }) => match),
    alignmentMeaning: 'Matched starts identify the supplied EVTC start only. End alignment and EI report phase zero are not established unless independently verified. These are not automatic matches to the active report. Do not attribute session counts to the checked encounters.',
    areaDetailAvailability: detailAvailability,
    detailMeaning: 'Counts of retained area records containing each raw field, not player performance. Duration values are not cooldowns or reconstructed uptime. Removal and progress codes are uninterpreted; do not infer cleanses or interrupts. Destination fields are event-specific and are not verified player accounts.',
    retentionMeaning: 'Saved percentage is written callbacks divided by collector attempts, not fight coverage, confidence, uptime or unique events. Missing events cannot establish unused skills. Even 100 percent retention does not prove ArcDPS observed all combat information.',
    scope: 'Whole companion session, potentially containing multiple fights and character changes. Account identifies the recorder, not the owner of every event.',
    association: 'User attached this capture to the current report. Automated fight alignment has not been verified here.',
    rules: ['Do not attribute session counts to the selected player or an individual fight.', 'Do not sum overlapping local and area streams.', 'Animation starts do not prove completed casts or readiness.', 'No direct cooldown or endurance measurements are supplied.', 'Use this record to explain recording coverage; use report evidence for player-specific conclusions.'],
  } };
}
