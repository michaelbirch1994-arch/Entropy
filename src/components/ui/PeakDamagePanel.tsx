import { useMemo } from "react";
import { Zap } from "lucide-react";
import type { DpsGraphData } from "../../types/report";
import { useDamageScope } from "../../store/DamageScopeContext";
import { buildPeakDamageLeaderboard } from "../../lib/analysis/peakDamageLeaderboard";
import Panel from "./Panel";
import ProfessionIcon from "./ProfessionIcon";
import { fmtCompact, fmtNum, profStyle } from "../../utils/format";

const displayDamage = (damage: number) => damage >= 100000 ? fmtCompact(damage) : fmtNum(damage);

function clock(ms: number) {
  const seconds = ms / 1000;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function PeakDamagePanel({ data, totalFights }: { data?: DpsGraphData; totalFights: number }) {
  const { scope, setScope } = useDamageScope();
  const records = useMemo(() => buildPeakDamageLeaderboard(data), [data]);

  return (
    <>
    {scope === "all" && records.length > 0 ? (
      <>
      <div className="theme-podium-grid grid grid-cols-1 gap-4 md:grid-cols-3">
        {records.slice(0, 3).map(record => (
          <div key={record.account} className={`theme-podium-card neon-offense is-rank-${record.rank} flex items-center gap-4 rounded-2xl p-4`}>
            <div className="theme-podium-rank font-mono text-3xl font-black">#{record.rank}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-theme-text" title={record.account}>{record.account}</div>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-theme-muted">
                <ProfessionIcon profession={record.profession} className="h-5 w-5" />{record.profession}
              </div>
              <div className="theme-podium-value mt-1 font-mono text-lg font-black" title={record.damage.toLocaleString()}>{displayDamage(record.damage)}</div>
            </div>
          </div>
        ))}
      </div>
      <Panel title="Peak 1s Damage - Top 9" icon={<Zap className="h-4 w-4" />}
        subtitle="Personal high scores across recorded fights. All-target damage."
        accent="text-amber-400">
        <div className="theme-player-card-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {records.slice(0, 9).map(record => {
            const profession = profStyle(record.profession);
            return (
              <article key={record.account} aria-label={`${record.account} peak damage high score`}
                className="theme-player-card neon-offense min-w-0 rounded-2xl p-4 text-left">
                <div className="theme-player-card-head flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-visible">
                      <ProfessionIcon profession={record.profession} className="h-9 w-9" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-theme-text" title={record.account}>{record.account}</h3>
                      <div className="mt-0.5 font-mono text-[10px] text-theme-muted">{record.profession}</div>
                    </div>
                  </div>
                  <span className={`shrink-0 font-mono text-xs font-black ${record.rank <= 3 ? "text-theme-accent-strong" : "text-theme-muted"}`}>#{record.rank}</span>
                </div>
                <div className="theme-player-card-body mt-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-theme-muted">Peak 1s damage</div>
                      <div className="mt-1 font-mono text-2xl font-black text-theme-text" title={record.damage.toLocaleString()}>{displayDamage(record.damage)}</div>
                    </div>
                    <div className="text-right font-mono text-[10px] text-theme-muted">{record.fights}/{totalFights} fights</div>
                  </div>
                  <div className="theme-progress-track mt-3 h-2 overflow-hidden rounded-full" aria-hidden="true">
                    <div className={`theme-progress-fill h-full rounded-full ${profession.dot}`} style={{ width: `${records[0].damage > 0 ? record.damage / records[0].damage * 100 : 0}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase text-theme-muted">Share of current leader</div>
                  <div className="mt-4 border-t border-theme-border pt-3 text-xs text-theme-muted">
                    <div className="font-mono text-theme-accent-strong">{clock(record.startMs)} - {clock(record.endMs)}</div>
                    <div className="mt-2 break-words">{record.fight}</div>
                    <div className="mt-2 font-mono">{record.fights}/{totalFights} recorded fights</div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
      </>
    ) : null}
    <Panel title="Peak 1s Damage" icon={<Zap className="h-4 w-4" />}
      subtitle="Highest damage in one complete recorded second. All targets; one best fight per player."
      accent="text-amber-400">
      {scope !== "all" ? (
        <div className="space-y-3 text-sm text-theme-muted">
          <p>Player-target burst data is not available in this report.</p>
          <button type="button" onClick={() => setScope("all")} className="theme-filter-button px-3 py-2">
            Switch damage scope to All targets
          </button>
        </div>
      ) : records.length === 0 ? (
        <p role="status" className="py-6 text-sm text-theme-muted">No complete one-second damage series available.</p>
      ) : (
        <>
          <div className="theme-table-shell overflow-x-auto" role="region" aria-label="Peak one-second damage leaderboard" tabIndex={0}>
            <table className="w-full text-left text-sm">
              <thead><tr>
                {['Rank', 'Player', 'Peak damage', 'Fight', 'Window', 'Recorded fights'].map(label =>
                  <th scope="col" key={label} className="whitespace-nowrap px-3 py-2 text-xs text-theme-muted">{label}</th>)}
              </tr></thead>
              <tbody>{records.map(record => (
                <tr key={record.account} className="border-t border-theme-border">
                  <td className="px-3 py-3 font-mono text-theme-accent-strong">#{record.rank}</td>
                  <th scope="row" className="px-3 py-3 font-normal">
                    <div className="flex items-center gap-2">
                      <ProfessionIcon profession={record.profession} className="h-5 w-5 shrink-0" />
                      <div><div className="break-all font-bold">{record.account}</div><div className="text-xs text-theme-muted">{record.profession}</div></div>
                    </div>
                  </th>
                  <td className="px-3 py-3 font-mono font-bold">{record.damage.toLocaleString()}</td>
                  <td className="min-w-32 px-3 py-3">{record.fight}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono">{clock(record.startMs)} - {clock(record.endMs)}</td>
                  <td className="px-3 py-3 font-mono">{record.fights}/{totalFights}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-theme-muted">Based on saved damage samples, aligned to the log clock; not a sliding window or fight-average DPS. Missing or invalid series are excluded.</p>
        </>
      )}
    </Panel>
    </>
  );
}
