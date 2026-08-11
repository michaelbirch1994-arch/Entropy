import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar, { VIEW_ICONS } from "./components/layout/Sidebar";
import { ReportProvider, useReport } from "./store/ReportContext";
import { ViewProvider, useView } from "./store/ViewContext";
import { CompareProvider } from "./store/CompareContext";
import { DamageScopeProvider, DamageScopeToggle } from "./store/DamageScopeContext";
import { StatsDisplayProvider, StatsDisplayToggle } from "./store/StatsDisplayContext";
import { AllyScopeProvider, AllyScopeToggle } from "./store/AllyScopeContext";
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
import MechanicsView from "./views/MechanicsView";
import DeathRecapView from "./views/DeathRecapView";
import BuffGenerationView from "./views/BuffGenerationView";
import HighlightsView from "./views/HighlightsView";
import ArchiveView from "./views/ArchiveView";
import CompareView from "./views/CompareView";
import IntelligenceDebugView from "./views/IntelligenceDebugView";
import AxiForgeLabView from "./views/AxiForgeLabView";
import { buildReportHtmlExport } from "./lib/exportReportHtml";
import { METRICS_VERSION } from "./lib/buildReportFromFights";
import { Activity, BrainCircuit, CircleAlert as AlertCircle, FileQuestionMark as FileQuestion, FlaskConical, Link2, Upload, X, Download } from "lucide-react";
import UploadCard from "./components/ui/UploadCard";
import EntropyLogo from "./components/ui/EntropyLogo";
import RawLogImporter from "./components/ui/RawLogImporter";
import EntropyWordmarkReveal from "./components/ui/EntropyWordmarkReveal";
import UpdateToast from "./components/ui/UpdateToast";
import { useAutoUpdater } from "./utils/useAutoUpdater";

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
  mechanics: "Mechanics Timeline",
  "death-recap": "Death Recap",
  "buff-generation": "Buff Generation",
  highlights: "Highlights",
  archive: "Report Archive",
  compare: "Compare Reports",
  intelligence: "Intelligence",
  "axiforge-lab": "Entropy Builder",
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
    case "mechanics": return <MechanicsView />;
    case "death-recap": return <DeathRecapView />;
    case "buff-generation": return <BuffGenerationView />;
    case "highlights": return <HighlightsView />;
    case "archive": return <ArchiveView />;
    case "compare": return <CompareView />;
    case "intelligence": return <IntelligenceDebugView />;
    case "axiforge-lab": return <AxiForgeLabView />;
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

function NoReportState({ onOpenAxiForgeLab }: { onOpenAxiForgeLab: () => void }) {
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

        {/* Raw log importer (dps.report / .zevtc) */}
        <RawLogImporter />

        {/* Legacy / prebuilt report import */}
        <UploadCard onFile={uploadReport} onUrl={loadFromUrl} error={error} loading={loading} />

        <button
          type="button"
          onClick={onOpenAxiForgeLab}
          className="flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-wider text-sky-300 transition hover:bg-sky-500/[0.12]"
        >
          <FlaskConical className="h-4 w-4" />
          Open Entropy Builder
        </button>

        {/* Supported formats info */}
        <div className="flex items-center gap-6 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5"><FileQuestion className="w-3 h-3" /> legacy report.json</span>
          <span className="flex items-center gap-1.5"><Link2 className="w-3 h-3" /> DPS.report URLs</span>
          <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> ?report= links</span>
        </div>
      </div>
    </div>
  );
}

function ReportShell() {
  const { report, loading, error, source, clearReport } = useReport();
  // Lets you get back to the import screen to add more logs without
  // throwing away the report you already have - Clear is destructive and
  // was previously the only route back.
  const [atHome, setAtHome] = useState(false);
  const { activeView, setActiveView } = useView();

  const headerInfo = useMemo(() => {
    if (!report) return null;
    return {
      title: report.meta.title,
      dateLabel: report.meta.dateLabel,
      version: report.meta.appVersion,
    };
  }, [report]);

  const viewTitle = VIEW_TITLES[activeView] ?? "Overview";
  const showTool = activeView === "axiforge-lab";

  function handleExportReport() {
    if (!report) return;
    const html = buildReportHtmlExport(report);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.meta.title.replace(/[^a-z0-9]+/gi, "-")}-snapshot.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const viewIcon = VIEW_ICONS[activeView] ?? <Activity className="w-4 h-4" />;

  // When no report loaded yet (and not in the middle of initial load), show Import Center
  const showImport = (!report || atHome) && !loading && !error;
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
      {(report || showTool) && <Sidebar activeView={activeView} setActiveView={setActiveView} />}

      <main className="flex-1 overflow-y-auto h-full scroll-smooth custom-scrollbar">
        {/* Header - only when report is active */}
        {report && (
          <header className="border-b border-amber-500/10 bg-black/50 backdrop-blur-xl sticky top-0 z-30 px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
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
                {/* These toggles only actually affect Offensive/Squad Stats (damage scope) and Defensive (per-second + squad-only) - hidden elsewhere so they stay honest about which views they change. */}
                {(activeView === "offensive" || activeView === "squad-stats") && <DamageScopeToggle />}
                {(activeView === "defensive" || activeView === "offensive") && <StatsDisplayToggle />}
                {(activeView === "defensive" || activeView === "squad-stats") && <AllyScopeToggle />}
              <button
                onClick={() => setAtHome(true)}
                title="Import more logs without discarding this report"
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-amber-400 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-amber-500/30 bg-black/30 transition-colors"
              >
                <Upload className="w-3 h-3" />
                Import
              </button>
              <button
                onClick={handleExportReport}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-sky-400 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-sky-500/30 bg-black/30 transition-colors"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
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

        {report && report.meta.appVersion !== METRICS_VERSION && !atHome && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <span className="font-bold">This report was built by an earlier version.</span>{" "}
              Stats are calculated when a report is built, not when it is viewed, so
              anything fixed or added since then is missing here - some tables may be
              empty and some toggles may appear to do nothing. Re-import the raw logs
              to rebuild it with the current metrics.
            </div>
          </div>
        )}

        {/* Content */}
        <div className={report || showTool ? "p-6" : "flex items-center justify-center min-h-full"}>
          {showTool ? (
            <AxiForgeLabView />
          ) : showLoading ? (
            <LoadingState />
          ) : showError ? (
            <ErrorState message={error!} />
          ) : showImport ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="w-full">
                {report && (
                  <div className="flex justify-center mb-4">
                    <button
                      onClick={() => setAtHome(false)}
                      className="text-[10px] font-bold uppercase tracking-wider text-sky-400 hover:text-sky-300 px-3 py-2 rounded-lg border border-sky-500/30 bg-sky-500/5 transition-colors"
                    >
                      Back to report
                    </button>
                  </div>
                )}
                <NoReportState onOpenAxiForgeLab={() => setActiveView("axiforge-lab")} />
              </div>
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
  // Runs once per launch, no-op outside the desktop app - see
  // src/utils/useAutoUpdater.ts for why this checks on startup only
  // instead of polling.
  const updateState = useAutoUpdater();

  return (
    <ViewProvider>
      <CompareProvider>
        <ReportProvider>
          <DamageScopeProvider>
            <StatsDisplayProvider>
              <AllyScopeProvider>
                <ReportShell />
                <UpdateToast {...updateState} />
              </AllyScopeProvider>
            </StatsDisplayProvider>
          </DamageScopeProvider>
        </ReportProvider>
      </CompareProvider>
    </ViewProvider>
  );
}
