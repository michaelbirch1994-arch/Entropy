import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { profChip } from "../utils/format";
import type { FightHighlight } from "../types/report";
import { Sparkles, Swords, Skull, Clock, Users, ShieldCheck, Crown } from "lucide-react";

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

function HighlightCard({ h }: { h: FightHighlight }) {
  const Icon = ICONS[h.id] ?? Sparkles;
  const accent = ACCENTS[h.id] ?? "text-amber-400 border-amber-500/20 bg-amber-500/5";

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${accent} bg-[#0a0e1f]/40 backdrop-blur-md`}>
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
    </div>
  );
}

export default function HighlightsView() {
  const { report } = useReport();
  if (!report) return null;

  const highlights = report.stats.fightHighlights ?? [];

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {highlights.map((h) => (
          <HighlightCard key={h.id} h={h} />
        ))}
      </div>
    </div>
  );
}
