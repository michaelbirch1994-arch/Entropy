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
} from "lucide-react";
import type { ReactNode } from "react";
import { VIEW_SECTIONS, VIEW_TONES, type ViewRegistryItem, type ViewTone } from "../../lib/viewRegistry";
import EntropyLogo from "../ui/EntropyLogo";

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const SECTION_ICONS: Record<string, ReactNode> = {
  OVERVIEW: <Activity className="w-4 h-4" />,
  "SQUAD & ROSTER": <Users className="w-4 h-4" />,
  PERFORMANCE: <Swords className="w-4 h-4" />,
  "COMBAT LOG": <Film className="w-4 h-4" />,
  INTELLIGENCE: <Sparkles className="w-4 h-4" />,
  ARCHIVE: <Archive className="w-4 h-4" />,
  TOOLS: <FlaskConical className="w-4 h-4" />,
};

function findSectionForView(viewId: string): string | null {
  for (const section of VIEW_SECTIONS) {
    if (section.items.some((i) => i.id === viewId)) return section.title;
  }
  return null;
}

export default function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(() => findSectionForView(activeView) ?? "OVERVIEW");
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(() => window.innerWidth <= 720);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const section = findSectionForView(activeView);
    if (section && section !== expanded) setExpanded(section);
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

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 720) setCompact(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = (title: string) => setExpanded(expanded === title ? null : title);
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return VIEW_SECTIONS.flatMap((section) =>
      section.items
        .filter((item) => [item.label, item.id, ...(item.keywords ?? [])].join(" ").toLowerCase().includes(needle))
        .map((item) => ({ ...item, section: section.title })),
    ).slice(0, 8);
  }, [query]);

  const selectView = (view: string) => {
    setActiveView(view);
    setQuery("");
  };

  const renderItemButton = (item: ViewRegistryItem, options?: { compactList?: boolean; section?: string }) => {
    const isActive = activeView === item.id;
    const icon = VIEW_ICONS[item.id] ?? <Activity className="w-4 h-4" />;
    const tone = VIEW_TONES[item.id] ?? "overview";
    return (
      <button
        key={item.id}
        onClick={() => selectView(item.id)}
        aria-current={isActive ? "page" : undefined}
        aria-label={compact ? item.label : undefined}
        data-tone={tone}
        title={compact ? item.label : undefined}
        className={`theme-nav-item group w-full text-left rounded-lg text-xs font-medium transition-all duration-200 relative ${
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
          {!compact && <div className="theme-brand-copy">
            <h1 className="entropy-wordmark text-sm font-black tracking-widest text-theme-text uppercase font-display">Entropy</h1>
            <p className="text-[10px] text-theme-accent/70 font-bold uppercase tracking-widest">WvW Analytics</p>
          </div>}
        </div>
        <button
          type="button"
          onClick={() => setCompact(!compact)}
          aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
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
          <div className="theme-search-shell sticky top-[93px] z-10 mb-3 rounded-xl border border-theme-border/40 bg-theme-surface/85 px-3 py-2 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 text-theme-muted">
              <Search className="h-3.5 w-3.5" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Quick switch navigation"
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

        {VIEW_SECTIONS.map((section) => {
          const isOpen = expanded === section.title;
          const hasCurrent = section.items.some((i) => i.id === activeView);
          const isFlat = section.flat || section.items.length <= 2;
          const sectionIcon = SECTION_ICONS[section.title] ?? <Activity className="w-4 h-4" />;
          return (
            <div key={section.title} className={compact ? "mt-1" : ""} data-tone={section.tone}>
              {isFlat ? (
                <div className={compact ? "space-y-1" : "space-y-0.5"}>
                  {!compact && (
                    <div className={`mt-3 flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${hasCurrent ? "text-theme-accent" : "text-theme-muted/75"}`}>
                      <span className={hasCurrent ? "text-theme-accent" : "text-theme-muted/75"}>{sectionIcon}</span>
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
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${section.title} navigation section`}
                data-tone={section.tone}
                className={`theme-nav-section w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                  isOpen || hasCurrent
                    ? "bg-theme-accent/5 text-theme-accent border border-theme-accent/15"
                    : "text-theme-muted hover:bg-theme-surface-elevated/50 hover:text-theme-text border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isOpen || hasCurrent ? "text-theme-accent" : "text-theme-muted"}>{sectionIcon}</span>
                  {!compact && section.title}
                </div>
                {!compact && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? "rotate-180 text-theme-accent" : "text-theme-muted"}`}
                  />
                )}
              </button>

              <div
                className={`overflow-hidden transition-opacity duration-150 ease-out ${
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
  "player-compare": <GitCompare className="w-4 h-4" />,
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
  "party-boons": <Users className="w-4 h-4" />,
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
