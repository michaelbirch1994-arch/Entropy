import { memo, useMemo } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BrainCircuit, Crosshair, ShieldCheck, Skull, Users } from "lucide-react";
import type { ReplayData } from "../../lib/parseReplayData";
import { buildReplayEventEvidenceState } from "../../lib/replayEventEvidenceState";
import { buildReplayEventNarrative } from "../../lib/replayEventNarrative";
import type { ReplayIntelligenceAnchor } from "../../lib/replayIntelligenceAnchors";
import { buildReplayPreEventChanges, type ReplayPreEventMetric } from "../../lib/replayPreEventChanges";

function titleForKind(kind: string): string {
  return kind.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetric(metric: ReplayPreEventMetric, value: number): string {
  return metric.format === "average" ? value.toFixed(1) : String(Math.round(value));
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0.05) return <ArrowUpRight className="h-3 w-3" />;
  if (delta < -0.05) return <ArrowDownRight className="h-3 w-3" />;
  return <ArrowRight className="h-3 w-3" />;
}

function ReplayEventEvidencePanel({
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
  const state = useMemo(() => buildReplayEventEvidenceState(data, event, t), [data, event, t]);
  const preEvent = useMemo(() => buildReplayPreEventChanges(data, event, 5000), [data, event]);
  const narrative = useMemo(() => buildReplayEventNarrative(preEvent), [preEvent]);
  const names = useMemo(() => new Map(data.players.map((player) => [player.account, player.name])), [data.players]);
  if (!state) return null;
  const changedMetrics = (preEvent?.metrics ?? []).filter((metric) => Math.abs(metric.delta) >= (metric.format === "average" ? 0.5 : 1));

  return (
    <section className="rounded-xl border border-theme-accent/30 bg-theme-accent/[0.055] p-3 shadow-[inset_2px_0_0_color-mix(in_srgb,var(--theme-accent)_55%,transparent)]">
      <div className="flex items-start justify-between gap-3 border-b border-theme-accent/15 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent-strong">
            <BrainCircuit className="h-3 w-3" /> Event evidence · exact timestamp
          </div>
          <div className="mt-1 truncate text-[11px] font-black text-theme-text">{titleForKind(state.kind)}</div>
          <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-theme-muted">{state.summary}</p>
        </div>
        <span className="shrink-0 rounded-md border border-theme-accent/20 bg-theme-accent/[0.07] px-1.5 py-1 text-[8px] font-bold uppercase tracking-wider text-theme-accent-strong">
          {state.confidence}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-theme-border bg-theme-surface-inset/65 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-theme-muted"><Users className="h-3 w-3" /> Participants</div>
          <div className="mt-1 font-mono text-[11px] font-black text-theme-text">{state.trackedParticipants}</div>
        </div>
        <div className="rounded-lg border border-rose-400/10 bg-rose-400/[0.025] px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-theme-muted"><Skull className="h-3 w-3" /> Down / Dead</div>
          <div className="mt-1 font-mono text-[11px] font-black text-rose-200">{state.downedParticipants} / {state.deadParticipants}</div>
        </div>
        <div className="rounded-lg border border-amber-400/10 bg-amber-400/[0.025] px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-theme-muted"><Crosshair className="h-3 w-3" /> &gt;600 Tag</div>
          <div className="mt-1 font-mono text-[11px] font-black text-amber-200">{state.beyond600FromTag}</div>
        </div>
        <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/[0.025] px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-theme-muted"><ShieldCheck className="h-3 w-3" /> Stability</div>
          <div className="mt-1 font-mono text-[11px] font-black text-emerald-200">
            {state.stabilityKnownFor > 0 ? `${state.stabilityPresent}/${state.stabilityKnownFor}` : "—"}
          </div>
        </div>
      </div>

      {state.untrackedParticipants > 0 && (
        <div className="mt-2 text-[8px] leading-relaxed text-theme-faint">
          {state.untrackedParticipants} participant{state.untrackedParticipants === 1 ? "" : "s"} lack position coverage at this exact timestamp.
        </div>
      )}

      {narrative && (
        <div className="mt-3 rounded-lg border border-theme-accent/20 bg-theme-accent/[0.04] px-2.5 py-2.5">
          <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-theme-accent-strong">
            <BrainCircuit className="h-3 w-3" /> {narrative.headline}
          </div>
          {narrative.statements.length > 0 ? (
            <div className="mt-1.5 space-y-1">
              {narrative.statements.map((statement) => (
                <p key={statement.key} className="text-[9px] leading-relaxed text-theme-text/80">
                  {statement.text}
                </p>
              ))}
            </div>
          ) : narrative.fallback ? (
            <p className="mt-1.5 text-[9px] leading-relaxed text-theme-muted">{narrative.fallback}</p>
          ) : null}
          <div className="mt-1.5 text-[7px] text-theme-faint">Verified change summary only — no causal interpretation.</div>
        </div>
      )}

      {preEvent && (
        <div className="mt-3 border-t border-theme-border/60 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.16em] text-theme-accent/85">Previous 5 seconds</div>
              <div className="mt-0.5 text-[8px] text-theme-faint">Tracked state change before this event — descriptive, not causal.</div>
            </div>
            <span className="shrink-0 font-mono text-[8px] text-theme-faint">-5.0s → event</span>
          </div>

          {changedMetrics.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {changedMetrics.map((metric) => (
                <div key={metric.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-theme-border/70 bg-theme-surface-inset/55 px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[8px] font-semibold text-theme-muted">{metric.label}</div>
                    <div className="mt-0.5 text-[7px] text-theme-faint">coverage {metric.coverageBefore} → {metric.coverageAtEvent}</div>
                  </div>
                  <div className="font-mono text-[9px] text-theme-muted">{formatMetric(metric, metric.before)} → <span className="text-theme-text">{formatMetric(metric, metric.atEvent)}</span></div>
                  <div className={`inline-flex min-w-9 items-center justify-end gap-0.5 font-mono text-[8px] ${Math.abs(metric.delta) > 0.05 ? "text-theme-accent-strong" : "text-theme-faint"}`}>
                    <DeltaIcon delta={metric.delta} />{metric.delta > 0 ? "+" : ""}{metric.format === "average" ? metric.delta.toFixed(1) : Math.round(metric.delta)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-md border border-theme-border/60 bg-theme-surface-inset/45 px-2 py-2 text-[8px] text-theme-faint">
              No material tracked change crossed the display threshold in this 5-second window.
            </div>
          )}
        </div>
      )}

      {event.accounts.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1 border-t border-theme-border/60 pt-2.5">
          {event.accounts.map((account) => {
            if (!names.has(account)) return null;
            return (
              <button
                key={account}
                type="button"
                onClick={() => onSelectAccount(account)}
                title={`Open Tactical State for ${names.get(account)}`}
                className="max-w-[145px] cursor-pointer truncate rounded-md border border-theme-accent/20 bg-theme-accent/[0.045] px-1.5 py-1 text-[8px] font-semibold text-theme-accent-strong transition hover:border-theme-accent/35 hover:bg-theme-accent/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent-strong/50"
              >
                {names.get(account)}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-2.5 border-t border-theme-border/60 pt-2 text-[8px] leading-relaxed text-theme-faint">
        Evidence is descriptive only. Missing position or boon state remains unknown and is not counted as a negative.
      </p>
    </section>
  );
}

export default memo(ReplayEventEvidencePanel);
