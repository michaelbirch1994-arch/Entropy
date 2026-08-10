import { useState, useEffect } from "react";
import {
  ChevronDown,
  Activity,
  Target,
  Users,
  Shield,
  Zap,
  Swords,
  Trophy,
  Layers,
  Map as MapIcon,
  Sparkles,
  Percent,
  Clock,
  LineChart as LineChartIcon,
  Film,
  Crosshair,
  Skull,
  Star,
Archive,
GitCompare,
} from "lucide-react";
import type { ReactNode } from "react";
import EntropyLogo from "../ui/EntropyLogo";

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

interface NavItem {
  id: string;
  label: string;
}
interface NavSection {
  title: string;
  icon: ReactNode;
  items: NavItem[];
}

const MENU: NavSection[] = [
  {
    title: "OVERVIEW",
    icon: <Activity className="w-4 h-4" />,
    items: [
      { id: "overview", label: "Overview" },
      { id: "kdr", label: "KDR" },
      { id: "fight-breakdown", label: "Fight Breakdown" },
      { id: "classes", label: "Classes" },
      { id: "map-distribution", label: "Map Distribution" },
    ],
  },
  {
    title: "PLAYERS & SKILLS",
    icon: <Swords className="w-4 h-4" />,
    items: [
      { id: "top-players", label: "Top Players" },
      { id: "top-skills", label: "Top Skills" },
      { id: "rotations", label: "Rotations" },
      { id: "damage-modifiers", label: "Damage Modifiers" },
    ],
  },
  {
    title: "BUFFS",
    icon: <Sparkles className="w-4 h-4" />,
    items: [
      { id: "buffs", label: "Buffs" },
      { id: "buff-generation", label: "Buff Generation" },
    ],
  },
  {
    title: "COMBAT LOG",
    icon: <Film className="w-4 h-4" />,
    items: [
      { id: "highlights", label: "Highlights" },
      { id: "dps-graph", label: "DPS Graph" },
      { id: "fight-replay", label: "Fight Replay" },
      { id: "mechanics", label: "Mechanics Timeline" },
      { id: "death-recap", label: "Death Recap" },
    ],
  },
  {
    title: "COMMANDER",
    icon: <Target className="w-4 h-4" />,
    items: [{ id: "commander-stats", label: "Commander Stats" }],
  },
  {
    title: "SQUAD",
    icon: <Users className="w-4 h-4" />,
    items: [
      { id: "squad-stats", label: "Squad Stats" },
      { id: "composition", label: "Composition" },
    ],
  },
  {
    title: "OFFENSIVE",
    icon: <Zap className="w-4 h-4" />,
    items: [{ id: "offensive", label: "Offensive Stats" }],
  },
  {
    title: "DEFENSIVE",
    icon: <Shield className="w-4 h-4" />,
    items: [{ id: "defensive", label: "Defensive Stats" }],
  },
  {
    title: "ROSTER",
    icon: <Users className="w-4 h-4" />,
    items: [{ id: "roster", label: "Roster Intel" }],
  },
  {
    title: "CAREER",
    icon: <Trophy className="w-4 h-4" />,
    items: [{ id: "player-profiles", label: "Player Profiles" }],
  },
  {
    title: "INTELLIGENCE",
    icon: <Sparkles className="w-4 h-4" />,
    items: [{ id: "intelligence", label: "Intelligence Debug" }],
  },
  {
    title: "ARCHIVE",
    icon: <Archive className="w-4 h-4" />,
    items: [
      { id: "archive", label: "Report Archive" },
      { id: "compare", label: "Compare Reports" },
    ],
  },
];

function findSectionForView(viewId: string): string | null {
  for (const section of MENU) {
    if (section.items.some((i) => i.id === viewId)) return section.title;
  }
  return null;
}

export default function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(() => findSectionForView(activeView) ?? "OVERVIEW");

  useEffect(() => {
    const section = findSectionForView(activeView);
    if (section && section !== expanded) setExpanded(section);
  }, [activeView]);

  const toggle = (title: string) => setExpanded(expanded === title ? null : title);

  return (
    <aside className="w-60 flex-shrink-0 border-r border-amber-500/10 bg-black/50 backdrop-blur-xl h-full flex flex-col shadow-[4px_0_40px_rgba(0,0,0,0.5)] z-40 overflow-y-auto custom-scrollbar">
      {/* Brand */}
      <div className="p-5 border-b border-amber-500/10 sticky top-0 bg-black/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-700/20 flex items-center justify-center text-amber-400 shadow-[0_0_16px_-3px_rgba(245,158,11,0.5)] border border-amber-400/30">
            <EntropyLogo size={20} />
          </div>
          <div>
            <h1 className="entropy-wordmark text-sm font-black tracking-widest text-white uppercase font-display">Entropy</h1>
            <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-widest">WvW Analytics</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-0.5 flex-1" role="navigation" aria-label="Main navigation">
        {MENU.map((section) => {
          const isOpen = expanded === section.title;
          const hasCurrent = section.items.some((i) => i.id === activeView);
          return (
            <div key={section.title}>
              <button
                onClick={() => toggle(section.title)}
                aria-expanded={isOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                  isOpen || hasCurrent
                    ? "bg-amber-500/5 text-amber-400 border border-amber-500/10"
                    : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isOpen || hasCurrent ? "text-amber-500" : "text-slate-500"}>{section.icon}</span>
                  {section.title}
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-180 text-amber-500" : "text-slate-500"}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isOpen ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"
                }`}
              >
                <ul className="pl-9 pr-2 py-1 space-y-0.5 relative before:content-[''] before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-amber-500/10">
                  {section.items.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveView(item.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 relative ${
                            isActive
                              ? "bg-amber-500/10 text-amber-300 shadow-[inset_2px_0_0_0_#f59e0b] font-semibold"
                              : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]"
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-amber-500/10 text-[10px] text-slate-500 font-mono text-center">
        Entropy
      </div>
    </aside>
  );
}

export const VIEW_ICONS: Record<string, ReactNode> = {
  overview: <Activity className="w-4 h-4" />,
  kdr: <Swords className="w-4 h-4" />,
  "fight-breakdown": <Swords className="w-4 h-4" />,
  "top-players": <Trophy className="w-4 h-4" />,
  "top-skills": <Zap className="w-4 h-4" />,
  buffs: <Sparkles className="w-4 h-4" />,
  "damage-modifiers": <Percent className="w-4 h-4" />,
  rotations: <Clock className="w-4 h-4" />,
  "dps-graph": <LineChartIcon className="w-4 h-4" />,
  "fight-replay": <Film className="w-4 h-4" />,
  mechanics: <Crosshair className="w-4 h-4" />,
  highlights: <Star className="w-4 h-4" />,
  "death-recap": <Skull className="w-4 h-4" />,
  "buff-generation": <Sparkles className="w-4 h-4" />,
  classes: <Layers className="w-4 h-4" />,
  "map-distribution": <MapIcon className="w-4 h-4" />,
  "commander-stats": <Target className="w-4 h-4" />,
  "squad-stats": <Users className="w-4 h-4" />,
  composition: <Layers className="w-4 h-4" />,
  offensive: <Zap className="w-4 h-4" />,
  defensive: <Shield className="w-4 h-4" />,
  roster: <Users className="w-4 h-4" />,
  "player-profiles": <Trophy className="w-4 h-4" />,
  archive: <Archive className="w-4 h-4" />,
  compare: <GitCompare className="w-4 h-4" />,
  intelligence: <Sparkles className="w-4 h-4" />,
};
