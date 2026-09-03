import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";
import Panel from "../components/ui/Panel";
import BoundedDataRegion from "../components/ui/BoundedDataRegion";
import { BrainCircuit, Crosshair, Film } from "lucide-react";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function severityRank(sev: string): number {
  const m = /Sev(\d)/.exec(sev);
  return m ? Number(m[1]) : 0;
}

const SEVERITY_STYLE: Record<number, { label: string; dot: string; text: string; border: string }> = {
  0: { label: "Info", dot: "bg-slate-500", text: "text-slate-400", border: "border-slate-700/60" },
  1: { label: "Minor", dot: "bg-slate-400", text: "text-slate-300", border: "border-slate-600/50" },
  2: { label: "Moderate", dot: "bg-amber-500", text: "text-amber-400", border: "border-amber-500/20" },
  3: { label: "Major", dot: "bg-orange-500", text: "text-orange-400", border: "border-orange-500/20" },
  4: { label: "Critical", dot: "bg-rose-500", text: "text-rose-400", border: "border-rose-500/20" },
};

export default function MechanicsView() {
  const { report } = useReport();
  const { navigateToView } = useView();
  const data = report?.stats.mechanics;
  const [fightIdx, setFightIdx] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const replayFightIds = useMemo(
    () => new Set((report?.stats.replayFights ?? []).map((entry) => entry.fightId)),
    [report],
  );

  const fight = data?.fights[fightIdx];
  const mechanics = fight?.mechanics ?? [];

  const expandedActualKey = useMemo(() => {
    if (expandedKey && mechanics.some((m) => m.key === expandedKey)) return expandedKey;
    return null;
  }, [mechanics, expandedKey]);

  if (!report) return null;

  if (!data || data.fights.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Mechanics Timeline"
          icon={<Crosshair className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No mechanic event data available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports whose fights tracked
                boss/encounter mechanics (interrupts, CC, boss-specific events, and similar).
              </p>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  const totalEvents = mechanics.reduce((n, m) => n + m.events.length, 0);
  const reportFightIndex = fight
    ? report.stats.fightBreakdown.findIndex((entry) => entry.id === fight.fightId)
    : -1;

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-wrap items-center gap-3">
        {data.fights.length > 1 && (
          <select
            aria-label="Select mechanics fight"
            value={fightIdx}
            onChange={(e) => {
              setFightIdx(Number(e.target.value));
              setExpandedKey(null);
            }}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:border-theme-focus focus:outline-none"
          >
            {data.fights.map((f, i) => (
              <option key={f.fightId} value={i}>
                  #{i + 1} · {f.fightName} ({fmtClock(f.durationMs)})
              </option>
            ))}
          </select>
        )}
      </div>

      {fight && (
        <Panel
          title="Mechanics Timeline"
          subtitle={`${mechanics.length} tracked mechanic${mechanics.length === 1 ? "" : "s"} over ${fmtClock(fight.durationMs)} - click one to see when and who`}
          icon={<Crosshair className="w-3.5 h-3.5" />}
          action={`${totalEvents} events`}
          bodyClassName="p-0"
        >
          <div className="divide-y divide-slate-800/60">
            {mechanics.map((m) => {
              const sev = severityRank(m.def.severity);
              const style = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE[0];
              const isOpen = expandedActualKey === m.key;
              const playerEvents = m.events.filter((e) => e.isPlayer && e.account);
              const perPlayerCount = new Map<string, number>();
              for (const e of playerEvents) {
                perPlayerCount.set(e.account!, (perPlayerCount.get(e.account!) ?? 0) + 1);
              }
              const topPlayers = [...perPlayerCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
              const replayAvailable = replayFightIds.has(fight.fightId);

              return (
                <div key={m.key}>
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isOpen ? null : m.key)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-focus"
                  >
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 truncate">{m.def.fullName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${style.border} ${style.text}`}>
                          {style.label}
                        </span>
                      </div>
                      {m.def.description && (
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-1">
                          {m.def.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">{m.events.length}x</span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] ${replayAvailable ? "border-theme-focus bg-theme-accentDim text-theme-accentStrong" : "border-slate-700/60 bg-slate-900/40 text-slate-500"}`}>
                        <Film className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {replayAvailable
                            ? "Exact-time Replay evidence is available for every timestamped occurrence below."
                            : "Replay coverage is unavailable for this fight; mechanic timestamps remain visible here."}
                        </span>
                      </div>
                      <div className="relative bg-black/30 rounded-xl border border-slate-800 h-10 overflow-hidden mb-2">
                        {m.events.map((e, i) => {
                          const left = (e.time / fight.durationMs) * 100;
                          return (
                            <div
                              key={i}
                              title={`${e.account ?? e.actor} @ ${fmtClock(e.time)}`}
                              className={`absolute top-1.5 bottom-1.5 w-0.5 rounded-sm hover:ring-1 hover:ring-white/60 ${style.dot}`}
                              style={{ left: `${Math.min(Math.max(left, 0), 99.7)}%` }}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-3">
                        <span>0:00</span>
                        <span>{fmtClock(fight.durationMs)}</span>
                      </div>

                      {topPlayers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {topPlayers.map(([account, count]) => (
                            <span
                              key={account}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900/60 border border-slate-800 text-slate-300"
                            >
                              {account} <span className="text-slate-500">x{count}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <BoundedDataRegion
                        label={`${m.def.fullName} occurrence evidence, ${m.events.length} events`}
                        itemCount={m.events.length}
                        maxHeightClass="max-h-56"
                      >
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-theme-border text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 bg-[#0a0e1f]">
                              <th className="text-left font-bold px-3 py-2">Time</th>
                              <th className="text-left font-bold px-3 py-2">Who</th>
                              <th className="text-right font-bold px-3 py-2">Evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.events.map((e, i) => (
                              <tr key={i} className="border-b border-slate-800/30 hover:bg-white/[0.02]">
                                <td className="px-3 py-1.5 font-mono text-slate-500">{fmtClock(e.time)}</td>
                                <td className="px-3 py-1.5 text-slate-300 font-medium">
                                  {e.account ?? e.actor}
                                  {!e.isPlayer && <span className="text-slate-500 ml-1 text-[10px]">(NPC)</span>}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <div className="inline-flex flex-wrap justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => navigateToView("intelligence", {
                                        source: "other",
                                        fightId: fight.fightId,
                                        fightIndex: reportFightIndex >= 0 ? reportFightIndex : undefined,
                                        timestampMs: e.time,
                                        account: e.account,
                                        metric: m.def.fullName,
                                      })}
                                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-theme-focus bg-theme-accentDim px-2 py-1 text-[9px] font-black uppercase tracking-wider text-theme-accentStrong transition-colors hover:bg-theme-accentDim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-focus"
                                      aria-label={`Inspect ${m.def.fullName} for ${e.account ?? e.actor} at ${fmtClock(e.time)} in Intelligence`}
                                    >
                                      <BrainCircuit className="h-3 w-3" /> Intelligence
                                    </button>
                                    {replayAvailable ? (
                                      <button
                                        type="button"
                                        onClick={() => navigateToView("fight-replay", {
                                          source: "other",
                                          fightId: fight.fightId,
                                          fightIndex: reportFightIndex >= 0 ? reportFightIndex : undefined,
                                          timestampMs: e.time,
                                          account: e.account,
                                          metric: m.def.fullName,
                                        })}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-theme-border bg-white/[0.03] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-300 transition-colors hover:border-theme-focus hover:text-theme-accentStrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-focus"
                                        aria-label={`View ${m.def.fullName} for ${e.account ?? e.actor} at ${fmtClock(e.time)} in Fight Replay`}
                                      >
                                        <Film className="h-3 w-3" /> Replay
                                      </button>
                                    ) : (
                                      <span className="self-center text-[9px] uppercase tracking-wider text-slate-600" title="This fight has no persisted Replay position data.">Replay unavailable</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </BoundedDataRegion>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
