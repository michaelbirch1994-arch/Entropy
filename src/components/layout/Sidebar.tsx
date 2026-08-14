import { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
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
  FlaskConical,
  Search,
  Pin,
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
  keywords?: string[];
}
interface NavSection {
  title: string;
  icon: ReactNode;
  items: NavItem[];
  flat?: boolean;
}

const MENU: NavSection[] = [
  {
    title: "OVERVIEW",
    icon: <Activity className="w-4 h-4" />,
    items: [
      { id: "overview", label: "Overview", keywords: ["summary", "night", "landing"] },
      { id: "kdr", label: "KDR", keywords: ["kills", "deaths", "record"] },
      { id: "fight-breakdown", label: "Fight Breakdown", keywords: ["fights", "per fight"] },
      { id: "map-distribution", label: "Map Distribution", keywords: ["map", "borderland", "ebg"] },
      { id: "classes", label: "Classes", keywords: ["profession", "specialization", "comp"] },
      { id: "composition", label: "Composition", keywords: ["parties", "squad comp", "roles"] },
    ],
  },
  {
    title: "SQUAD & ROSTER",
    icon: <Users className="w-4 h-4" />,
    items: [
      { id: "squad-stats", label: "Squad Stats", keywords: ["kill pressure", "healing effectiveness", "tag distance"] },
      { id: "roster", label: "Roster Intel", keywords: ["attendance", "raid roster"] },
      { id: "commander-stats", label: "Commander Stats", keywords: ["tag", "lead"] },
      { id: "player-profiles", label: "Player Profiles", keywords: ["career", "history"] },
    ],
  },
  {
    title: "PERFORMANCE",
    icon: <Swords className="w-4 h-4" />,
    items: [
      { id: "top-players", label: "Top Players", keywords: ["mvp", "damage", "healing", "barrier"] },
      { id: "top-skills", label: "Top Skills", keywords: ["skill damage", "skill healing"] },
      { id: "offensive", label: "Offensive Stats", keywords: ["downs", "kills", "strips"] },
      { id: "defensive", label: "Defensive Stats", keywords: ["mitigation", "blocks", "healing"] },
      { id: "damage-modifiers", label: "Damage Modifiers", keywords: ["modifier", "crit"] },
      { id: "rotations", label: "Rotations", keywords: ["apm", "casts"] },
      { id: "buffs", label: "Buffs", keywords: ["uptime", "boons", "conditions", "stability"] },
      { id: "buff-generation", label: "Buff Generation", keywords: ["boon generation", "cleanse", "stability", "quickness"] },
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
    title: "EXTRAS",
    icon: <Star className="w-4 h-4" />,
    items: [
      { id: "intelligence", label: "Intelligence", keywords: ["ml", "predictive", "findings"] },
      { id: "archive", label: "Report Archive", keywords: ["history", "saved"] },
      { id: "compare", label: "Compare Reports", keywords: ["diff", "reports"] },
      { id: "axiforge-lab", label: "Entropy Builder", keywords: ["builder", "build editor", "tools"] },
    ],
  },
];

function findSectionForView(viewId: string): string | null {
  for (const section of MENU) {
    if (section.items.some((i) => i.id === viewId)) return section.title;
  }
  return null;
}

const RECENT_STORAGE_KEY = "entropy.sidebar.recentViews";
const PINNED_ITEMS: NavItem[] = [
  { id: "squad-stats", label: "Squad Stats" },
  { id: "fight-replay", label: "Fight Replay" },
];

function findItem(viewId: string): NavItem | undefined {
  return MENU.flatMap((section) => section.items).find((item) => item.id === viewId);
}

export default function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(() => findSectionForView(activeView) ?? "OVERVIEW");
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [recent, setRecent] = useState<NavItem[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]") as string[];
      return parsed.map(findItem).filter((item): item is NavItem => Boolean(item)).slice(0, 4);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const section = findSectionForView(activeView);
    if (section && section !== expanded) setExpanded(section);
    const item = findItem(activeView);
    if (!item) return;
    setRecent((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== item.id && !PINNED_ITEMS.some((p) => p.id === entry.id))].slice(0, 4);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next.map((entry) => entry.id)));
      return next;
    });
  }, [activeView]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCompact(false);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape") setQuery("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggle = (title: string) => setExpanded(expanded === title ? null : title);
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return MENU.flatMap((section) =>
      section.items
        .filter((item) => [item.label, item.id, ...(item.keywords ?? [])].join(" ").toLowerCase().includes(needle))
        .map((item) => ({ ...item, section: section.title })),
    ).slice(0, 8);
  }, [query]);

  const selectView = (view: string) => {
    setActiveView(view);
    setQuery("");
  };

  const renderItemButton = (item: NavItem, options?: { compactList?: boolean; section?: string }) => {
    const isActive = activeView === item.id;
    const icon = VIEW_ICONS[item.id] ?? <Activity className="w-4 h-4" />;
    return (
      <button
        key={item.id}
        onClick={() => selectView(item.id)}
        aria-current={isActive ? "page" : undefined}
        title={compact ? item.label : undefined}
        className={`group w-full text-left rounded-lg text-xs font-medium transition-all duration-200 relative ${
          compact
            ? `flex h-9 items-center justify-center ${isActive ? "bg-theme-accent/15 text-theme-accent" : "text-theme-muted hover:bg-theme-surface-elevated/60 hover:text-theme-text"}`
            : `px-3 py-2 ${isActive
                ? "bg-theme-accent/10 text-theme-accent shadow-[inset_2px_0_0_0_var(--theme-accent)] font-semibold"
                : "text-theme-muted hover:text-theme-text hover:bg-theme-surface-elevated/60"
              }`
        }`}
      >
        {compact ? (
          icon
        ) : (
          <span className="flex items-center justify-between gap-2">
            <span>{item.label}</span>
            {options?.section && <span className="text-[9px] uppercase tracking-wider text-theme-muted/70">{options.section}</span>}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className={`${compact ? "w-20" : "w-64"} theme-sidebar flex-shrink-0 h-full flex flex-col z-40 overflow-y-auto custom-scrollbar transition-[width] duration-300`}>
      {/* Brand */}
      <div className="theme-sidebar-header p-4 sticky top-0 z-10">
        <div className={`flex items-center ${compact ? "justify-center" : "gap-3"}`}>
          <div className="theme-logo-tile w-9 h-9 rounded-lg flex items-center justify-center">
            <EntropyLogo size={20} />
          </div>
          {!compact && <div>
            <h1 className="entropy-wordmark text-sm font-black tracking-widest text-theme-text uppercase font-display">Entropy</h1>
            <p className="text-[10px] text-theme-accent/70 font-bold uppercase tracking-widest">WvW Analytics</p>
          </div>}
        </div>
        <button
          type="button"
          onClick={() => setCompact(!compact)}
          className="theme-quiet-button mt-3 flex w-full items-center justify-center gap-2 px-2 py-1.5"
          title={compact ? "Expand sidebar" : "Collapse sidebar"}
        >
          {compact ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          {!compact && "Compact"}
        </button>
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-0.5 flex-1" role="navigation" aria-label="Main navigation">
        {!compact && (
          <div className="sticky top-[93px] z-10 mb-3 rounded-xl border border-theme-border/40 bg-theme-surface/85 px-3 py-2 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 text-theme-muted">
              <Search className="h-3.5 w-3.5" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Quick switch..."
                className="w-full bg-transparent text-xs text-theme-text placeholder:text-theme-muted/70 outline-none"
              />
              <kbd className="rounded border border-theme-border/50 px-1.5 py-0.5 text-[9px] text-theme-muted">Ctrl K</kbd>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-theme-border/40 pt-2">
                {searchResults.map((item) => renderItemButton(item, { section: item.section }))}
              </div>
            )}
          </div>
        )}

        <div className="mb-2">
          {!compact && (
            <div className="mb-1 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-theme-muted/75">
              <Pin className="h-3 w-3" />
              Pinned / Recent
            </div>
          )}
          <div className={compact ? "space-y-1" : "space-y-0.5"}>
            {[...PINNED_ITEMS, ...recent.filter((item) => !PINNED_ITEMS.some((p) => p.id === item.id))].slice(0, compact ? 6 : 5).map((item) => renderItemButton(item))}
          </div>
        </div>

        {MENU.map((section) => {
          const isOpen = expanded === section.title;
          const hasCurrent = section.items.some((i) => i.id === activeView);
          const isFlat = section.flat || section.items.length <= 2;
          return (
            <div key={section.title} className={compact ? "mt-1" : ""}>
              {isFlat ? (
                <div className={compact ? "space-y-1" : "space-y-0.5"}>
                  {!compact && (
                    <div className={`mt-3 flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${hasCurrent ? "text-theme-accent" : "text-theme-muted/75"}`}>
                      <span className={hasCurrent ? "text-theme-accent" : "text-theme-muted/75"}>{section.icon}</span>
                      {section.title}
                    </div>
                  )}
                  {section.items.map((item) => renderItemButton(item))}
                </div>
              ) : (
              <>
              <button
                onClick={() => toggle(section.title)}
                aria-expanded={isOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                  isOpen || hasCurrent
                    ? "bg-theme-accent/5 text-theme-accent border border-theme-accent/15"
                    : "text-theme-muted hover:bg-theme-surface-elevated/50 hover:text-theme-text border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isOpen || hasCurrent ? "text-theme-accent" : "text-theme-muted"}>{section.icon}</span>
                  {!compact && section.title}
                </div>
                {!compact && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-180 text-theme-accent" : "text-theme-muted"}`}
                  />
                )}
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isOpen ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"
                }`}
              >
                <ul className="pl-9 pr-2 py-1 space-y-0.5 relative before:content-[''] before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-theme-border/60">
                  {section.items.map((item) => {
                    return (
                      <li key={item.id}>
                        {renderItemButton(item)}
                      </li>
                    );
                  })}
                </ul>
              </div>
              </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-theme-border/50 text-[10px] text-theme-muted font-mono text-center">
        {compact ? "E" : "Entropy"}
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
  "axiforge-lab": <FlaskConical className="w-4 h-4" />,
};
