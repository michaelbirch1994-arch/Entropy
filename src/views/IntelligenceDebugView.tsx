import { useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  Flame,
  FileWarning,
  Gauge,
  ListChecks,
  MapPinned,
  Radar,
  ShieldAlert,
  Swords,
} from "lucide-react";
import { useReport } from "../store/ReportContext";
import {
  buildIntelligenceDashboard,
  type IntelligenceDashboard,
  type IntelligenceEngagementInsight,
  type IntelligenceReadiness,
  type IntelligenceTimelineItem,
} from "../lib/intelligence/intelligenceDashboard";
import type { FindingSeverity, IntelligenceFinding, CriticalEvent } from "../lib/intelligence/types";
import type { WvWReport } from "../types/report";

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface FightContext {
  id: string;
  index: number;
  label: string;
  name: string;
  result?: "win" | "loss";
  squadCount: number;
  enemyCount: number;
  downs: number;
  deaths: number;
}

const UNKNOWN_FIGHT: FightContext = {
  id: "unknown",
  index: Number.MAX_SAFE_INTEGER,
  label: "Unknown fight",
  name: "Fight context unavailable",
  squadCount: 0,
  enemyCount: 0,
  downs: 0,
  deaths: 0,
};

function addFightAlias(map: Map<string, FightContext>, key: unknown, context: FightContext) {
  if (typeof key !== "string" || key.trim().length === 0) return;
  map.set(key, context);
}

function buildFightContextMap(report: WvWReport, dashboard: IntelligenceDashboard): Map<string, FightContext> {
  const map = new Map<string, FightContext>();
  const fights = report.stats.fightBreakdown ?? [];

  fights.forEach((fight, index) => {
    const name = fight.fullLabel || fight.mapName || fight.label || `Fight ${index + 1}`;
    const context: FightContext = {
      id: String(fight.id || `fight-${index + 1}`),
      index,
      label: `Fight ${index + 1}`,
      name,
      result: fight.isWin ? "win" : "loss",
      squadCount: Number(fight.squadCount) || 0,
      enemyCount: Number(fight.enemyCount) || 0,
      downs: Number(fight.alliesDown) || 0,
      deaths: Number(fight.alliesDead) || 0,
    };

    addFightAlias(map, fight.id, context);
    addFightAlias(map, fight.label, context);
    addFightAlias(map, fight.fullLabel, context);
    addFightAlias(map, fight.permalink, context);
    addFightAlias(map, `fight-${index + 1}`, context);
    addFightAlias(map, `${fight.mapName}-${index}`, context);
    addFightAlias(map, `${fight.fullLabel}-${index}`, context);
  });

  dashboard.segments.forEach((segment) => {
    if (map.has(segment.fightId)) return;
    const index = Math.max(0, segment.index);
    const context: FightContext = {
      id: segment.fightId,
      index,
      label: `Fight ${index + 1}`,
      name: segment.note || segment.fightId,
      squadCount: 0,
      enemyCount: 0,
      downs: segment.downs,
      deaths: segment.deaths,
    };
    addFightAlias(map, segment.fightId, context);
  });

  return map;
}

function fightContextFor(map: Map<string, FightContext>, fightId?: string): FightContext {
  if (!fightId) return UNKNOWN_FIGHT;
  return map.get(fightId) ?? { ...UNKNOWN_FIGHT, id: fightId, name: fightId };
}

function contextForTimelineItem(
  item: IntelligenceTimelineItem,
  segmentById: Map<string, IntelligenceEngagementInsight>,
  fightContexts: Map<string, FightContext>,
): FightContext {
  const segment = segmentById.get(item.id);
  return fightContextFor(fightContexts, segment?.fightId);
}

const READINESS_STYLE: Record<IntelligenceReadiness, { label: string; classes: string; icon: ReactNode }> = {
  stable: {
    label: "Stable",
    classes: "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  review: {
    label: "Review",
    classes: "border-amber-400/20 bg-amber-500/[0.08] text-amber-200",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  "high-risk": {
    label: "High risk",
    classes: "border-rose-400/25 bg-rose-500/[0.08] text-rose-200",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
};

const SEVERITY_STYLE: Record<FindingSeverity, string> = {
  info: "border-sky-400/20 bg-sky-500/[0.06] text-sky-200",
  notable: "border-violet-400/20 bg-violet-500/[0.06] text-violet-200",
  significant: "border-amber-400/20 bg-amber-500/[0.07] text-amber-200",
  critical: "border-rose-400/25 bg-rose-500/[0.08] text-rose-200",
};

const PRESSURE_STYLE: Record<IntelligenceEngagementInsight["pressureLabel"], { label: string; bar: string; text: string; border: string }> = {
  quiet: {
    label: "Quiet",
    bar: "from-sky-500 to-cyan-300",
    text: "text-sky-200",
    border: "border-sky-400/15 bg-sky-500/[0.04]",
  },
  watch: {
    label: "Watch",
    bar: "from-violet-500 to-fuchsia-300",
    text: "text-violet-200",
    border: "border-violet-400/15 bg-violet-500/[0.04]",
  },
  danger: {
    label: "Danger",
    bar: "from-amber-500 to-orange-300",
    text: "text-amber-200",
    border: "border-amber-400/20 bg-amber-500/[0.05]",
  },
  critical: {
    label: "Critical",
    bar: "from-rose-600 to-red-300",
    text: "text-rose-200",
    border: "border-rose-400/25 bg-rose-500/[0.06]",
  },
};

function Pill({
  children,
  className = "border-white/10 bg-white/[0.04] text-slate-300",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${className}`}>
      {children}
    </span>
  );
}

function FightContextStrip({ context, compact = false }: { context: FightContext; compact?: boolean }) {
  const resultClass = context.result === "win"
    ? "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-300"
    : context.result === "loss"
      ? "border-rose-400/20 bg-rose-500/[0.06] text-rose-300"
      : "border-slate-400/15 bg-slate-500/[0.05] text-slate-400";

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "rounded-xl border border-white/[0.06] bg-black/25 p-3"}>
      <Pill className="border-sky-400/20 bg-sky-500/[0.06] text-sky-200">
        <MapPinned className="h-3 w-3" /> {context.label}
      </Pill>
      <Pill className={resultClass}>{context.result ?? "context"}</Pill>
      <Pill>
        <Swords className="h-3 w-3" /> {context.squadCount || "?"}v{context.enemyCount || "?"}
      </Pill>
      {!compact && (
        <div className="mt-2 truncate text-xs font-bold text-slate-300">{context.name}</div>
      )}
    </div>
  );
}

function PressureBar({ percent, label }: { percent: number; label: IntelligenceEngagementInsight["pressureLabel"] }) {
  const style = PRESSURE_STYLE[label];
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full bg-gradient-to-r ${style.bar}`} style={{ width: `${Math.min(100, Math.max(4, percent))}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span>Pressure</span>
        <span className={style.text}>{style.label}</span>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#070b16]/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-amber-400">{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-black text-slate-100">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
    </div>
  );
}

function CoverageBars({ dashboard }: { dashboard: IntelligenceDashboard }) {
  const coverage = [
    ["Fight list", dashboard.coverage.fightRows, "Names, result, squad/enemy size"],
    ["Replay positions", dashboard.coverage.replay, "Movement and spacing context"],
    ["Mechanic markers", dashboard.coverage.mechanics, "Encounter mechanics/events"],
    ["Death recaps", dashboard.coverage.deathRecaps, "What killed each player"],
    ["Survival support", dashboard.coverage.survivalSupport, "Who healed or protected whom"],
  ] as const;
  const present = coverage.filter(([, ok]) => ok).length;
  const percent = Math.round((present / coverage.length) * 100);

  return (
    <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Report data sources</h3>
        <Pill className="border-sky-400/20 bg-sky-500/[0.06] text-sky-200">{present}/{coverage.length} available</Pill>
      </div>
      <div className="mt-4">
        <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-amber-400 to-emerald-300" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 text-xs leading-5 text-slate-500">
          These sources tell Entropy what it can safely connect. Missing data is a blind spot, not a failed report.
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {coverage.map(([label, ok, detail]) => (
          <div key={label} className="grid grid-cols-[120px_1fr_80px] items-center gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
              <div className="text-[10px] leading-4 text-slate-600">{detail}</div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full ${ok ? "bg-emerald-300" : "bg-slate-700"}`} style={{ width: ok ? "100%" : "18%" }} />
            </div>
            <span className={ok ? "text-right text-[10px] font-bold uppercase text-emerald-300" : "text-right text-[10px] font-bold uppercase text-slate-500"}>
              {ok ? "available" : "missing"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EngagementCard({ insight, fightContext }: { insight: IntelligenceEngagementInsight; fightContext: FightContext }) {
  const style = PRESSURE_STYLE[insight.pressureLabel];
  return (
    <div className={`rounded-2xl border p-4 ${style.border}`}>
      <div className="mb-3">
        <FightContextStrip context={fightContext} compact />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Review priority {insight.priority}</div>
          <h3 className="mt-1 text-base font-black uppercase tracking-wider text-slate-100">{insight.label}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-300">{insight.reviewPrompt}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill className={`${style.border} ${style.text}`}>{style.label}</Pill>
          <Pill>{formatTime(insight.timestampMs)} into fight</Pill>
        </div>
      </div>

      <div className="mt-4">
        <PressureBar percent={insight.pressurePercent} label={insight.pressureLabel} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="text-lg font-black text-amber-200">{insight.downs}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">downs</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="text-lg font-black text-rose-200">{insight.deaths}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">deaths</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="text-lg font-black text-sky-200">{insight.criticalEvents}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">events</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {insight.evidencePoints.slice(0, 3).map((point) => (
          <div key={point} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
            {point}
          </div>
        ))}
      </div>
    </div>
  );
}

function DownsDeathsChart({ engagements, fightContexts }: { engagements: IntelligenceEngagementInsight[]; fightContexts: Map<string, FightContext> }) {
  const rows = engagements.slice(0, 8);
  const maxValue = Math.max(1, ...rows.map((row) => Math.max(row.downs, row.deaths)));

  return (
    <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Pressure by fight window</h3>
        <Pill>top {rows.length} windows</Pill>
      </div>
      <div className="mt-5 grid gap-4">
        {rows.map((row) => {
          const context = fightContextFor(fightContexts, row.fightId);
          return (
            <div key={row.id} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-xs font-bold uppercase tracking-wider text-slate-400">
                  {context.label} · {formatTime(row.timestampMs)} · {row.label}
                </span>
                <span className="font-mono text-[11px] text-slate-500">{row.downs}/{row.deaths}</span>
              </div>
              <div className="grid gap-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200" style={{ width: `${Math.max(3, (row.downs / maxValue) * 100)}%` }} />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-600 to-red-300" style={{ width: `${Math.max(3, (row.deaths / maxValue) * 100)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="text-sm text-slate-500">No engagement windows available.</div>}
      </div>
      <div className="mt-4 flex gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-300" /> Downs</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> Deaths</span>
      </div>
    </div>
  );
}

function EmptyState({ dashboard }: { dashboard: IntelligenceDashboard }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-5">
      <div className="flex items-start gap-3">
        <FileWarning className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
        <p className="text-sm leading-6 text-slate-400">
          {dashboard.persisted
            ? "No current finding rule produced a supported conclusion. Entropy stays quiet when the evidence does not support a claim."
            : "This report predates persisted Intelligence data. Re-import raw logs with the current app to populate critical events, engagement windows, and findings."}
        </p>
      </div>
    </div>
  );
}

function FindingCard({ finding, fightContext }: { finding: IntelligenceFinding; fightContext: FightContext }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#080d19]/80 p-5">
      <div className="mb-3">
        <FightContextStrip context={fightContext} compact />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">{finding.title}</h3>
            <Pill className={SEVERITY_STYLE[finding.severity]}>{finding.severity}</Pill>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{finding.summary}</p>
        </div>
        <Pill>{finding.confidence}</Pill>
      </div>
      <div className="mt-4 grid gap-2">
        {finding.evidence.map((evidence, index) => (
          <div key={index} className="rounded-xl border border-white/[0.06] bg-black/25 p-3 text-xs leading-5 text-slate-300">
            {evidence.statement}
          </div>
        ))}
      </div>
    </div>
  );
}

function CriticalEventCard({ event, fightContext }: { event: CriticalEvent; fightContext: FightContext }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Pill className="border-sky-400/20 bg-sky-500/[0.06] text-sky-200">{fightContext.label}</Pill>
        <Pill>{formatTime(event.timestampMs)} into fight</Pill>
        <Pill>{event.confidence}</Pill>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wider text-slate-100">{event.kind}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{fightContext.name}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{event.summary}</p>
    </div>
  );
}

export default function IntelligenceDebugView() {
  const { report } = useReport();
  const dashboard = useMemo(() => (report ? buildIntelligenceDashboard(report) : null), [report]);

  if (!report || !dashboard) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-500/10 bg-black/40 p-6 text-slate-300">
          Load a report to open Entropy Intelligence.
        </div>
      </div>
    );
  }

  const readiness = READINESS_STYLE[dashboard.readiness];
  const topEngagements = dashboard.engagements.slice(0, 3);
  const fightContexts = buildFightContextMap(report, dashboard);
  const segmentById = new Map(dashboard.engagements.map((engagement) => [engagement.id, engagement]));
  const chronologicalTimeline = [...dashboard.timeline].sort((a, b) => {
    const af = contextForTimelineItem(a, segmentById, fightContexts);
    const bf = contextForTimelineItem(b, segmentById, fightContexts);
    return af.index - bf.index || a.timestampMs - b.timestampMs;
  });

  return (
    <div className="space-y-6 pb-12">
      <section className={`rounded-[2rem] border p-6 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)] ${readiness.classes}`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-current/20 bg-black/20 p-3">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.28em] opacity-75">Entropy Intelligence</div>
                <h2 className="mt-1 text-2xl font-black uppercase tracking-wider text-slate-100">{dashboard.headline}</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{dashboard.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill className={`${readiness.classes} border-current/20`}>
              {readiness.icon}
              {readiness.label}
            </Pill>
            <Pill className={dashboard.persisted ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : "border-amber-400/20 bg-amber-500/10 text-amber-300"}>
              {dashboard.persisted ? "persisted data" : "legacy fallback"}
            </Pill>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Gauge className="h-5 w-5" />} label="Highest pressure" value={dashboard.engagements[0] ? `${dashboard.engagements[0].pressureScore}/100` : "0/100"} detail={dashboard.engagements[0] ? `${fightContextFor(fightContexts, dashboard.engagements[0].fightId).label} · ${dashboard.engagements[0].label}` : "No engagement windows available."} />
        <StatCard icon={<Flame className="h-5 w-5" />} label="Review first" value={dashboard.engagements[0] ? `#${dashboard.engagements[0].priority}` : "None"} detail={dashboard.engagements[0]?.reviewPrompt ?? "Load or re-import a report for review targets."} />
        <StatCard icon={<BrainCircuit className="h-5 w-5" />} label="Findings" value={formatNumber(dashboard.totals.findings)} detail="Evidence-backed conclusions tied to specific fights." />
        <StatCard icon={<Database className="h-5 w-5" />} label="Downs / deaths" value={`${formatNumber(dashboard.totals.downs)} / ${formatNumber(dashboard.totals.deaths)}`} detail="From Intelligence windows, grouped by fight." />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Priority engagements</h3>
            <Pill>{dashboard.engagements.length} windows across {fightContexts.size || "unknown"} fights</Pill>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {topEngagements.length > 0 ? topEngagements.map((insight) => (
              <EngagementCard key={insight.id} insight={insight} fightContext={fightContextFor(fightContexts, insight.fightId)} />
            )) : <EmptyState dashboard={dashboard} />}
          </div>
        </div>

        <CoverageBars dashboard={dashboard} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DownsDeathsChart engagements={dashboard.engagements} fightContexts={fightContexts} />

        <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Action queue</h3>
            <Pill>{dashboard.actions.length} actions</Pill>
          </div>
          <div className="mt-4 grid gap-3">
            {dashboard.actions.length > 0 ? (
              dashboard.actions.map((action, index) => (
                <div key={action.id} className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.04] p-4">
                  <div className="text-xs font-black text-amber-300">#{index + 1}</div>
                  <h3 className="mt-1 text-sm font-black uppercase tracking-wider text-slate-100">{action.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{action.detail}</p>
                </div>
              ))
            ) : (
              <EmptyState dashboard={dashboard} />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Fight timeline</h3>
          <Pill>{chronologicalTimeline.length} linked windows</Pill>
        </div>
        <div className="mt-2 text-xs leading-5 text-slate-500">
          Chronological by fight. Times are relative to the fight they belong to, not the whole uploaded report.
        </div>
        <div className="mt-4 grid gap-3">
          {chronologicalTimeline.map((item) => {
            const insight = segmentById.get(item.id);
            const fightContext = contextForTimelineItem(item, segmentById, fightContexts);
            return (
              <div key={item.id} className="grid gap-3 rounded-2xl border border-white/[0.06] bg-black/25 p-4 md:grid-cols-[150px_1fr_140px] md:items-center">
                <div>
                  <FightContextStrip context={fightContext} compact />
                  <div className="mt-2 font-mono text-xs font-bold text-slate-500">{formatTime(item.timestampMs)} into fight</div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black uppercase tracking-wider text-slate-100">{item.label}</span>
                    <Pill className={SEVERITY_STYLE[item.severity]}>{item.severity}</Pill>
                    {insight && <Pill className={PRESSURE_STYLE[insight.pressureLabel].border}>{PRESSURE_STYLE[insight.pressureLabel].label}</Pill>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                  {insight && <div className="mt-3"><PressureBar percent={insight.pressurePercent} label={insight.pressureLabel} /></div>}
                </div>
                <div className="flex justify-start gap-2 md:justify-end">
                  <Pill>{item.downs} downs</Pill>
                  <Pill>{item.deaths} deaths</Pill>
                </div>
              </div>
            );
          })}
          {chronologicalTimeline.length === 0 && <EmptyState dashboard={dashboard} />}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Findings</h3>
            <Pill>{dashboard.findings.length} findings</Pill>
          </div>
          <div className="mt-4 grid gap-3">
            {dashboard.findings.length > 0 ? dashboard.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} fightContext={fightContextFor(fightContexts, finding.relatedFight)} />
            )) : <EmptyState dashboard={dashboard} />}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Critical event feed</h3>
            <Pill>{dashboard.criticalEvents.length} events</Pill>
          </div>
          <div className="mt-4 grid max-h-[720px] gap-2 overflow-y-auto pr-1 custom-scrollbar">
            {dashboard.criticalEvents.slice(0, 16).map((event) => (
              <CriticalEventCard key={event.id} event={event} fightContext={fightContextFor(fightContexts, event.fightId)} />
            ))}
            {dashboard.criticalEvents.length === 0 && <EmptyState dashboard={dashboard} />}
          </div>
        </div>
      </section>
    </div>
  );
}
