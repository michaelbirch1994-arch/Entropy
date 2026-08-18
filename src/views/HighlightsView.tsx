import { useState } from "react";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";
import Panel from "../components/ui/Panel";
import { profChip } from "../utils/format";
import type { FightHighlight } from "../types/report";
import { Activity, BrainCircuit, Sparkles, Swords, Skull, Clock, Users, ShieldCheck, Crown } from "lucide-react";

const ICONS: Record<string, typeof Swords> = {
  blowout: Swords,
  toughest: Skull,
  longest: Clock,
  outnumbered: Users,
  flawless: ShieldCheck,
  "mvp-moment": Crown,
};

const ACCENTS: Record<string, string> = {
  blowout: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  toughest: "text-rose-400 border-rose-500/20 bg-rose-500/5",
  longest: "text-sky-400 border-sky-500/20 bg-sky-500/5",
  outnumbered: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  flawless: "text-violet-400 border-violet-500/20 bg-violet-500/5",
  "mvp-moment": "text-amber-300 border-amber-400/30 bg-amber-500/10",
};

function HighlightCard({ h, selected, onSelect }: { h: FightHighlight; selected: boolean; onSelect: () => void }) {
  const Icon = ICONS[h.id] ?? Sparkles;
  const accent = ACCENTS[h.id] ?? "text-amber-400 border-amber-500/20 bg-amber-500/5";

  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={`theme-player-card min-h-48 border p-5 flex flex-col gap-3 text-left ${accent} ${selected ? "ring-1 ring-orange-300/40" : ""}`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">{h.title}</div>
          <div className="text-[10px] text-slate-500 font-mono">{h.fightName}</div>
        </div>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{h.description}</p>
      {h.account && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-200">{h.account}</span>
          {h.profession && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(h.profession)}`}>
              {h.profession}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export default function HighlightsView() {
  const { report } = useReport();
  const { setActiveView } = useView();
  const [selectedIndex, setSelectedIndex] = useState(0);
  if (!report) return null;

  const highlights = report.stats.fightHighlights ?? [];
  const selected = highlights[Math.min(selectedIndex, Math.max(0, highlights.length - 1))];
  const openSelected = (view: "squad-stats" | "intelligence") => {
    if (!selected) return;
    const fight = report.stats.fightBreakdown[selected.fightIndex];
    localStorage.setItem("entropy.selectedFightIndex", String(selected.fightIndex));
    if (fight?.id) localStorage.setItem("entropy.selectedFightId", fight.id);
    setActiveView(view);
  };

  if (highlights.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Highlights"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No standout moments detected for this report.
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
      <div className="text-[11px] text-slate-500 px-1">
        Auto-picked from the night's fights - biggest wins, closest calls, and standout individual performances.
      </div>
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {highlights.map((h, index) => (
            <HighlightCard key={`${h.id}:${h.fightIndex}:${index}`} h={h} selected={index === selectedIndex} onSelect={() => setSelectedIndex(index)} />
          ))}
        </div>
        {selected && (
          <aside className="theme-comparison-slab self-start border border-orange-400/20 bg-black/40 p-5 xl:sticky xl:top-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-300">Review reel</div>
            <h3 className="mt-2 text-xl font-black uppercase text-slate-100">{selected.title}</h3>
            <div className="mt-1 font-mono text-xs text-slate-500">Fight {selected.fightIndex + 1} · {selected.fightName}</div>
            <p className="mt-5 border-l-2 border-orange-400/30 pl-3 text-sm leading-6 text-slate-300">{selected.description}</p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={() => openSelected("squad-stats")} className="theme-command-button inline-flex items-center gap-2 border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-xs font-black uppercase text-orange-200"><Activity className="h-4 w-4" /> Inspect fight metrics</button>
              <button type="button" onClick={() => openSelected("intelligence")} className="theme-command-button inline-flex items-center gap-2 border border-cyan-400/25 bg-cyan-500/[0.08] px-4 py-2 text-xs font-black uppercase text-cyan-200"><BrainCircuit className="h-4 w-4" /> Open evidence board</button>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
