import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar, { VIEW_ICONS } from "./components/layout/Sidebar";
import { ReportProvider, useReport } from "./store/ReportContext";
import OverviewView from "./views/OverviewView";
import KdrView from "./views/KdrView";
import FightBreakdownView from "./views/FightBreakdownView";
import TopPlayersView from "./views/TopPlayersView";
import TopSkillsView from "./views/TopSkillsView";
import BuffsView from "./views/BuffsView";
import ClassesView from "./views/ClassesView";
import MapDistributionView from "./views/MapDistributionView";
import CommanderStatsView from "./views/CommanderStatsView";
import SquadStatsView from "./views/SquadStatsView";
import CompositionView from "./views/CompositionView";
import OffensiveView from "./views/OffensiveView";
import DefensiveView from "./views/DefensiveView";
import RosterView from "./views/RosterView";
import PlayerProfilesView from "./views/PlayerProfilesView";
import DamageModifiersView from "./views/DamageModifiersView";
import RotationsView from "./views/RotationsView";
import DpsGraphView from "./views/DpsGraphView";
import ReplayView from "./views/ReplayView";
import { Activity, CircleAlert as AlertCircle, FileQuestionMark as FileQuestion, Link2, Upload, X } from "lucide-react";
import UploadCard from "./components/ui/UploadCard";
import EntropyLogo from "./components/ui/EntropyLogo";
import RawLogImporter from "./components/ui/RawLogImporter";
import EntropyWordmarkReveal from "./components/ui/EntropyWordmarkReveal";

const VIEW_TITLES: Record<string, string> = {
  overview: "Overview",
  kdr: "KDR",
  "fight-breakdown": "Fight Breakdown",
  "top-players": "Top Players",
  "top-skills": "Top Skills",
  buffs: "Buffs",
  classes: "Classes",
  "map-distribution": "Map Distribution",
  "commander-stats": "Commander Stats",
  "squad-stats": "Squad Stats",
  composition: "Composition",
  offensive: "Offensive Stats",
  defensive: "Defensive Stats",
  roster: "Roster Intel",
  "player-profiles": "Player Profiles",
  "damage-modifiers": "Damage Modifiers",
  rotations: "Rotations",
  "dps-graph": "DPS Graph",
  "fight-replay": "Fight Replay",
};

function ReportRouter({ activeView }: { activeView: string }) {
  switch (activeView) {
    case "overview": return <OverviewView />;
    case "kdr": return <KdrView />;
    case "fight-breakdown": return <FightBreakdownView />;
    case "top-players": return <TopPlayersView />;
    case "top-skills": return <TopSkillsView />;
    case "buffs": return <BuffsView />;
    case "classes": return <ClassesView />;
    case "map-distribution": return <MapDistributionView />;
    case "commander-stats": return <CommanderStatsView />;
    case "squad-stats": return <SquadStatsView />;
    case "composition": return <CompositionView />;
    case "offensive": return <OffensiveView />;
    case "defensive": return <DefensiveView />;
    case "roster": return <RosterView />;
    case "player-profiles": return <PlayerProfilesView />;
    case "damage-modifiers": return <DamageModifiersView />;
    case "rotations": return <RotationsView />;
    case "dps-graph": return <DpsGraphView />;
    case "fight-replay": return <ReplayView />;
    default: return <OverviewView />;
  }
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
      <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
      <div className="text-sm font-semibold tracking-wide text-amber-300/80">Loading report...</div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-rose-400" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-100">Failed to load report</h2>
        <p className="text-sm text-slate-400 mt-1 font-mono">{message}</p>
      </div>
    </div>
  );
}

function NoReportState() {
  const { uploadReport, loadFromUrl, error, loading } = useReport();
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-16">
      <div className="w-full max-w-lg flex flex-col items-center gap-8 rounded-[2rem] border border-white/[0.06] bg-black/45 backdrop-blur-xl shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)] px-8 py-10">
        {/* Branding */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-700/20 flex items-center justify-center text-amber-400 shadow-[0_0_30px_-6px_rgba(245,158,11,0.5)] border border-amber-400/30">
            <EntropyLogo size={34} />
          </div>
          <div className="text-center">
            <EntropyWordmarkReveal className="entropy-wordmark text-4xl font-black tracking-[0.15em] text-white uppercase font-display drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]" />
            <p className="text-sm text-slate-300 mt-2 font-medium drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">WvW Raid Analytics Platform</p>
          </div>
        </div>

        {/* Import card */}
        <UploadCard onFile={uploadReport} onUrl={loadFromUrl} error={error} loading={loading} />

        {/* Raw log importer (dps.report / .zevtc) */}
        <RawLogImporter />

        {/* Supported formats info */}
        <div className="flex items-center gap-6 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5"><FileQuestion className="w-3 h-3" /> report.json</span>
          <span className="flex items-center gap-1.5"><Link2 className="w-3 h-3" /> DPS.report URLs</span>
          <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> ?report= links</span>
        </div>
      </div>
    </div>
  );
}

function ReportShell() {
  const { report, loading, error, source, clearReport } = useReport();
  const [activeView, setActiveView] = useState("overview");

  const headerInfo = useMemo(() => {
    if (!report) return null;
    return {
      title: report.meta.title,
      dateLabel: report.meta.dateLabel,
      version: report.meta.appVersion,
    };
  }, [report]);

  const viewTitle = VIEW_TITLES[activeView] ?? "Overview";
  const viewIcon = VIEW_ICONS[activeView] ?? <Activity className="w-4 h-4" />;

  // When no report loaded yet (and not in the middle of initial load), show Import Center
  const showImport = !report && !loading && !error;
  const showLoading = loading && !report;
  const showError = !loading && !report && !!error;

  return (
    <div className="flex h-screen w-full text-slate-100 overflow-hidden">
      <div className="entropy-bg">
        <div className="entropy-nebula entropy-nebula-1" />
        <div className="entropy-nebula entropy-nebula-2" />
        <div className="entropy-nebula entropy-nebula-3" />
        <div className="entropy-nebula entropy-nebula-4" />
      </div>

      {/* Only show sidebar when a report is loaded */}
      {report && <Sidebar activeView={activeView} setActiveView={setActiveView} />}

      <main className="flex-1 overflow-y-auto h-full scroll-smooth custom-scrollbar">
        {/* Header - only when report is active */}
        {report && (
          <header className="border-b border-amber-500/10 bg-black/30 backdrop-blur-xl sticky top-0 z-30 px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-amber-500">{viewIcon}</span>
                <div>
                  <h1 className="text-lg font-black tracking-wider text-slate-100 uppercase font-display">{viewTitle}</h1>
                  <p className="text-xs text-amber-400/80 font-medium tracking-wide">
                    {headerInfo?.title} - {headerInfo?.dateLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {source && (
                  <span
                    className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border ${
                      source === "upload"
                        ? "text-amber-400 border-amber-500/30 bg-amber-500/5"
                        : "text-sky-400 border-sky-500/30 bg-sky-500/5"
                    }`}
                  >
                    {source === "upload" ? <Upload className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                    {source === "upload" ? "Uploaded" : "Shared link"}
                  </span>
                )}
                <button
                  onClick={clearReport}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-rose-500/30 bg-black/30 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
                {headerInfo && (
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-500 bg-black/30 px-4 py-2 rounded-xl border border-white/[0.06]">
                    <span>v{headerInfo.version}</span>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Content */}
        <div className={report ? "p-6" : "flex items-center justify-center min-h-full"}>
          {showLoading ? (
            <LoadingState />
          ) : showError ? (
            <ErrorState message={error!} />
          ) : showImport ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <NoReportState />
            </motion.div>
          ) : report ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <ReportRouter activeView={activeView} />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ReportProvider>
      <ReportShell />
    </ReportProvider>
  );
}
