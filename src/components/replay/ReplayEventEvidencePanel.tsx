import { BrainCircuit, Crosshair, ShieldCheck, Skull, Users } from "lucide-react";
import type { ReplayData } from "../../lib/parseReplayData";
import { buildReplayEventEvidenceState } from "../../lib/replayEventEvidenceState";
import type { ReplayIntelligenceAnchor } from "../../lib/replayIntelligenceAnchors";

function titleForKind(kind: string): string {
  return kind.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReplayEventEvidencePanel({
  data,
  event,
  t,
  onSelectAccount,
}: {
  data: ReplayData;
  event: ReplayIntelligenceAnchor;
  t: number;
  onSelectAccount: (account: string) => void;
}) {
  const state = buildReplayEventEvidenceState(data, event, t);
  if (!state) return null;

  const names = new Map(data.players.map((player) => [player.account, player.name]));

  return (
    <section className="rounded-xl border border-sky-300/25 bg-sky-400/[0.055] p-3 shadow-[0_0_28px_-22px_rgba(125,211,252,0.9)]">
      <div className="flex items-start justify-between gap-3 border-b border-sky-300/10 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-sky-300/80">
            <BrainCircuit className="h-3 w-3" /> Event evidence · exact timestamp
          </div>
          <div className="mt-1 truncate text-[11px] font-black text-slate-100">{titleForKind(state.kind)}</div>
          <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-500">{state.summary}</p>
        </div>
        <span className="shrink-0 rounded-md border border-sky-300/15 bg-sky-300/[0.06] px-1.5 py-1 text-[8px] font-bold uppercase tracking-wider text-sky-200/80">
          {state.confidence}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500"><Users className="h-3 w-3" /> Participants</div>
          <div className="mt-1 font-mono text-[11px] font-black text-sky-200">{state.trackedParticipants}</div>
        </div>
        <div className="rounded-lg border border-rose-400/10 bg-rose-400/[0.025] px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500"><Skull className="h-3 w-3" /> Down / Dead</div>
          <div className="mt-1 font-mono text-[11px] font-black text-rose-200">{state.downedParticipants} / {state.deadParticipants}</div>
        </div>
        <div className="rounded-lg border border-amber-400/10 bg-amber-400/[0.025] px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500"><Crosshair className="h-3 w-3" /> &gt;600 Tag</div>
          <div className="mt-1 font-mono text-[11px] font-black text-amber-200">{state.beyond600FromTag}</div>
        </div>
        <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/[0.025] px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500"><ShieldCheck className="h-3 w-3" /> Stability</div>
          <div className="mt-1 font-mono text-[11px] font-black text-emerald-200">
            {state.stabilityKnownFor > 0 ? `${state.stabilityPresent}/${state.stabilityKnownFor}` : "—"}
          </div>
        </div>
      </div>

      {state.untrackedParticipants > 0 && (
        <div className="mt-2 text-[8px] leading-relaxed text-slate-600">
          {state.untrackedParticipants} participant{state.untrackedParticipants === 1 ? "" : "s"} lack position coverage at this exact timestamp.
        </div>
      )}

      {event.accounts.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1 border-t border-white/[0.06] pt-2.5">
          {event.accounts.map((account) => {
            if (!names.has(account)) return null;
            return (
              <button
                key={account}
                type="button"
                onClick={() => onSelectAccount(account)}
                title={`Open Tactical State for ${names.get(account)}`}
                className="max-w-[145px] cursor-pointer truncate rounded-md border border-sky-300/15 bg-sky-300/[0.045] px-1.5 py-1 text-[8px] font-semibold text-sky-200/80 transition hover:border-sky-300/30 hover:bg-sky-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
              >
                {names.get(account)}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-2.5 border-t border-white/[0.06] pt-2 text-[8px] leading-relaxed text-slate-600">
        Evidence is descriptive only. Missing position or boon state remains unknown and is not counted as a negative.
      </p>
    </section>
  );
}
