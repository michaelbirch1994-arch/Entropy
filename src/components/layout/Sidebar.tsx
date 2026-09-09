import { useState, useEffect, useId, useRef, type ReactNode } from "react";
import {
  ChevronDown, PanelLeftClose, PanelLeftOpen, Activity, Target, Users, Shield, Zap,
  Swords, Trophy, Layers, Map as MapIcon, Sparkles, Percent, Clock,
  LineChart as LineChartIcon, Film, Crosshair, Skull, Star, Archive, GitCompare,
  FlaskConical, Search, Settings2, Flame,
} from "lucide-react";
import { VIEW_SECTIONS, type ViewRegistryItem } from "../../lib/viewRegistry";
import { useWorkspacePreferences } from "../../theme/WorkspacePreferences";
import EntropyLogo from "../ui/EntropyLogo";
import SelectionIndicator from "../ui/SelectionIndicator";

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  hasReport?: boolean;
  onSearch: () => void;
  onSettings: () => void;
}

const SECTION_ICONS: Record<string, ReactNode> = {
  OVERVIEW: <Activity size={18} />,
  "SQUAD & ROSTER": <Users size={18} />,
  PERFORMANCE: <Swords size={18} />,
  "COMBAT LOG": <Film size={18} />,
  INTELLIGENCE: <Sparkles size={18} />,
  ARCHIVE: <Archive size={18} />,
  TOOLS: <FlaskConical size={18} />,
};

export default function Sidebar({ activeView, setActiveView, hasReport = true, onSearch, onSettings }: SidebarProps) {
  const { preferences, updatePreference } = useWorkspacePreferences();
  const selectionId = useId();
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1000);
  const [mobileOpen, setMobileOpen] = useState(false);
  const previousView = useRef<string | null>(null);
  const activeSection = VIEW_SECTIONS.find((section) => section.items.some((item) => item.id === activeView))?.title;
  const [expanded, setExpanded] = useState<string | undefined>(activeSection);
  const compact = narrow ? !mobileOpen : preferences.sidebar === "compact";
  const visibleSections = VIEW_SECTIONS.map((section) => ({
    ...section, items: section.items.filter((item) => hasReport || item.requiresReport === false),
  })).filter((section) => section.items.length);

  useEffect(() => { setExpanded(activeSection); }, [activeSection]);
  useEffect(() => {
    if (activeView === "axiforge-lab" && previousView.current !== activeView) {
      updatePreference("sidebar", "compact");
    }
    previousView.current = activeView;
  }, [activeView, updatePreference]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 999px)");
    const resize = () => { setNarrow(media.matches); setMobileOpen(false); };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);

  function toggleCompact() {
    if (narrow) setMobileOpen((value) => !value);
    else updatePreference("sidebar", compact ? "expanded" : "compact");
  }

  function navigate(view: string) {
    setActiveView(view);
    setMobileOpen(false);
  }

  function renderItem(item: ViewRegistryItem, indicatorVisible = true) {
    return <button type="button" key={item.id} onClick={() => navigate(item.id)}
      className="entropy-nav-link" aria-current={activeView === item.id ? "page" : undefined}
      aria-label={item.label} title={compact ? item.label : undefined}>
      {activeView === item.id && indicatorVisible && <SelectionIndicator id={selectionId} variant="navigation" />}
      <span className="entropy-nav-icon">{VIEW_ICONS[item.id]}</span>
      {!compact && <span className="entropy-nav-label">{item.label}</span>}
      {!compact && activeView === item.id && <span className="entropy-nav-active-mark" aria-hidden="true" />}
    </button>;
  }

  return <>
    {narrow && mobileOpen && <button className="entropy-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className="entropy-sidebar" data-compact={compact} data-mobile-open={narrow && mobileOpen}>
      <header className="entropy-sidebar-brand">
        <div className="entropy-brand-mark"><EntropyLogo size={34} /></div>
        {!compact && <div className="entropy-brand-copy"><strong>Entropy</strong><span>Combat intelligence</span></div>}
      </header>
      <div className="entropy-sidebar-tools">
        <button type="button" className="entropy-nav-search" onClick={onSearch} title="Search workspace" aria-label="Search workspace">
          <Search size={17} />{!compact && <span>Search workspace</span>}
        </button>
      </div>
      <nav className="entropy-navigation custom-scrollbar" aria-label="Main navigation">
        {visibleSections.map((section, index) => {
          const open = expanded === section.title;
          const current = section.title === activeSection;
          const flat = section.flat || section.items.length <= 2;
          return <div className="entropy-nav-group" data-tone={section.tone} data-current={current} key={section.title}>
            {flat ? <>
              {!compact && <div className="entropy-nav-heading">{section.title}</div>}
              {section.items.map((item) => renderItem(item))}
            </> : <>
              <button type="button" className="entropy-nav-section" data-current={current}
                aria-label={compact ? section.title : undefined}
                aria-expanded={!compact && open} aria-controls={`nav-section-${index}`}
                title={compact ? section.title : undefined}
                onClick={() => {
                  if (compact) {
                    if (narrow) setMobileOpen(true);
                    else updatePreference("sidebar", "expanded");
                    setExpanded(section.title);
                  } else setExpanded(open ? undefined : section.title);
                }}>
                {current && (compact || !open) && <SelectionIndicator id={selectionId} variant="navigation" />}
                <span className="entropy-nav-section-icon">{SECTION_ICONS[section.title]}</span>
                {!compact && <><span className="entropy-nav-section-label">{section.title}</span><ChevronDown size={14} className={`entropy-nav-chevron ${open ? "is-open" : ""}`} /></>}
              </button>
              <div id={`nav-section-${index}`} data-open={!compact && open} aria-hidden={compact || !open} inert={compact || !open} className="entropy-nav-children">
                <div className="entropy-nav-children-content">
                  {section.items.map((item) => renderItem(item, !compact && open))}
                </div>
              </div>
            </>}
          </div>;
        })}
      </nav>
      <footer className="entropy-sidebar-footer">
        <button type="button" className="entropy-nav-link" onClick={onSettings} title="Workspace appearance" aria-label="Workspace appearance">
          <Settings2 size={17} />{!compact && <span>Appearance</span>}
        </button>
        <button type="button" className="entropy-nav-link" onClick={toggleCompact} title={compact ? "Expand sidebar" : "Collapse sidebar"} aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}>
          {compact ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}{!compact && <span>Collapse</span>}
        </button>
      </footer>
    </aside>
  </>;
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
  conditions: <Flame className="w-4 h-4" />,
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
