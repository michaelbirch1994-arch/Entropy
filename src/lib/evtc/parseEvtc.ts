/**
 * Native EVTC parser — SECONDARY source, not a replacement for Elite Insights.
 *
 * Purpose: recover information that EI does not expose in its JSON. EI remains the
 * primary pipeline; this parser exists so that when a question cannot be answered
 * from EI's output, Entropy can go to the raw events instead of accumulating
 * special cases in the EI importer.
 *
 * Format reference: the published arcdps EVTC specification
 * (https://www.deltaconnected.com/arcdps/evtc/README.txt). Layout:
 *
 *   offset  size   field
 *   0       4      "EVTC" magic
 *   4       8      arcdps build, ASCII yyyymmdd
 *   12      1      revision (1 = current cbtevent layout)
 *   13      2      boss/species id (1 = WvW, 2 = map)
 *   15      1      padding
 *   16      4      agent count
 *   20      96*n   agents
 *   ...     4      skill count
 *   ...     68*n   skills
 *   ...     64*n   events (fixed-size cbtevent records)
 *
 * Developed against a real 136,349-event WvW log and cross-checked against the
 * same fight's Elite Insights JSON.
 *
 * SCOPE: this reads the container and the extension-event stream. It deliberately
 * does not reimplement EI's damage/boon simulation — that is thousands of lines of
 * game-specific logic under a copyleft (MPL-2.0) licence we should stay clear of.
 */

/** Statechange values used here. The full enum is in the arcdps spec. */
export const CBTS = {
      COMBAT: 0,
      /** Addon registration record. Not managed by arcdps. */
      EXTENSION: 40,
      /** Addon combat record, laid out as a cbtevent. Not managed by arcdps. */
      EXTENSION_COMBAT: 49,
} as const;

/** Byte offsets within the 64-byte rev-1 cbtevent record. */
const OFF = {
      time: 0,
      srcAgent: 8,
      value: 24,
      buffDmg: 28,
      overstackValue: 32,
      skillId: 36,
      srcInstId: 40,
      dstInstId: 42,
      buff: 49,
      isStateChange: 56,
      isShields: 58,
      pad61: 60,
} as const;

export const EVENT_SIZE = 64;
const AGENT_SIZE = 96;
const SKILL_SIZE = 68;

export interface EvtcAgent {
      /** Instance id (`iid`); events reference it via src_agent. */
    address: bigint;
      profession: number;
      isElite: number;
      /** Character name. */
    name: string;
      /** Account name including numeric suffix. Players only. */
    account: string;
      subgroup: string;
      isPlayer: boolean;
}

export interface EvtcHeader {
      /** arcdps build, e.g. "20260718". */
    build: string;
      revision: number;
      bossId: number;
      /** arcdps writes species id 1 for WvW logs. */
    isWvW: boolean;
}

export interface ExtensionRegistration {
      /** Addon signature, stamped into pad61-64 of every event that addon writes. */
    signature: number;
      /** Version string embedded in the record, e.g. "2.18rc1". */
    version: string;
}

/**
 * One healing-addon combat record.
 *
 * arcdps explicitly does not manage extension events, so these are the addon's own
 * conventions, established empirically. The field split partitioned perfectly
 * across all 4,348 events in the reference log.
 */
export interface ExtensionCombatEvent {
      timeMs: number;
      srcInstId: number;
      dstInstId: number;
      skillId: number;
      /**
       * Healing amount, sign-corrected to positive. Read from `value` for direct
       * heals (buff === 0) and `buff_dmg` for buff/tick heals (buff === 1), mirroring
       * arcdps's own strike-vs-condition convention.
       */
    healing: number;
      /** True when this record came through the buff/tick path. */
    isBuffHeal: boolean;
      /**
       * Raw `overstack_value`.
       *
       * UNVERIFIED — deliberately left raw and unnamed. Believed to carry the barrier
       * portion by analogy with base arcdps CBTS_COMBAT (`overstack_value: shield
       * damage`), supported by an exact count match against `is_shields` (848/848).
       * It is definitely NOT overheal: the addon author lists overheal tracking as an
       * unimplemented planned feature. Do not surface as barrier until validated
       * against a reference parse.
       */
    overstackValueUnverified: number;
      /** arcdps `is_shields`. Co-occurs exactly with a non-zero overstack value. */
    shieldFlag: boolean;
      /** Addon signature from pad61-64, for demultiplexing multiple extensions. */
    signature: number;
}

export interface EvtcLog {
      header: EvtcHeader;
      agents: EvtcAgent[];
      skills: Map<number, string>;
      /** Instance id -> agent, resolved from real combat events per the spec. */
    agentsByInstId: Map<number, EvtcAgent>;
      extensions: ExtensionRegistration[];
      extensionCombat: ExtensionCombatEvent[];
      eventCount: number;
}

const decoder = new TextDecoder('utf-8');

/** EVTC strings are fixed-width and null-padded. */
function readCString(bytes: Uint8Array, start: number, maxLen: number): string {
      let end = start;
      const limit = Math.min(start + maxLen, bytes.length);
      while (end < limit && bytes[end] !== 0) end++;
      return decoder.decode(bytes.subarray(start, end));
}

/**
 * Read a null-terminated string and report where it ended *in bytes*.
 *
 * Necessary because EVTC names are UTF-8 and player names routinely contain
 * multi-byte characters. Advancing by JS string `.length` (UTF-16 code units)
 * desynchronises the reader on any such name — e.g. "Geiromül" would shift the
 * account field by one byte and silently land the account string in the subgroup
 * slot. Always walk by byte offset.
 */
function readCStringAt(
      bytes: Uint8Array,
      start: number,
      limit: number,
  ): { value: string; next: number } {
      let end = start;
      const stop = Math.min(limit, bytes.length);
      while (end < stop && bytes[end] !== 0) end++;
      return { value: decoder.decode(bytes.subarray(start, end)), next: Math.min(end + 1, stop) };
}

export class EvtcParseError extends Error {}

/**
 * Parse a raw (already-decompressed) .evtc buffer.
 *
 * `.zevtc` files are zip archives containing a single .evtc member — decompress
 * before calling. Kept separate so this stays dependency-free and worker-safe.
 */
export function parseEvtc(buffer: ArrayBuffer): EvtcLog {
      const bytes = new Uint8Array(buffer);
      const view = new DataView(buffer);

    if (bytes.length < 16) throw new EvtcParseError('File too short to contain an EVTC header');
      if (readCString(bytes, 0, 4) !== 'EVTC') throw new EvtcParseError('Missing EVTC magic bytes');

    const build = decoder.decode(bytes.subarray(4, 12));
      const revision = bytes[12];
      const bossId = view.getUint16(13, true);
      // Revision 0 used a different cbtevent layout. Refuse rather than misparse.
    if (revision !== 1) throw new EvtcParseError(`Unsupported EVTC revision ${revision} (expected 1)`);

    let off = 16;
      const agentCount = view.getUint32(off, true);
      off += 4;
      if (off + agentCount * AGENT_SIZE > bytes.length) {
                throw new EvtcParseError('Agent table extends past end of file');
      }

    const agents: EvtcAgent[] = [];
      const agentByAddress = new Map<string, EvtcAgent>();
      for (let i = 0; i < agentCount; i++) {
                const base = off + i * AGENT_SIZE;
                const address = view.getBigUint64(base, true);
                const isElite = view.getUint32(base + 12, true);
                // Players pack "name\0account\0subgroup\0" into the 64-byte name field.
          // Walk by byte offset — see readCStringAt on why .length is unsafe here.
          const nameField = base + 28;
                const fieldEnd = nameField + 64;
                const nameRead = readCStringAt(bytes, nameField, fieldEnd);
                const accountRead = readCStringAt(bytes, nameRead.next, fieldEnd);
                const subgroupRead = readCStringAt(bytes, accountRead.next, fieldEnd);
                const name = nameRead.value;
                const account = accountRead.value;
                const subgroup = subgroupRead.value;
                const agent: EvtcAgent = {
                              address,
                              profession: view.getUint32(base + 8, true),
                              isElite,
                              name,
                              account,
                              subgroup,
                              // Per spec: is_elite === 0xffffffff means NPC or gadget, not a player.
                              isPlayer: isElite !== 0xffffffff,
                };
                agents.push(agent);
                agentByAddress.set(address.toString(), agent);
      }
      off += agentCount * AGENT_SIZE;

    const skillCount = view.getUint32(off, true);
      off += 4;
      if (off + skillCount * SKILL_SIZE > bytes.length) {
                throw new EvtcParseError('Skill table extends past end of file');
      }
      const skills = new Map<number, string>();
      for (let i = 0; i < skillCount; i++) {
                const base = off + i * SKILL_SIZE;
                skills.set(view.getInt32(base, true), readCString(bytes, base + 4, 64));
      }
      off += skillCount * SKILL_SIZE;

    const eventBytes = bytes.length - off;
      const eventCount = Math.floor(eventBytes / EVENT_SIZE);
      if (eventBytes % EVENT_SIZE !== 0) {
                // Truncated tail: parse what is whole rather than discarding the log.
          // eslint-disable-next-line no-console
          console.warn(`EVTC: ${eventBytes % EVENT_SIZE} trailing bytes are not a whole event; ignoring`);
      }

    const agentsByInstId = new Map<number, EvtcAgent>();
      const extensions: ExtensionRegistration[] = [];
      const extensionCombat: ExtensionCombatEvent[] = [];

    for (let i = 0; i < eventCount; i++) {
              const p = off + i * EVENT_SIZE;
              const statechange = bytes[p + OFF.isStateChange];

          if (statechange === CBTS.COMBAT) {
                        // The spec's own procedure: assign instance ids from non-statechange
                  // records, where src_instid and src_agent both refer to the same actor.
                  const srcInstId = view.getUint16(p + OFF.srcInstId, true);
                        if (srcInstId !== 0 && !agentsByInstId.has(srcInstId)) {
                                          const agent = agentByAddress.get(view.getBigUint64(p + OFF.srcAgent, true).toString());
                                          if (agent) agentsByInstId.set(srcInstId, agent);
                        }
                        continue;
          }

          if (statechange === CBTS.EXTENSION) {
                        // NOTE: the registration record and the combat records put the addon
                  // signature in DIFFERENT places. Registration carries it in src_agent
                  // (offset 8); the per-event records carry it in pad61-64. Verified
                  // against a real log: reading pad61 here yields 0.
                  extensions.push({
                                    signature: view.getUint32(p + OFF.srcAgent, true),
                                    version: readCString(bytes, p + 16, 24),
                  });
                        continue;
          }

          if (statechange === CBTS.EXTENSION_COMBAT) {
                        const isBuffHeal = bytes[p + OFF.buff] === 1;
                        const raw = isBuffHeal
                            ? view.getInt32(p + OFF.buffDmg, true)
                                          : view.getInt32(p + OFF.value, true);
                        extensionCombat.push({
                                          timeMs: Number(view.getBigUint64(p + OFF.time, true)),
                                          srcInstId: view.getUint16(p + OFF.srcInstId, true),
                                          dstInstId: view.getUint16(p + OFF.dstInstId, true),
                                          skillId: view.getUint32(p + OFF.skillId, true),
                                          // The addon writes healing as negative, matching the game's internal
                                          // representation of a heal as negative damage.
                                          healing: raw < 0 ? -raw : raw,
                                          isBuffHeal,
                                          overstackValueUnverified: view.getUint32(p + OFF.overstackValue, true),
                                          shieldFlag: bytes[p + OFF.isShields] === 1,
                                          signature: view.getUint32(p + OFF.pad61, true),
                        });
          }
    }

    return {
              header: { build, revision, bossId, isWvW: bossId === 1 },
              agents,
              skills,
              agentsByInstId,
              extensions,
              extensionCombat,
              eventCount,
    };
}

/** Total observed healing per source instance id. */
export function sumHealingBySource(log: EvtcLog): Map<number, number> {
      const out = new Map<number, number>();
      for (const e of log.extensionCombat) {
                out.set(e.srcInstId, (out.get(e.srcInstId) ?? 0) + e.healing);
      }
      return out;
}

/** Total observed healing per skill id, for cross-checking against EI. */
export function sumHealingBySkill(log: EvtcLog): Map<number, number> {
      const out = new Map<number, number>();
      for (const e of log.extensionCombat) {
                out.set(e.skillId, (out.get(e.skillId) ?? 0) + e.healing);
      }
      return out;
}
