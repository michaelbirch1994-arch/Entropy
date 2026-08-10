import { useMemo } from "react";
import { BrainCircuit, CheckCircle2, Database, FileWarning, Layers3, Search, ShieldAlert } from "lucide-react";
import { useReport } from "../store/ReportContext";
import { createEngagementSegment, type EngagementSegment } from "../lib/intelligence/engagementTypes";
import { synthesizeFindings } from "../lib/intelligence/findingEngine";
import type { CriticalEvent, IntelligenceFinding } from "../lib/intelligence/types";

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "unknown";
  const seconds = Math.round(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildDebugSegments(report: NonNullable<ReturnType<typeof useReport>["report"]>): EngagementSegment[] {
  const fights = report.stats.fightBreakdown ?? [];

  return fights.slice(0, 12).map((fight, index) => {
    const timestamp = asNumber(fight.timestamp) || index * 100000;
    const durationMs = 60000;

    return createEngagementSegment({
      id: `debug-engagement:${fight.id || index}`,
      fightId: String(fight.id || `fight-${index + 1}`),
      index,
      start: {
        timestampMs: timestamp,
        reason: "manual-or-derived",
        evidence: [
          {
            statement: "Debug segment derived from persisted fightBreakdown row, not from raw CombatEvent windows.",
            metrics: {
              fightIndex: index + 1,
              squadCount: fight.squadCount,
              enemyCount: fight.enemyCount,
            },
          },
        ],
      },
      end: {
        timestampMs: timestamp + durationMs,
        reason: "manual-or-derived",
        evidence: [
          {
            statement: "Duration is a debug placeholder because full engagement windows are not persisted in report.stats yet.",
            metrics: { durationMs },
          },
        ],
      },
      durationMs,
      state: fight.alliesDead > 0 ? "wipe" : "active",
      confidence: "low",
      criticalEventIds: [],
      combatEventIds: [],
      participantKeys: [],
      downs: fight.alliesDown,
      deaths: fight.alliesDead,
      evidence: [
        {
          statement: "Fight-level down/death totals are available; CriticalEvent IDs are not persisted yet.",
          metrics: {
            alliesDown: fight.alliesDown,
            alliesDead: fight.alliesDead,
            enemyDowns: fight.enemyDowns,
            enemyDeaths: fight.enemyDeaths,
          },
        },
      ],
      note: fight.fullLabel || fight.label,
    });
  });
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
        ok
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
          : "border-amber-400/20 bg-amber-500/10 text-amber-300"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileWarning className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/35 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-amber-400">{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-black text-slate-100">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function FindingCard({ finding }: { finding: IntelligenceFinding }) {
  return (
    <div className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">{finding.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{finding.summary}</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase text-slate-300">
            {finding.category}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase text-slate-300">
            {finding.confidence}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {finding.evidence.map((evidence, index) => (
          <div key={index} className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
            <div className="text-xs text-slate-300">{evidence.statement}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IntelligenceDebugView() {
  const { report } = useReport();

  const debug = useMemo(() => {
    if (!report) {
      return {
        segments: [] as EngagementSegment[],
        criticalEvents: [] as CriticalEvent[],
        findings: [] as IntelligenceFinding[],
        persisted: false,
      };
    }

    const hasPersistedFields =
      "engagementSegments" in report.stats ||
      "criticalEvents" in report.stats ||
      "intelligenceFindings" in report.stats;

    if (hasPersistedFields) {
      return {
        segments: report.stats.engagementSegments ?? [],
        criticalEvents: report.stats.criticalEvents ?? [],
        findings: report.stats.intelligenceFindings ?? [],
        persisted: true,
      };
    }

    const segments = buildDebugSegments(report);
    const criticalEvents: CriticalEvent[] = [];
    const findings = synthesizeFindings({
      fightId: report.meta.id,
      segments,
      criticalEvents,
    });

    return { segments, criticalEvents, findings, persisted: false };
  }, [report]);

  if (!report) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-500/10 bg-black/40 p-6 text-slate-300">
          Load a report to inspect Entropy Intelligence debug data.
        </div>
      </div>
    );
  }

  const hasReplay = Boolean(report.stats.replayFights?.length);
  const hasMechanics = Boolean(report.stats.mechanics?.fights?.length);
  const hasDeathRecaps = Boolean(report.stats.deathRecaps?.length);
  const hasSurvivalSupport = Boolean(report.stats.survivalSupport?.length);
  const hasFightRows = Boolean(report.stats.fightBreakdown?.length);

  const totalDowns = debug.segments.reduce((sum, segment) => sum + segment.downs, 0);
  const totalDeaths = debug.segments.reduce((sum, segment) => sum + segment.deaths, 0);

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-[2rem] border border-amber-500/10 bg-black/45 p-6 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-300">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-slate-100">
                  Intelligence Debug Panel
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  v2.4 surface for inspecting the new backend chain without redesigning the existing viewer.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill ok={true} label="Finding engine wired" />
            <StatusPill ok={debug.persisted} label={debug.persisted ? "Persisted intelligence" : "Legacy debug fallback"} />
            <StatusPill ok={debug.criticalEvents.length > 0} label={debug.criticalEvents.length > 0 ? "Critical events present" : "No critical events"} />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-sky-400/10 bg-sky-500/[0.04] p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-300" />
            <div>
              <div className="text-sm font-bold text-sky-200">Honesty boundary</div>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                This panel reads persisted v2.5 intelligence data when the loaded report contains it. It does not invent
                missing critical events. Old reports fall back to debug-only fight rows, while new raw-log imports
                can carry CriticalEvents, EngagementSegments, and evidence-backed Findings in report.stats.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Layers3 className="h-5 w-5" />}
          label="Debug segments"
          value={formatNumber(debug.segments.length)}
          detail={debug.persisted ? "Persisted from raw-log intelligence pipeline" : "Derived from fightBreakdown rows for display only"}
        />
        <StatCard
          icon={<Search className="h-5 w-5" />}
          label="Critical events"
          value={formatNumber(debug.criticalEvents.length)}
          detail={debug.persisted ? "Persisted during raw-log report build" : "Will populate after re-importing raw logs"}
        />
        <StatCard
          icon={<BrainCircuit className="h-5 w-5" />}
          label="Findings"
          value={formatNumber(debug.findings.length)}
          detail="Evidence-backed only; no fake coaching"
        />
        <StatCard
          icon={<Database className="h-5 w-5" />}
          label="Downs / deaths"
          value={`${formatNumber(totalDowns)} / ${formatNumber(totalDeaths)}`}
          detail="From available fight-level rows"
        />
      </section>

      <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Raw-data coverage</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatusPill ok={hasReplay} label={hasReplay ? "Replay data" : "No replay data"} />
          <StatusPill ok={hasMechanics} label={hasMechanics ? "Mechanics data" : "No mechanics data"} />
          <StatusPill ok={hasDeathRecaps} label={hasDeathRecaps ? "Death recaps" : "No death recaps"} />
          <StatusPill ok={hasSurvivalSupport} label={hasSurvivalSupport ? "Survival support" : "No survival support"} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Generated findings</h3>
          <span className="text-xs text-slate-500">
            {debug.findings.length > 0 ? `${debug.findings.length} finding(s)` : "No supported findings yet"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {debug.findings.length > 0 ? (
            debug.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-5 text-sm leading-6 text-slate-400">
              No findings are shown because this report has no supported persisted CriticalEvent cluster. That is correct behavior:
              Entropy only shows findings when the backing evidence exists. Re-import raw logs with v2.5 or use a report
              with full replay/down-death data to populate this section.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Debug engagement rows</h3>
          <span className="text-xs text-slate-500">First 12 fights only</span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="min-w-full divide-y divide-white/[0.06] text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Fight</th>
                <th className="px-4 py-3 text-left">State</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-right">Downs</th>
                <th className="px-4 py-3 text-right">Deaths</th>
                <th className="px-4 py-3 text-left">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {debug.segments.map((segment) => (
                <tr key={segment.id} className="text-slate-300">
                  <td className="px-4 py-3 font-mono text-slate-500">{segment.index + 1}</td>
                  <td className="px-4 py-3">{segment.note ?? segment.fightId}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase">
                      {segment.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatDuration(segment.durationMs)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(segment.downs)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(segment.deaths)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs uppercase tracking-wider text-amber-300">{segment.confidence}</span>
                  </td>
                </tr>
              ))}
              {debug.segments.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                    No fight rows available in this report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
