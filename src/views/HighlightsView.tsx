import { useEffect, useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";
import Panel from "../components/ui/Panel";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { fmtNum, fmtPct } from "../utils/format";
import type { FightHighlight } from "../types/report";
import { Activity, BrainCircuit, Clock, Crown, Sparkles, Swords, Skull, Users, ShieldCheck } from "lucide-react";

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
  longest: "text-theme-accent-strong border-theme-accent/20 bg-theme-accent/[0.05]",
  outnumbered: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  flawless: "text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.04]",
  "mvp-moment": "text-theme-accent-strong border-theme-accent/30 bg-theme-accent/10",
};

const LABELS: Record<string, string> = {
  blowout: "Blowout",
  toughest: "Toughest fight",
  longest: "Longest fight",
  outnumbered: "Outnumbered & won",
  flawless: "Flawless victory",
  "mvp-moment": "MVP moment",
};

function fightClock(timestamp: number) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
}

function highlightValue(highlight: FightHighlight) {
  if (typeof highlight.value !== "number") return null;
  return highlight.valueFormat === "percent" ? fmtPct(highlight.value, 1) : fmtNum(highlight.value);
}

function highlightValueLabel(highlight: FightHighlight) {
  if (highlight.valueLabel) return highlight.valueLabel;
  return highlight.valueFormat === "percent" ? "percent" : "down contribution";
}

function highlightDescription(highlight: FightHighlight) {
  if (highlight.id === "mvp-moment" && typeof highlight.value === "number") {
    return `${highlight.account ?? "The selected player"} recorded ${fmtNum(highlight.value)} down contribution in ${highlight.fightName}.`;
  }
  return highlight.description;
}

interface HighlightsViewProps {
  fightIndices?: number[];
  commanderLabel?: string;
}

export default function HighlightsView({ fightIndices, commanderLabel }: HighlightsViewProps = {}) {
  const { report } = useReport();
  const { setActiveView } = useView();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filterKey = fightIndices?.join(",") ?? "all";
  const highlights = useMemo(() => {
    const all = report?.stats.fightHighlights ?? [];
    if (!fightIndices) return all;
    const allowed = new Set(fightIndices);
    return all.filter((highlight) => allowed.has(highlight.fightIndex));
  }, [fightIndices, report]);

  useEffect(() => setSelectedIndex(0), [filterKey]);
  if (!report) return null;

  const selectedPosition = Math.min(selectedIndex, Math.max(0, highlights.length - 1));
  const selected = highlights[selectedPosition];

  function openSelected(view: "squad-stats" | "intelligence") {
    if (!selected) return;
    const fight = report!.stats.fightBreakdown[selected.fightIndex];
    localStorage.setItem("entropy.selectedFightIndex", String(selected.fightIndex));
    if (fight?.id) localStorage.setItem("entropy.selectedFightId", fight.id);
    setActiveView(view);
  }

  if (highlights.length === 0) {
    return (
      <Panel
        title="Highlights"
        icon={<Sparkles className="h-3.5 w-3.5" />}
        empty={
          <div className="py-10 text-center text-sm text-theme-muted">
            {commanderLabel ? `No recorded highlights matched fights led by ${commanderLabel}.` : "No recorded highlights were available for this report."}
          </div>
        }
      >
        {null}
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.82fr)_minmax(25rem,1.18fr)]">
      <section className="border border-theme-border bg-black/25">
        <div className="flex items-center justify-between border-b border-theme-border px-4 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-accentStrong">Recorded moments</div>
            <div className="mt-1 text-[10px] text-theme-muted">{highlights.length} highlight{highlights.length === 1 ? "" : "s"}</div>
          </div>
          <Sparkles className="h-4 w-4 text-theme-accentStrong" />
        </div>
        <div className="divide-y divide-theme-border">
          {highlights.map((highlight, index) => {
            const Icon = ICONS[highlight.id] ?? Sparkles;
            const accent = ACCENTS[highlight.id] ?? ACCENTS.longest;
            const clock = fightClock(highlight.timestamp);
            const value = highlightValue(highlight);
            return (
              <button
                key={`${highlight.id}:${highlight.fightIndex}:${index}`}
                type="button"
                aria-pressed={index === selectedPosition}
                data-intelligence-selected={index === selectedPosition ? "true" : undefined}
                onClick={() => setSelectedIndex(index)}
                className={`grid min-h-24 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors ${index === selectedPosition ? "bg-theme-accentDim shadow-[inset_2px_0_0_var(--theme-accent)]" : "hover:bg-white/[0.025]"}`}
              >
                <span className={`grid h-9 w-9 place-items-center border ${accent}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className={`text-[9px] font-black uppercase ${accent.split(" ")[0]}`}>{LABELS[highlight.id] ?? "Highlight"}</span>
                  <span className="mt-1 block truncate text-xs font-black uppercase text-theme-text">{highlight.title}</span>
                  <span className="mt-1 block truncate font-mono text-[10px] text-theme-muted">
                    Fight {highlight.fightIndex + 1}{clock ? ` · ${clock}` : ""}
                  </span>
                </span>
                {value && <span className="text-right font-mono text-sm font-black text-theme-accentStrong">{value}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <aside className="theme-comparison-slab self-start border border-theme-focus bg-theme-surface/90 p-5 shadow-[inset_2px_0_0_var(--theme-accent)] xl:sticky xl:top-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-accentStrong">Selected highlight</div>
            <div className={`border px-2 py-0.5 text-[9px] font-black uppercase ${ACCENTS[selected.id] ?? ACCENTS.longest}`}>{LABELS[selected.id] ?? "Highlight"}</div>
          </div>
          <h3 className="mt-3 text-xl font-black uppercase text-theme-text">{selected.title}</h3>
          <div className="mt-1 font-mono text-xs text-theme-muted">
            Fight {selected.fightIndex + 1} · {selected.fightName}
            {fightClock(selected.timestamp) ? ` · ${fightClock(selected.timestamp)}` : ""}
          </div>

          {selected.account && (
            <div className="mt-4 flex items-center gap-2 border-y border-theme-border py-3">
              {selected.profession && <ProfessionIcon profession={selected.profession} className="h-6 w-6" />}
              <span className="min-w-0 truncate text-sm font-bold text-theme-text">{selected.account}</span>
              {selected.profession && <span className="text-[9px] font-bold uppercase text-theme-muted">{selected.profession}</span>}
            </div>
          )}

          {highlightValue(selected) && (
            <div className="mt-4 border-l-2 border-theme-focus pl-3">
              <div className="font-mono text-3xl font-black text-theme-accentStrong">{highlightValue(selected)}</div>
              <div className="mt-1 text-[10px] font-bold uppercase text-theme-muted">{highlightValueLabel(selected)}</div>
            </div>
          )}

          <p className="mt-5 text-sm leading-6 text-theme-text/80">{highlightDescription(selected)}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => openSelected("squad-stats")} className="theme-command-button inline-flex min-h-10 items-center justify-center gap-2 border border-theme-accent/30 bg-theme-accent/10 px-4 py-2 text-xs font-black uppercase text-theme-accent-strong"><Activity className="h-4 w-4" /> Fight metrics</button>
            <button type="button" onClick={() => openSelected("intelligence")} className="theme-command-button inline-flex min-h-10 items-center justify-center gap-2 border border-theme-border bg-theme-surface-inset px-4 py-2 text-xs font-black uppercase text-theme-text hover:border-theme-accent/30 hover:text-theme-accent-strong"><BrainCircuit className="h-4 w-4" /> Evidence board</button>
          </div>
        </aside>
      )}
    </div>
  );
}
