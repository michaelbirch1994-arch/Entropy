import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { profChip } from "../utils/format";
import Panel from "../components/ui/Panel";
import { Clock } from "lucide-react";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// Deterministic-ish hue per skill id so casts are visually distinguishable
// without a fixed palette (squad rotations can reference hundreds of skills).
function skillColor(id: number): string {
  const hue = (id * 47) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

export default function RotationsView() {
  const { report } = useReport();
  const data = report?.stats.rotations;
  const [fightIdx, setFightIdx] = useState(0);
  const [playerAccount, setPlayerAccount] = useState<string | null>(null);

  const fight = data?.fights[fightIdx];

  const activeAccount = useMemo(() => {
    if (!fight) return null;
    if (playerAccount && fight.players.some((p) => p.account === playerAccount)) return playerAccount;
    return fight.players[0]?.account ?? null;
  }, [fight, playerAccount]);

  const activePlayer = fight?.players.find((p) => p.account === activeAccount);

  if (!report) return null;

  if (!data || data.fights.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Rotations"
          icon={<Clock className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No skill-cast timeline data available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports.
              </p>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-wrap items-center gap-3">
        {data.fights.length > 1 && (
          <select
            value={fightIdx}
            onChange={(e) => { setFightIdx(Number(e.target.value)); setPlayerAccount(null); }}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2"
          >
            {data.fights.map((f, i) => (
              <option key={f.fightId} value={i}>{f.fightName} ({fmtClock(f.durationMs)})</option>
            ))}
          </select>
        )}
        {fight && (
          <select
            value={activeAccount ?? ""}
            onChange={(e) => setPlayerAccount(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 flex-1 min-w-[180px]"
          >
            {fight.players.map((p) => (
              <option key={p.account} value={p.account}>{p.account} ({p.profession})</option>
            ))}
          </select>
        )}
      </div>

      {fight && activePlayer && (
        <Panel
          title="Skill Rotation"
          subtitle={`${activePlayer.account} - ${activePlayer.casts.length} casts over ${fmtClock(fight.durationMs)}`}
          icon={<Clock className="w-3.5 h-3.5" />}
          action={
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(activePlayer.profession)}`}>
              {activePlayer.profession}
            </span>
          }
        >
          <div className="relative bg-black/30 rounded-xl border border-slate-800 h-16 overflow-hidden">
            {activePlayer.casts.map((c, i) => {
              const left = (c.castTime / fight.durationMs) * 100;
              const width = Math.max((Math.max(c.duration, 150) / fight.durationMs) * 100, 0.3);
              const meta = data.skillMeta[c.skillId];
              return (
                <div
                  key={i}
                  title={`${meta?.name ?? `Skill ${c.skillId}`} @ ${fmtClock(c.castTime)}`}
                  className="absolute top-2 bottom-2 rounded-sm hover:ring-1 hover:ring-white/60 transition-all cursor-default"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: skillColor(c.skillId) }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5">
            <span>0:00</span>
            <span>{fmtClock(fight.durationMs)}</span>
          </div>

          <div className="mt-5 max-h-72 overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-amber-500/10 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 bg-[#0a0e1f]">
                  <th className="text-left font-bold px-3 py-2">Time</th>
                  <th className="text-left font-bold px-3 py-2">Skill</th>
                </tr>
              </thead>
              <tbody>
                {activePlayer.casts.map((c, i) => {
                  const meta = data.skillMeta[c.skillId];
                  return (
                    <tr key={i} className="border-b border-slate-800/30 hover:bg-white/[0.02]">
                      <td className="px-3 py-1.5 font-mono text-slate-500">{fmtClock(c.castTime)}</td>
                      <td className="px-3 py-1.5 flex items-center gap-2">
                        {meta?.icon && <img src={meta.icon} alt="" className="w-4 h-4 rounded-sm" loading="lazy" />}
                        <span className="text-slate-300 font-medium">{meta?.name ?? `Skill ${c.skillId}`}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
