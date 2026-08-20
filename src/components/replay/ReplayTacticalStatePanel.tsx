import { Activity, Crosshair, Shield, Swords, Users } from "lucide-react";
import type { ReplayData, ReplayEffectTrack, ReplayPlayerTrack } from "../../lib/parseReplayData";
import { distanceBetween, interpolatePosition, isInInterval } from "../../lib/parseReplayData";

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

function stacksAt(effect: ReplayEffectTrack, t: number): number {
  const states = effect.states ?? [];
  if (states.length === 0) return 0;
  let lo = 0;
  let hi = states.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (states[mid][0] <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return 0;
  const stacks = states[found][1];
  return Number.isFinite(stacks) && stacks > 0 ? stacks : 0;
}

function EffectRow({ effects, empty }: { effects: Array<ReplayEffectTrack & { stacks: number }>; empty: string }) {
  if (effects.length === 0) return <div className="text-[10px] text-slate-600">{empty}</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {effects.map((effect) => (
        <span
          key={`${effect.classification}-${effect.id}`}
          title={`${effect.name}${effect.stacks > 1 ? ` ×${effect.stacks}` : ""}`}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[9px] font-semibold ${
            effect.classification === "Boon"
              ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200"
              : "border-rose-400/20 bg-rose-400/[0.08] text-rose-200"
          }`}
        >
          {effect.icon ? (
            <img src={effect.icon} alt="" className="h-4 w-4 rounded-sm" referrerPolicy="no-referrer" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          )}
          <span className="max-w-24 truncate">{effect.name}</span>
          {effect.stacks > 1 && <span className="font-mono opacity-80">×{effect.stacks}</span>}
        </span>
      ))}
    </div>
  );
}

export default function ReplayTacticalStatePanel({
  data,
  player,
  t,
}: {
  data: ReplayData;
  player: ReplayPlayerTrack | null;
  t: number;
}) {
  if (!player) {
    return (
      <aside className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#080d18]/90 px-5 text-center">
        <Crosshair className="mb-3 h-5 w-5 text-sky-400/60" />
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Tactical State</div>
        <p className="mt-2 max-w-52 text-[10px] leading-relaxed text-slate-500">
          Pause the replay and select a squad marker to inspect that player at the exact timestamp.
        </p>
      </aside>
    );
  }

  const point = interpolatePosition(player.points, t);
  const isDead = isInInterval(player.deadIntervals, t);
  const isDown = !isDead && isInInterval(player.downIntervals, t);
  const commander = data.players.find((candidate) => candidate.inSquad && candidate.isCommander) ?? null;
  const commanderPoint = commander ? interpolatePosition(commander.points, t) : null;
  const distanceToTag = player.isCommander ? 0 : distanceBetween(point, commanderPoint);

  const nearbySquad = point
    ? data.players
        .filter((candidate) => candidate.inSquad && candidate.account !== player.account && !isInInterval(candidate.deadIntervals, t))
        .map((candidate) => distanceBetween(point, interpolatePosition(candidate.points, t)))
        .filter((distance): distance is number => distance != null && Number.isFinite(distance))
    : [];
  const nearbyEnemies = point
    ? data.enemies
        .filter((enemy) => !isInInterval(enemy.deadIntervals, t))
        .map((enemy) => distanceBetween(point, interpolatePosition(enemy.points, t)))
        .filter((distance): distance is number => distance != null && Number.isFinite(distance))
    : [];

  const activeEffects = (player.effects ?? [])
    .map((effect) => ({ ...effect, stacks: stacksAt(effect, t) }))
    .filter((effect) => effect.stacks > 0);
  const boons = activeEffects.filter((effect) => effect.classification === "Boon");
  const conditions = activeEffects.filter((effect) => effect.classification === "Condition");
  const controls = conditions.filter((effect) => CONTROL_EFFECT_NAMES.has(effect.name.toLowerCase()));
  const recentCasts = (player.casts ?? [])
    .filter((cast) => Math.abs(cast.t - t) <= 2500)
    .map((cast) => ({ ...cast, name: data.skillMeta[cast.skillId]?.name ?? `Skill ${cast.skillId}` }))
    .sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))
    .slice(0, 4);

  return (
    <aside className="min-h-[420px] rounded-xl border border-sky-400/15 bg-[#080d18]/95 p-4 shadow-[0_0_35px_-25px_rgba(56,189,248,0.75)]">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-400/70">Tactical State · exact timestamp</div>
          <div className="mt-1 truncate text-sm font-black text-slate-100">{player.name}</div>
          <div className="truncate text-[10px] text-slate-500">{player.account}</div>
        </div>
        <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-slate-300">
          {player.profession}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500"><Shield className="h-3 w-3" /> Status</div>
          <div className={`mt-1 text-[11px] font-black ${isDead ? "text-slate-500" : isDown ? "text-rose-300" : "text-emerald-300"}`}>
            {isDead ? "Dead" : isDown ? "Downed" : point ? "Active" : "Untracked"}
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500"><Crosshair className="h-3 w-3" /> To Tag</div>
          <div className="mt-1 font-mono text-[11px] font-black text-sky-300">{distanceToTag == null ? "—" : Math.round(distanceToTag)}</div>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500"><Users className="h-3 w-3" /> Nearby</div>
          <div className="mt-1 font-mono text-[11px] font-black text-slate-200">{nearbySquad.filter((d) => d <= 240).length}<span className="text-slate-600"> /240</span></div>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-rose-400/10 bg-rose-400/[0.025] px-3 py-2">
        <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-slate-500">
          <span>Tracked enemies within 600</span>
          <span className="font-mono text-rose-300">{nearbyEnemies.filter((d) => d <= 600).length}</span>
        </div>
      </div>

      <section className="mt-4">
        <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-400/75">Boons active now</div>
        <EffectRow effects={boons} empty={(player.effects ?? []).length > 0 ? "No boons active at this timestamp." : "Timestamped boon state unavailable in this report."} />
      </section>

      <section className="mt-4">
        <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-rose-400/75">Conditions active now</div>
        <EffectRow effects={conditions} empty={(player.effects ?? []).length > 0 ? "No conditions active at this timestamp." : "Timestamped condition state unavailable in this report."} />
        {controls.length > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-rose-200">
            <Activity className="h-3 w-3" /> Condition-backed CC: {controls.map((effect) => effect.name).join(", ")}
          </div>
        )}
      </section>

      <section className="mt-4 border-t border-white/[0.07] pt-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-400/75">
          <Swords className="h-3 w-3" /> Recent damaging casts ±2.5s
        </div>
        {recentCasts.length === 0 ? (
          <div className="text-[10px] text-slate-600">No matching damaging casts in the inspection window.</div>
        ) : (
          <div className="space-y-1">
            {recentCasts.map((cast, index) => (
              <div key={`${cast.t}-${cast.skillId}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.025] px-2 py-1.5 text-[10px]">
                <span className="truncate text-slate-300">{cast.name}</span>
                <span className="shrink-0 font-mono text-slate-500">{cast.t === t ? "now" : `${cast.t > t ? "+" : ""}${((cast.t - t) / 1000).toFixed(1)}s`}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-4 border-t border-white/[0.07] pt-3 text-[9px] leading-relaxed text-slate-600">
        Condition-based control can be proven when present. Absence does not prove the player was free of hard CC because hosted EI state does not expose every stun/daze/launch timeline.
      </p>
    </aside>
  );
}
