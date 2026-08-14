import { useMemo, useState, type ReactNode } from "react";
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
  type IntelligenceAction,
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

const ALL_FIGHTS_ID = "all";
const FIGHT_SELECTOR_PREVIEW_COUNT = 11;
const FINDINGS_PREVIEW_COUNT = 6;
const CRITICAL_EVENTS_PREVIEW_COUNT = 16;

type ExpandableSection = "findings" | "criticalEvents";
type SeverityFilter = "all" | FindingSeverity;
type PressureFilter = "all" | IntelligenceEngagementInsight["pressureLabel"];
type CriticalEventKindFilter = "all" | string;

const SEVERITY_FILTERS: Array<{ id: SeverityFilter; label: string }> = [
  { id: "all", label: "All findings" },
  { id: "critical", label: "Critical" },
  { id: "significant", label: "Significant" },
  { id: "notable", label: "Notable" },
  { id: "info", label: "Info" },
];

const PRESSURE_FILTERS: Array<{ id: PressureFilter; label: string }> = [
  { id: "all", label: "All pressure" },
  { id: "critical", label: "Critical" },
  { id: "danger", label: "Danger" },
  { id: "watch", label: "Watch" },
  { id: "quiet", label: "Quiet" },
];

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

function uniqueFightContexts(map: Map<string, FightContext>): FightContext[] {
  return Array.from(new Map(Array.from(map.values()).map((context) => [context.id, context])).values())
    .filter((context) => context.id !== UNKNOWN_FIGHT.id)
    .sort((a, b) => a.index - b.index || a.label.localeCompare(b.label));
}

function isInSelectedFight(fightContexts: Map<string, FightContext>, fightId: string | undefined, selectedFightId: string): boolean {
  if (selectedFightId === ALL_FIGHTS_ID) return true;
  return fightContextFor(fightContexts, fightId).id === selectedFightId;
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

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
        active
          ? "border-sky-300/40 bg-sky-400/[0.12] text-sky-200 shadow-[0_0_22px_-14px_rgba(56,189,248,0.9)]"
          : "border-white/[0.08] bg-white/[0.03] text-slate-500 hover:border-white/15 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
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

function FightSelector({
  fights,
  selectedFightId,
  onSelect,
  totals,
}: {
  fights: FightContext[];
  selectedFightId: string;
  onSelect: (fightId: string) => void;
  totals: { downs: number; deaths: number; findings: number; criticalEvents: number };
}) {
  const [showAllFights, setShowAllFights] = useState(false);
  const visibleFights = showAllFights ? fights : fights.slice(0, FIGHT_SELECTOR_PREVIEW_COUNT);
  const hiddenFightCount = Math.max(0, fights.length - visibleFights.length);

  return (
    <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Fight breakdown</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Click a fight to scope the analytics below. Long sessions load the first fights now; expand the rest only when needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill>{fights.length || "unknown"} fights detected</Pill>
          {fights.length > FIGHT_SELECTOR_PREVIEW_COUNT && <Pill>{visibleFights.length} loaded</Pill>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelect(ALL_FIGHTS_ID)}
          className={`rounded-2xl border p-4 text-left transition ${selectedFightId === ALL_FIGHTS_ID ? "border-amber-300/40 bg-amber-400/[0.08] shadow-[0_0_35px_-18px_rgba(251,191,36,0.75)]" : "border-white/[0.06] bg-black/25 hover:border-white/15 hover:bg-white/[0.04]"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="border-amber-400/20 bg-amber-500/[0.08] text-amber-200">All fights</Pill>
            <Pill>{formatNumber(totals.findings)} findings</Pill>
          </div>
          <div className="mt-3 text-xs leading-5 text-slate-400">Full night overview with every fight and report window included.</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2">
              <div className="text-base font-black text-amber-200">{formatNumber(totals.downs)}</div>
              <div className="text-[10px] font-bold uppercase text-slate-500">downs</div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2">
              <div className="text-base font-black text-rose-200">{formatNumber(totals.deaths)}</div>
              <div className="text-[10px] font-bold uppercase text-slate-500">deaths</div>
            </div>
          </div>
        </button>

        {visibleFights.map((fight) => (
          <button
            key={fight.id}
            type="button"
            onClick={() => onSelect(fight.id)}
            className={`rounded-2xl border p-4 text-left transition ${selectedFightId === fight.id ? "border-sky-300/40 bg-sky-400/[0.08] shadow-[0_0_35px_-18px_rgba(56,189,248,0.75)]" : "border-white/[0.06] bg-black/25 hover:border-white/15 hover:bg-white/[0.04]"}`}
          >
            <FightContextStrip context={fight} compact />
            <div className="mt-3 truncate text-xs font-bold text-slate-300">{fight.name}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2">
                <div className="text-base font-black text-amber-200">{formatNumber(fight.downs)}</div>
                <div className="text-[10px] font-bold uppercase text-slate-500">downs</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2">
                <div className="text-base font-black text-rose-200">{formatNumber(fight.deaths)}</div>
                <div className="text-[10px] font-bold uppercase text-slate-500">deaths</div>
              </div>
            </div>
          </button>
        ))}

        {hiddenFightCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAllFights(true)}
            className="rounded-2xl border border-sky-400/20 bg-sky-500/[0.05] p-4 text-left text-xs font-bold uppercase tracking-wider text-sky-300 transition hover:bg-sky-500/[0.1]"
          >
            Show {hiddenFightCount} more fights
            <div className="mt-2 text-[11px] normal-case leading-5 tracking-normal text-slate-500">Loads the remaining fight cards on demand.</div>
          </button>
        )}

        {showAllFights && fights.length > FIGHT_SELECTOR_PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => setShowAllFights(false)}
            className="rounded-2xl border border-white/[0.06] bg-black/25 p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:border-white/15 hover:text-slate-200"
          >
            Collapse fight list
            <div className="mt-2 text-[11px] normal-case leading-5 tracking-normal text-slate-500">Keeps the selected fight active and unloads extra cards.</div>
          </button>
        )}
      </div>
    </section>
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
        {rows.length === 0 && <div className="text-sm text-slate-500">No engagement windows available for this selection.</div>}
      </div>
      <div className="mt-4 flex gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-300" /> Downs</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> Deaths</span>
      </div>
    </div>
  );
}

function EmptyState({ dashboard, scope = "this report" }: { dashboard: IntelligenceDashboard; scope?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-5">
      <div className="flex items-start gap-3">
        <FileWarning className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
        <p className="text-sm leading-6 text-slate-400">
          {dashboard.persisted
            ? `No current finding rule produced a supported conclusion for ${scope}. Entropy stays quiet when the evidence does not support a claim.`
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

function FightNarrativePanel({
  context,
  engagements,
  findings,
  criticalEvents,
  actions,
}: {
  context: FightContext;
  engagements: IntelligenceEngagementInsight[];
  findings: IntelligenceFinding[];
  criticalEvents: CriticalEvent[];
  actions: IntelligenceAction[];
}) {
  const worstWindow = engagements[0];
  const criticalFindings = findings.filter((finding) => finding.severity === "critical" || finding.severity === "significant");
  const eventKinds = Array.from(
    criticalEvents.reduce((counts, event) => {
      counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const keyMoments = engagements.slice(0, 4).sort((a, b) => a.timestampMs - b.timestampMs);
  const evidenceFindings = criticalFindings.length > 0 ? criticalFindings.slice(0, 3) : findings.slice(0, 3);
  const reviewActions = actions.slice(0, 3);
  const totalDowns = engagements.reduce((sum, engagement) => sum + engagement.downs, 0);
  const totalDeaths = engagements.reduce((sum, engagement) => sum + engagement.deaths, 0);

  const resultText = context.result === "win"
    ? "The squad won this fight, so treat this as polish: find the pressure windows that still cost downs and tighten them."
    : context.result === "loss"
      ? "The squad lost this fight, so treat the pressure windows below as the first places to review positioning, stability, recovery, and target focus."
      : "Entropy has fight data here, but no clear win/loss result. Use the pressure windows and events as the reliable review anchors.";

  const whatHappened = worstWindow
    ? `${context.label} peaked at ${worstWindow.pressureScore}/100 pressure around ${formatTime(worstWindow.timestampMs)} with ${formatNumber(worstWindow.downs)} downs, ${formatNumber(worstWindow.deaths)} deaths, and ${formatNumber(worstWindow.criticalEvents)} linked events.`
    : `${context.label} has no detected pressure window, which usually means the available report evidence did not support a specific failure cluster.`;

  const primaryIssue = criticalFindings[0]?.summary
    ?? (eventKinds[0] ? `${eventKinds[0][0]} events were the most common critical signal in this fight.` : "No major finding rose above the current evidence threshold.");

  const improvement = actions[0]?.detail
    ?? (worstWindow
      ? "Review the highest-pressure timestamp first, then compare squad positioning, stability coverage, and recovery cooldown timing around that moment."
      : "If this fight still felt rough in-game, re-check replay positioning and death recaps; the current Intelligence evidence did not produce a stronger deterministic recommendation.");
  const fightShape = totalDowns > 0 || totalDeaths > 0
    ? `${formatNumber(totalDowns)} total downs and ${formatNumber(totalDeaths)} deaths were detected in the scoped pressure windows.`
    : "No down/death cluster was strong enough to become a scoped pressure window.";

  return (
    <section className="rounded-[2rem] border border-amber-400/15 bg-gradient-to-br from-amber-500/[0.08] via-black/30 to-sky-500/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-300">Entropy fight readout</div>
          <h3 className="mt-1 text-xl font-black uppercase tracking-wider text-slate-100">{context.label}: {context.name}</h3>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-300">{resultText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill><Swords className="h-3 w-3" /> {context.squadCount || "?"}v{context.enemyCount || "?"}</Pill>
          <Pill>{formatNumber(findings.length)} findings</Pill>
          <Pill>{formatNumber(criticalEvents.length)} events</Pill>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/25 p-4 text-sm leading-7 text-slate-300">
        <span className="font-black text-slate-100">Fight shape:</span> {fightShape} {eventKinds[0] ? `The most repeated event signal was ${eventKinds[0][0]} (${eventKinds[0][1]}x).` : "No repeated event type dominated the feed."}
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-300">
            <Radar className="h-4 w-4" /> What happened
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{whatHappened}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-300">
            <ShieldAlert className="h-4 w-4" /> Likely issue
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{primaryIssue}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300">
            <ListChecks className="h-4 w-4" /> What to improve
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{improvement}</p>
        </div>
      </div>

      {eventKinds.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {eventKinds.slice(0, 6).map(([kind, count]) => (
            <Pill key={kind} className="border-white/10 bg-white/[0.04] text-slate-300">
              {kind}: {count}
            </Pill>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
            <Radar className="h-4 w-4" /> Key moments
          </div>
          <div className="mt-3 grid gap-2">
            {keyMoments.length > 0 ? keyMoments.map((moment) => (
              <div key={moment.id} className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-black text-slate-200">{formatTime(moment.timestampMs)}</span>
                  <Pill className={PRESSURE_STYLE[moment.pressureLabel].border}>{PRESSURE_STYLE[moment.pressureLabel].label}</Pill>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {moment.label}: {formatNumber(moment.downs)} downs, {formatNumber(moment.deaths)} deaths, {formatNumber(moment.criticalEvents)} events.
                </p>
              </div>
            )) : (
              <p className="text-xs leading-5 text-slate-500">No pressure timestamp was strong enough to call out for this fight.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-300">
            <ShieldAlert className="h-4 w-4" /> Evidence to check
          </div>
          <div className="mt-3 grid gap-2">
            {evidenceFindings.length > 0 ? evidenceFindings.map((finding) => (
              <div key={finding.id} className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill className={SEVERITY_STYLE[finding.severity]}>{finding.severity}</Pill>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">{finding.title}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{finding.summary}</p>
              </div>
            )) : (
              <p className="text-xs leading-5 text-slate-500">No finding crossed the current evidence threshold for this fight.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300">
            <ListChecks className="h-4 w-4" /> Review checklist
          </div>
          <div className="mt-3 grid gap-2">
            {reviewActions.length > 0 ? reviewActions.map((action, index) => (
              <div key={action.id} className="rounded-xl border border-emerald-400/10 bg-emerald-500/[0.04] p-3">
                <div className="text-xs font-black text-emerald-300">#{index + 1} {action.title}</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{action.detail}</p>
              </div>
            )) : (
              <>
                <p className="text-xs leading-5 text-slate-500">No action was generated from the current finding set.</p>
                {worstWindow && (
                  <p className="rounded-xl border border-white/[0.06] bg-black/25 p-3 text-xs leading-5 text-slate-400">
                    Start manually at {formatTime(worstWindow.timestampMs)} and review stability, stunbreak timing, regroup speed, and whether damage landed before support recovered.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function IntelligenceDebugView() {
  const { report } = useReport();
  const [selectedFightId, setSelectedFightId] = useState(ALL_FIGHTS_ID);
  const [criticalEventKindFilter, setCriticalEventKindFilter] = useState<CriticalEventKindFilter>("all");
  const [expandedSections, setExpandedSections] = useState<Record<ExpandableSection, boolean>>({
    findings: false,
    criticalEvents: false,
  });
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [pressureFilter, setPressureFilter] = useState<PressureFilter>("all");
  const dashboard = useMemo(() => (report ? buildIntelligenceDashboard(report) : null), [report]);

  function toggleSection(section: ExpandableSection) {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function handleSelectFight(fightId: string) {
    setSelectedFightId(fightId);
    setCriticalEventKindFilter("all");
    setSeverityFilter("all");
    setPressureFilter("all");
    setExpandedSections({ findings: false, criticalEvents: false });
  }

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
  const fightContexts = buildFightContextMap(report, dashboard);
  const fightList = uniqueFightContexts(fightContexts);
  const selectedFight = selectedFightId === ALL_FIGHTS_ID ? null : fightList.find((fight) => fight.id === selectedFightId) ?? null;
  const selectedScopeLabel = selectedFight?.label ?? "this report";
  const segmentById = new Map(dashboard.engagements.map((engagement) => [engagement.id, engagement]));
  const chronologicalTimeline = [...dashboard.timeline].sort((a, b) => {
    const af = contextForTimelineItem(a, segmentById, fightContexts);
    const bf = contextForTimelineItem(b, segmentById, fightContexts);
    return af.index - bf.index || a.timestampMs - b.timestampMs;
  });
  const fightScopedEngagements = dashboard.engagements.filter((engagement) => isInSelectedFight(fightContexts, engagement.fightId, selectedFightId));
  const fightScopedFindings = dashboard.findings.filter((finding) => isInSelectedFight(fightContexts, finding.relatedFight, selectedFightId));
  const scopedEngagements = fightScopedEngagements.filter((engagement) => pressureFilter === "all" || engagement.pressureLabel === pressureFilter);
  const scopedFindings = fightScopedFindings.filter((finding) => severityFilter === "all" || finding.severity === severityFilter);
  const scopedCriticalEvents = dashboard.criticalEvents.filter((event) => isInSelectedFight(fightContexts, event.fightId, selectedFightId));
  const criticalEventKindCounts = scopedCriticalEvents.reduce((counts, event) => {
    counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const criticalEventKinds = Array.from(criticalEventKindCounts.keys()).sort((a, b) => a.localeCompare(b));
  const filteredCriticalEvents = criticalEventKindFilter === "all"
    ? scopedCriticalEvents
    : scopedCriticalEvents.filter((event) => event.kind === criticalEventKindFilter);
  const scopedTimeline = chronologicalTimeline.filter((item) => {
    const insight = segmentById.get(item.id);
    if (pressureFilter !== "all" && insight?.pressureLabel !== pressureFilter) return false;
    if (selectedFightId === ALL_FIGHTS_ID) return true;
    return contextForTimelineItem(item, segmentById, fightContexts).id === selectedFightId;
  });
  const scopedFindingIds = new Set(scopedFindings.map((finding) => finding.id));
  const scopedActions = selectedFightId === ALL_FIGHTS_ID
    ? dashboard.actions
    : dashboard.actions.filter((action: IntelligenceAction) => action.basedOn.some((id) => scopedFindingIds.has(id)));
  const topEngagements = scopedEngagements.slice(0, 3);
  const highestPressure = scopedEngagements[0];
  const visibleFindings = expandedSections.findings ? scopedFindings : scopedFindings.slice(0, FINDINGS_PREVIEW_COUNT);
  const visibleCriticalEvents = expandedSections.criticalEvents ? filteredCriticalEvents : filteredCriticalEvents.slice(0, CRITICAL_EVENTS_PREVIEW_COUNT);
  const scopedTotals = {
    downs: scopedEngagements.reduce((sum, engagement) => sum + engagement.downs, 0),
    deaths: scopedEngagements.reduce((sum, engagement) => sum + engagement.deaths, 0),
    findings: scopedFindings.length,
    criticalEvents: scopedCriticalEvents.length,
  };
  const allTotals = {
    downs: dashboard.totals.downs,
    deaths: dashboard.totals.deaths,
    findings: dashboard.totals.findings,
    criticalEvents: dashboard.totals.criticalEvents,
  };
  const engagementScopeText = selectedFight ? `in ${selectedFight.label}` : `across ${fightList.length || "unknown"} fights`;
  const filtersActive = severityFilter !== "all" || pressureFilter !== "all" || criticalEventKindFilter !== "all";

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
            {selectedFight && <Pill className="border-sky-400/20 bg-sky-500/[0.08] text-sky-200">Viewing {selectedFight.label}</Pill>}
          </div>
        </div>
      </section>

      <FightSelector fights={fightList} selectedFightId={selectedFightId} onSelect={handleSelectFight} totals={allTotals} />

      {selectedFight && (
        <section className="rounded-[2rem] border border-sky-400/15 bg-sky-500/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-300">Selected fight analytics</div>
              <h3 className="mt-1 text-xl font-black uppercase tracking-wider text-slate-100">{selectedFight.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The cards below are filtered to this fight only, so pressure windows, findings, and events no longer mix with other uploads.
              </p>
            </div>
            <FightContextStrip context={selectedFight} compact />
          </div>
        </section>
      )}

      <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Focus controls</div>
            <h3 className="mt-1 text-lg font-black uppercase tracking-wider text-slate-100">Filter the viewer</h3>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              Narrow Intelligence to the signal you care about without changing the selected fight. This keeps findings, pressure windows, timeline rows, and action queue from jumbling together.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>{scopedEngagements.length}/{fightScopedEngagements.length} pressure windows</Pill>
            <Pill>{scopedFindings.length}/{fightScopedFindings.length} findings</Pill>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter("all");
                  setPressureFilter("all");
                  setCriticalEventKindFilter("all");
                }}
                className="rounded-full border border-amber-400/20 bg-amber-500/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/[0.14]"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Finding severity</div>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_FILTERS.map((filter) => (
                <FilterButton key={filter.id} active={severityFilter === filter.id} onClick={() => setSeverityFilter(filter.id)}>
                  {filter.label}
                </FilterButton>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Pressure level</div>
            <div className="flex flex-wrap gap-2">
              {PRESSURE_FILTERS.map((filter) => (
                <FilterButton key={filter.id} active={pressureFilter === filter.id} onClick={() => setPressureFilter(filter.id)}>
                  {filter.label}
                </FilterButton>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedFight && (
        <FightNarrativePanel
          context={selectedFight}
          engagements={scopedEngagements}
          findings={scopedFindings}
          criticalEvents={scopedCriticalEvents}
          actions={scopedActions}
        />
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Gauge className="h-5 w-5" />} label="Highest pressure" value={highestPressure ? `${highestPressure.pressureScore}/100` : "0/100"} detail={highestPressure ? `${fightContextFor(fightContexts, highestPressure.fightId).label} · ${highestPressure.label}` : "No engagement windows available for this selection."} />
        <StatCard icon={<Flame className="h-5 w-5" />} label="Review first" value={highestPressure ? `#${highestPressure.priority}` : "None"} detail={highestPressure?.reviewPrompt ?? "No scoped review target available."} />
        <StatCard icon={<BrainCircuit className="h-5 w-5" />} label="Findings" value={formatNumber(scopedTotals.findings)} detail={selectedFight ? "Evidence-backed conclusions for the selected fight." : "Evidence-backed conclusions tied to specific fights."} />
        <StatCard icon={<Database className="h-5 w-5" />} label="Downs / deaths" value={`${formatNumber(scopedTotals.downs)} / ${formatNumber(scopedTotals.deaths)}`} detail={selectedFight ? "From Intelligence windows in the selected fight." : "From Intelligence windows, grouped by fight."} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Priority engagements</h3>
            <Pill>{scopedEngagements.length} windows {engagementScopeText}</Pill>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {topEngagements.length > 0 ? topEngagements.map((insight) => (
              <EngagementCard key={insight.id} insight={insight} fightContext={fightContextFor(fightContexts, insight.fightId)} />
            )) : <EmptyState dashboard={dashboard} scope={selectedScopeLabel} />}
          </div>
        </div>

        <CoverageBars dashboard={dashboard} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DownsDeathsChart engagements={scopedEngagements} fightContexts={fightContexts} />

        <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Action queue</h3>
            <Pill>{scopedActions.length} actions</Pill>
          </div>
          <div className="mt-4 grid gap-3">
            {scopedActions.length > 0 ? (
              scopedActions.map((action, index) => (
                <div key={action.id} className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.04] p-4">
                  <div className="text-xs font-black text-amber-300">#{index + 1}</div>
                  <h3 className="mt-1 text-sm font-black uppercase tracking-wider text-slate-100">{action.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{action.detail}</p>
                </div>
              ))
            ) : (
              <EmptyState dashboard={dashboard} scope={selectedScopeLabel} />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Fight timeline</h3>
          <Pill>{scopedTimeline.length} linked windows</Pill>
        </div>
        <div className="mt-2 text-xs leading-5 text-slate-500">
          {selectedFight
            ? `Showing only windows tied to ${selectedFight.label}. Times remain relative to that fight.`
            : "Chronological by fight. Times are relative to the fight they belong to, not the whole uploaded report."}
        </div>
        <div className="mt-4 grid gap-3">
          {scopedTimeline.map((item) => {
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
          {scopedTimeline.length === 0 && <EmptyState dashboard={dashboard} scope={selectedScopeLabel} />}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Findings</h3>
            <Pill>{visibleFindings.length}/{scopedFindings.length} loaded</Pill>
          </div>
          <div className="mt-4 grid gap-3">
            {scopedFindings.length > 0 ? visibleFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} fightContext={fightContextFor(fightContexts, finding.relatedFight)} />
            )) : <EmptyState dashboard={dashboard} scope={selectedScopeLabel} />}
          </div>
          {scopedFindings.length > FINDINGS_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => toggleSection("findings")}
              className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-sky-400/30 hover:text-sky-300"
            >
              {expandedSections.findings ? "Collapse findings" : `Show all ${scopedFindings.length} findings`}
            </button>
          )}
        </div>

        <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Critical event feed</h3>
            <Pill>{visibleCriticalEvents.length}/{filteredCriticalEvents.length} loaded</Pill>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCriticalEventKindFilter("all");
                setExpandedSections((current) => ({ ...current, criticalEvents: false }));
              }}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                criticalEventKindFilter === "all"
                  ? "border-rose-300/40 bg-rose-400/[0.1] text-rose-200"
                  : "border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300"
              }`}
            >
              all {scopedCriticalEvents.length}
            </button>
            {criticalEventKinds.slice(0, 8).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setCriticalEventKindFilter(kind);
                  setExpandedSections((current) => ({ ...current, criticalEvents: false }));
                }}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                  criticalEventKindFilter === kind
                    ? "border-rose-300/40 bg-rose-400/[0.1] text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300"
                }`}
              >
                {kind} {criticalEventKindCounts.get(kind) ?? 0}
              </button>
            ))}
          </div>
          <div className="mt-4 grid max-h-[720px] gap-2 overflow-y-auto pr-1 custom-scrollbar">
            {visibleCriticalEvents.map((event) => (
              <CriticalEventCard key={event.id} event={event} fightContext={fightContextFor(fightContexts, event.fightId)} />
            ))}
            {filteredCriticalEvents.length === 0 && <EmptyState dashboard={dashboard} scope={selectedScopeLabel} />}
          </div>
          {filteredCriticalEvents.length > CRITICAL_EVENTS_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => toggleSection("criticalEvents")}
              className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-sky-400/30 hover:text-sky-300"
            >
              {expandedSections.criticalEvents ? "Collapse event feed" : `Show all ${filteredCriticalEvents.length} events`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
