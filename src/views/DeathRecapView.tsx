import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { fmtCompact, profChip } from "../utils/format";
import type { DeathRecapEntry, DeathRecapHit } from "../types/report";
import { Skull, ArrowDown, Swords } from "lucide-react";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function HitRow({ hit, deathTime }: { hit: DeathRecapHit; deathTime: number }) {
  // Times in the recap are absolute fight-clock ms; show them relative to the
  // death itself (negative = seconds before dying) since that's what actually
  // answers "what happened right before I died".
  const relSec = ((hit.time - deathTime) / 1000).toFixed(1);
  return (
    <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
      {hit.icon ? (
        <img src={hit.icon} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded border border-slate-700/50 flex-shrink-0" loading="lazy" />
      ) : (
        <div className="w-6 h-6 rounded bg-slate-800/60 border border-slate-700/50 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-200 truncate">{hit.name}</span>
          {hit.isIndirect && (
            <span className="px-1 py-0 rounded text-[9px] font-bold border border-fuchsia-500/30 text-fuchsia-400">
              condi/proc
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 truncate">from {hit.src}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs font-bold text-rose-400 font-mono">{fmtCompact(hit.damage)}</div>
        <div className="text-[10px] text-slate-500 font-mono">{relSec}s</div>
      </div>
    </div>
  );
}

function DeathCard({ entry }: { entry: DeathRecapEntry }) {
  const [open, setOpen] = useState(false);
  const totalToKill = entry.toKill.reduce((a, h) => a + h.damage, 0);
  const totalToDown = entry.toDown.reduce((a, h) => a + h.damage, 0);
  const killingBlow = entry.toKill[entry.toKill.length - 1] ?? entry.toDown[entry.toDown.length - 1];

  return (
    <div className="bg-[#0a101f]/90 border border-slate-800/80 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
          <Skull className="w-4 h-4 text-rose-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-100">{entry.account}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(entry.profession)}`}>
              {entry.profession}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {entry.fightName} &middot; died at {fmtClock(entry.deathTimeMs)}
            {killingBlow && <> &middot; killed by <span className="text-slate-400">{killingBlow.name}</span></>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-bold text-rose-400 font-mono">{fmtCompact(totalToKill + totalToDown)}</div>
          <div className="text-[10px] text-slate-500">total damage</div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {entry.toDown.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 px-2">
                <ArrowDown className="w-3 h-3" /> To Downstate ({fmtCompact(totalToDown)})
              </div>
              <div className="divide-y divide-slate-800/40">
                {entry.toDown.map((h, i) => (
                  <HitRow key={i} hit={h} deathTime={entry.deathTimeMs} />
                ))}
              </div>
            </div>
          )}
          {entry.toKill.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1 px-2">
                <Swords className="w-3 h-3" /> To Deadstate ({fmtCompact(totalToKill)})
              </div>
              <div className="divide-y divide-slate-800/40">
                {entry.toKill.map((h, i) => (
                  <HitRow key={i} hit={h} deathTime={entry.deathTimeMs} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DeathRecapView() {
  const { report } = useReport();
  const recaps = report?.stats.deathRecaps ?? [];
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const accounts = useMemo(() => {
    const set = new Set(recaps.map((r) => r.account));
    return Array.from(set).sort();
  }, [recaps]);

  const filtered = accountFilter === "all" ? recaps : recaps.filter((r) => r.account === accountFilter);

  if (!report) return null;

  if (recaps.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Death Recap"
          icon={<Skull className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No deaths recorded, or death-recap data isn&apos;t available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports - it shows the exact hits
                that put each squad member into downstate and, if it happened, the hits that finished them off.
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
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2"
        >
          <option value="all">All players ({recaps.length} deaths)</option>
          {accounts.map((a) => (
            <option key={a} value={a}>
              {a} ({recaps.filter((r) => r.account === a).length})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((entry, i) => (
          <DeathCard key={`${entry.account}-${entry.fightIndex}-${entry.deathTimeMs}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}
