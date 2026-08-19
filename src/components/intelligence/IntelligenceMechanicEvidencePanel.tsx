import { Activity, Clock3 } from "lucide-react";
import { useMemo } from "react";
import { useReport } from "../../store/ReportContext";
import { buildEventMechanicEvidence, type EventMechanicEvidence } from "../../lib/intelligence/eventMechanicEvidence";
import type { IntelligenceEventWindow } from "../../lib/intelligence/eventInspection";

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatOffset(ms: number): string {
  if (ms === 0) return "anchor";
  const seconds = Math.abs(ms / 1000).toFixed(1);
  return ms < 0 ? `-${seconds}s` : `+${seconds}s`;
}

const RELATION_STYLE: Record<EventMechanicEvidence["relation"], string> = {
  before: "border-amber-400/20 bg-amber-500/[0.06] text-amber-200",
  anchor: "border-sky-400/25 bg-sky-500/[0.08] text-sky-100",
  after: "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-200",
};

function MechanicCard({ mechanic }: { mechanic: EventMechanicEvidence }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-black text-slate-200">{formatTime(mechanic.timestampMs)}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{formatOffset(mechanic.offsetMs)}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${RELATION_STYLE[mechanic.relation]}`}>{mechanic.relation}</span>
        <span className="rounded-full border border-violet-400/15 bg-violet-500/[0.05] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-200">{mechanic.severity}</span>
        {mechanic.linkedPlayer && <span className="rounded-full border border-sky-400/20 bg-sky-500/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-200">linked player</span>}
      </div>
      <div className="mt-2 text-xs font-black text-slate-100">{mechanic.name}</div>
      <div className="mt-1 text-[11px] text-slate-500">Actor: <span className="text-slate-300">{mechanic.actor || "unknown"}</span>{mechanic.account ? <> · Account: <span className="text-slate-300">{mechanic.account}</span></> : null}</div>
    </div>
  );
}

export default function IntelligenceMechanicEvidencePanel({ fightId, window, relatedPlayerKeys }: { fightId: string; window: IntelligenceEventWindow; relatedPlayerKeys: string[] }) {
  const { report } = useReport();
  const mechanics = useMemo(() => report?.stats.replayFights ? buildEventMechanicEvidence({ replayFights: report.stats.replayFights, fightId, window, relatedPlayerKeys }) : [], [report?.stats.replayFights, fightId, window, relatedPlayerKeys]);
  if (mechanics.length === 0) return null;

  const before = mechanics.filter((mechanic) => mechanic.relation === "before");
  const anchor = mechanics.filter((mechanic) => mechanic.relation === "anchor");
  const after = mechanics.filter((mechanic) => mechanic.relation === "after");

  return (
    <section className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.025] p-4" aria-label="Replay mechanics in selected Intelligence window">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-violet-300"><Activity className="h-4 w-4" /> Mechanics nervous-system trace</div>
        <span className="text-[10px] font-bold uppercase text-slate-500">{mechanics.length} recorded mechanic{mechanics.length === 1 ? "" : "s"}</span>
      </div>
      <p className="mt-2 max-w-5xl text-[11px] leading-5 text-slate-500">These are the existing Fight Replay mechanic markers inside this Intelligence window. Entropy keeps their exact timing and actor identity, but does not claim that a nearby mechanic caused the selected event.</p>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.02] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-amber-300">Before</span><span className="font-mono text-[10px] text-slate-600">{before.length}</span></div><div className="mt-2 grid gap-2">{before.length ? before.map((mechanic, index) => <MechanicCard key={`${mechanic.timestampMs}-${mechanic.name}-${index}`} mechanic={mechanic} />) : <p className="text-[11px] leading-5 text-slate-600">No replay mechanic markers before the anchor inside this window.</p>}</div></div>
        <div className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.035] p-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-300"><Clock3 className="h-3 w-3" /> At anchor</span><span className="font-mono text-[10px] text-slate-600">{anchor.length}</span></div><div className="mt-2 grid gap-2">{anchor.length ? anchor.map((mechanic, index) => <MechanicCard key={`${mechanic.timestampMs}-${mechanic.name}-${index}`} mechanic={mechanic} />) : <p className="text-[11px] leading-5 text-slate-600">No mechanic marker occurred at the exact Intelligence anchor timestamp.</p>}</div></div>
        <div className="rounded-2xl border border-emerald-400/10 bg-emerald-500/[0.02] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">After</span><span className="font-mono text-[10px] text-slate-600">{after.length}</span></div><div className="mt-2 grid gap-2">{after.length ? after.map((mechanic, index) => <MechanicCard key={`${mechanic.timestampMs}-${mechanic.name}-${index}`} mechanic={mechanic} />) : <p className="text-[11px] leading-5 text-slate-600">No replay mechanic markers after the anchor inside this window.</p>}</div></div>
      </div>
    </section>
  );
}
