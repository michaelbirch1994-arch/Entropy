import type { RawFightLog } from "../types/rawFight";

export interface ReplayInspectionEffect {
  id: number;
  name: string;
  icon?: string;
  classification: string;
  stacks: number;
}

export interface ReplayPlayerInspection {
  account: string;
  name: string;
  profession: string;
  boons: ReplayInspectionEffect[];
  conditions: ReplayInspectionEffect[];
  hasTimestampedBuffState: boolean;
  controlEffects: string[];
  hardCcKnown: boolean;
}

const CONTROL_EFFECT_NAMES = new Set([
  "fear",
  "taunt",
  "immobilize",
  "immobilized",
  "stun",
  "daze",
  "knockdown",
  "knockback",
  "launch",
  "float",
  "sink",
  "pull",
]);

function stackAt(states: unknown, t: number): number {
  if (!Array.isArray(states) || states.length === 0) return 0;
  let lo = 0;
  let hi = states.length - 1;
  let found = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const entry = states[mid];
    if (!Array.isArray(entry) || typeof entry[0] !== "number" || typeof entry[1] !== "number") {
      return 0;
    }
    if (entry[0] <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (found < 0) return 0;
  const value = states[found][1];
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function inspectReplayPlayer(
  log: RawFightLog,
  account: string,
  t: number,
): ReplayPlayerInspection | null {
  const rawLog = log as unknown as Record<string, unknown>;
  const players = (log.players ?? []) as unknown as Array<Record<string, unknown>>;
  const player = players.find((candidate) => {
    const candidateAccount = typeof candidate.account === "string" ? candidate.account : "";
    return candidateAccount === account;
  });
  if (!player) return null;

  const buffMap = (rawLog.buffMap ?? {}) as Record<
    string,
    { name?: string; icon?: string; classification?: string }
  >;
  const buffUptimes = Array.isArray(player.buffUptimes)
    ? (player.buffUptimes as Array<Record<string, unknown>>)
    : [];

  let hasTimestampedBuffState = false;
  const boons: ReplayInspectionEffect[] = [];
  const conditions: ReplayInspectionEffect[] = [];

  for (const entry of buffUptimes) {
    const id = Number(entry.id);
    if (!Number.isFinite(id)) continue;
    const states = entry.states;
    if (!Array.isArray(states) || states.length === 0) continue;
    hasTimestampedBuffState = true;

    const stacks = stackAt(states, t);
    if (stacks <= 0) continue;

    const meta = buffMap[`b${id}`] ?? buffMap[String(id)] ?? {};
    const classification = typeof meta.classification === "string" ? meta.classification : "";
    if (classification !== "Boon" && classification !== "Condition") continue;

    const effect: ReplayInspectionEffect = {
      id,
      name: typeof meta.name === "string" && meta.name ? meta.name : `Effect ${id}`,
      icon: typeof meta.icon === "string" ? meta.icon : undefined,
      classification,
      stacks,
    };

    if (classification === "Boon") boons.push(effect);
    else conditions.push(effect);
  }

  boons.sort((a, b) => a.name.localeCompare(b.name));
  conditions.sort((a, b) => a.name.localeCompare(b.name));

  const controlEffects = conditions
    .filter((effect) => CONTROL_EFFECT_NAMES.has(effect.name.toLowerCase()))
    .map((effect) => effect.name);

  // EI's buff state timeline can prove condition-based control such as Fear,
  // Taunt or Immobilize when those effects are present. It does not provide a
  // complete timestamped hard-CC timeline for stun/daze/launch/etc. in every
  // hosted JSON report, so absence of a matching effect is not evidence that
  // the player is definitely not CC'd.
  const hardCcKnown = controlEffects.length > 0;

  return {
    account,
    name: typeof player.name === "string" ? player.name : account,
    profession: typeof player.profession === "string" ? player.profession : "Unknown",
    boons,
    conditions,
    hasTimestampedBuffState,
    controlEffects,
    hardCcKnown,
  };
}
