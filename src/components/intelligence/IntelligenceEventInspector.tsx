import { ArrowRight, Clock3, Link2, Skull, Users, X } from "lucide-react";
import { useReport } from "../../store/ReportContext";
import { useView } from "../../store/ViewContext";
import { buildEventDeathEvidence } from "../../lib/intelligence/eventDeathEvidence";
import type { IntelligenceEventInspection } from "../../lib/intelligence/eventInspection";
import type { CriticalEvent } from "../../lib/intelligence/types";
import type { DeathRecapHit, WvWReport } from "../../types/report";

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatOffset(ms: number): string {
  const seconds = Math.abs(ms / 1000).toFixed(1);
  if (ms === 0) return "at anchor";
  return ms < 0 ? `-${seconds}s` : `+${seconds}s`;
}

function formatDamage(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "0";
}

function resolveFightIndex(report: WvWReport | null, fightId: string): number {
  if (!report) return -1;
  const fights = report.stats.fightBreakdown ?? [];
  return fights.findIndex((fight, index) => {
    const aliases = [
      fight.id,
      fight.label,
      fight.fullLabel,
      fight.permalink,
      `fight-${index + 1}`,
      `${fight.mapName}-${index}`,
      `${fight.fullLabel}-${index}`,
    ];
    return aliases.some((alias) => typeof alias === "string" && alias === fightId);
  });
}

function EventRow({ event, anchorMs }: { event: CriticalEvent; anchorMs: number }) {
  const deltaMs = event.timestampMs - anchorMs;
  const deltaSeconds = Math.abs(deltaMs / 1000).toFixed(1);
  const relation = deltaMs < 0 ? `-${deltaSeconds}s` : `+${deltaSeconds}s`;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black text-slate-200">{formatTime(event.timestampMs)}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{relation}</span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{event.kind}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{event.summary}</p>
    </div>
  );
}

function HitList({ title, hits }: { title: string; hits: DeathRecapHit[] }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</div>
      {hits.length > 0 ? (
        <div className="mt-2 grid gap-1.5">
          {hits.slice(-8).map((hit, index) => (
            <div key={`${hit.time}-${hit.id}-${index}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-2 rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2 text-[11px]">
              <span className="font-mono text-slate-500">{formatTime(hit.time)}</span>
              <span className="min-w-0 truncate text-slate-300">{hit.name} <span className="text-slate-600">· {hit.src}</span></span>
              <span className="font-mono font-bold text-rose-200">{formatDamage(hit.damage)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[11px] leading-5 text-slate-600">No recorded damage events in this recap phase.</div>
      )}
    </div>
  );
}

export default function IntelligenceEventInspector({
  inspection,
  fightLabel,
  onClose,
}: {
  inspection: IntelligenceEventInspection;
  fightLabel: string;
  onClose: () => void;
}) {
  const { report } = useReport();
  const { navigateToView } = useView();
  const { event, window, eventsBefore, eventsAfter, relatedFindings, relatedSegments, relatedPlayerKeys, relatedEventIds } = inspection;
  const fightIndex = resolveFightIndex(report, event.fightId);
  const deathEvidence = report?.stats.deathRecaps
    ? buildEventDeathEvidence({
        deathRecaps: report.stats.deathRecaps,
        fightIndex,
        window,
        relatedPlayerKeys,
      })
    : [];

  return (
    <section className="theme-intelligence-dossier border border-sky-400/20 bg-sky-500/[0.035] p-5" aria-label="Selected Intelligence event inspector">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-300">Forensic event inspector</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black uppercase text-slate-100">{event.kind}</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase text-slate-300">{fightLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase text-slate-300">{event.confidence} confidence</span>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{event.summary}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold uppercase text-slate-400 transition hover:border-white/20 hover:text-slate-200"
        >
          <X className="h-4 w-4" /> Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500"><Clock3 className="h-3.5 w-3.5" /> Anchor</div>
          <div className="mt-2 font-mono text-lg font-black text-slate-100">{formatTime(window.anchorTimestampMs)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="text-[10px] font-bold uppercase text-slate-500">Review window</div>
          <div className="mt-2 font-mono text-sm font-black text-slate-100">{formatTime(window.startTimestampMs)} → {formatTime(window.endTimestampMs)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500"><Users className="h-3.5 w-3.5" /> Players linked</div>
          <div className="mt-2 text-lg font-black text-slate-100">{relatedPlayerKeys.length}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500"><Link2 className="h-3.5 w-3.5" /> Evidence ids</div>
          <div className="mt-2 text-lg font-black text-slate-100">{relatedEventIds.length}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
          <div className="text-xs font-black uppercase tracking-wider text-amber-300">Before</div>
          <div className="mt-3 grid gap-2">
            {eventsBefore.length > 0 ? eventsBefore.map((candidate) => (
              <EventRow key={candidate.id} event={candidate} anchorMs={window.anchorTimestampMs} />
            )) : <p className="text-xs leading-5 text-slate-500">No other CriticalEvent was recorded inside the pre-event window.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/[0.05] p-4">
          <div className="text-xs font-black uppercase tracking-wider text-sky-300">Selected moment</div>
          <div className="mt-3 rounded-xl border border-sky-400/20 bg-black/25 p-4">
            <div className="font-mono text-sm font-black text-sky-100">{formatTime(event.timestampMs)}</div>
            <div className="mt-1 text-xs font-black uppercase tracking-wider text-slate-100">{event.kind}</div>
            <p className="mt-2 text-xs leading-5 text-slate-300">{event.summary}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
              <div className="text-lg font-black text-slate-100">{relatedSegments.length}</div>
              <div className="text-[10px] font-bold uppercase text-slate-500">linked windows</div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
              <div className="text-lg font-black text-slate-100">{relatedFindings.length}</div>
              <div className="text-[10px] font-bold uppercase text-slate-500">linked findings</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
          <div className="text-xs font-black uppercase tracking-wider text-emerald-300">After</div>
          <div className="mt-3 grid gap-2">
            {eventsAfter.length > 0 ? eventsAfter.map((candidate) => (
              <EventRow key={candidate.id} event={candidate} anchorMs={window.anchorTimestampMs} />
            )) : <p className="text-xs leading-5 text-slate-500">No other CriticalEvent was recorded inside the post-event window.</p>}
          </div>
        </div>
      </div>

      {deathEvidence.length > 0 && (
        <div className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-500/[0.025] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-300">
              <Skull className="h-4 w-4" /> Death Recap evidence inside this window
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-500">{deathEvidence.length} recorded death{deathEvidence.length === 1 ? "" : "s"}</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            These are the original Death Recap packets whose death timestamps fall inside this event window. Linked player means the account was already attached to the selected Intelligence evidence; it does not assert causation.
          </p>
          <div className="mt-3 grid gap-3">
            {deathEvidence.map(({ recap, linkedPlayer, offsetMs }) => (
              <details key={`${recap.fightIndex}-${recap.account}-${recap.deathTimeMs}`} className="group rounded-xl border border-white/[0.06] bg-black/25 p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-100">{recap.account}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{recap.characterName} · {recap.profession}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {linkedPlayer && <span className="rounded-full border border-sky-400/20 bg-sky-500/[0.06] px-2 py-1 text-[10px] font-bold uppercase text-sky-200">linked player</span>}
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] font-bold text-slate-400">{formatTime(recap.deathTimeMs)} · {formatOffset(offsetMs)}</span>
                    </div>
                  </div>
                </summary>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <HitList title={`To down · ${recap.toDown.length} hits`} hits={recap.toDown} />
                  <HitList title={`Down to death · ${recap.toKill.length} hits`} hits={recap.toKill} />
                </div>
                <div className="mt-4 flex justify-end border-t border-white/[0.06] pt-3">
                  <button
                    type="button"
                    onClick={() => navigateToView("death-recap", {
                      source: "intelligence",
                      fightIndex: recap.fightIndex,
                      account: recap.account,
                      timestampMs: recap.deathTimeMs,
                      eventId: event.id,
                    })}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-200 transition hover:border-rose-300/35 hover:bg-rose-500/[0.1]"
                  >
                    Open full Death Recap <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {relatedFindings.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
          <div className="text-xs font-black uppercase tracking-wider text-violet-300">Evidence-backed findings connected to this event</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {relatedFindings.map((finding) => (
              <div key={finding.id} className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase text-slate-100">{finding.title}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">{finding.confidence}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{finding.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Events shown before and after are temporal neighbors in the same fight window. Entropy does not treat proximity alone as causation.
      </p>
    </section>
  );
}
