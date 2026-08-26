import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Sidebar, { VIEW_ICONS, VIEW_TONES } from "./components/layout/Sidebar";
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
import CommanderStatsHighlightsView from "./views/CommanderStatsHighlightsView";
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
import ConditionsView from "./views/ConditionsView";
import PartyBoonsView from "./views/PartyBoonsView";
import ArchiveView from "./views/ArchiveView";
import CompareView from "./views/CompareView";
import IntelligenceDebugView from "./views/IntelligenceDebugView";
import AxiForgeLabView from "./views/AxiForgeLabView";
import { downloadReportArtifact } from "./lib/shareReportArtifact";
import { buildEntropyShareLink, getReportPermalinks } from "./lib/shareLinks";
import { METRICS_VERSION } from "./lib/buildReportFromFights";
import { Activity, CircleAlert as AlertCircle, CloudUpload, FlaskConical, Link2, MessageCircle, RefreshCw, Send, Upload, X } from "lucide-react";
import UploadCard from "./components/ui/UploadCard";
import EntropyLogo from "./components/ui/EntropyLogo";
import HostedReportShareModal from "./components/ui/HostedReportShareModal";
import RawLogImporter from "./components/ui/RawLogImporter";
import UpdateToast from "./components/ui/UpdateToast";
import { useAutoUpdater } from "./utils/useAutoUpdater";
import {
  buildDiscordReportPayload,
  clearDiscordWebhookUrl,
  isDiscordWebhookUrl,
  loadDiscordWebhookUrl,
  saveDiscordWebhookUrl,
  sendDiscordWebhook,
} from "./utils/discordWebhook";




const VIEW_TITLES: Record<string, string> = {
  overview: "Overview",
  kdr: "KDR",
  "fight-breakdown": "Fight Breakdown",
  "top-players": "Top Players",
  "top-skills": "Top Skills",
  buffs: "Buffs",
  classes: "Classes",
  "map-distribution": "Map Distribution",
  "commander-stats": "Commander Stats & Highlights",
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
  "conditions": "Conditions",
  "party-boons": "Party Boons",
  highlights: "Commander Stats & Highlights",
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
    case "commander-stats": return <CommanderStatsHighlightsView key="commander-stats" initialTab="stats" />;
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
    case "conditions": return <ConditionsView />;
    case "party-boons": return <PartyBoonsView />;
    case "highlights": return <CommanderStatsHighlightsView key="highlights" initialTab="highlights" />;
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
    <div className="theme-cinematic-landing">
      <div className="theme-cinematic-scanline" aria-hidden="true" />
      <div className="theme-sanctum-sigils" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => <span key={index}><i /></span>)}
      </div>
      <div className="theme-signal-field" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => (
          <span
            key={index}
            style={{
              height: `${18 + ((index * 29) % 54)}%`,
              animationDelay: `${-((index * 0.11) % 3.6)}s`,
            }}
          />
        ))}
        <i />
      </div>

      <section className="theme-cinematic-stage" aria-labelledby="entropy-landing-title">
        <div className="theme-cinematic-copy">
          <div className="theme-cinematic-kicker">
            <span className="theme-cinematic-signal" aria-hidden="true" />
            WvW command intelligence
          </div>

          <div className="theme-signal-lockup">
            <div className="theme-cinematic-mark" aria-hidden="true">
              <EntropyLogo size={48} />
            </div>
            <h1 id="entropy-landing-title" className="theme-cinematic-wordmark" data-wordmark="ENTROPY">
              Entropy
            </h1>
          </div>
          <p className="theme-cinematic-declaration">
            Read the fight. Find the break. Command the next push.
          </p>
          <p className="theme-cinematic-support">
            Turn raw WvW combat records into evidence without changing the fight beneath the numbers.
          </p>

          <div className="theme-cinematic-readouts" aria-label="Supported analysis workflow">
            <div><span>01</span><strong>Raw logs</strong></div>
            <div><span>02</span><strong>Fight evidence</strong></div>
            <div><span>03</span><strong>Command review</strong></div>
          </div>
        </div>

        <div className="theme-ingress-console">
          <header className="theme-ingress-header">
            <div>
              <span>Operation intake</span>
              <strong>Open combat record</strong>
            </div>
            <div className="theme-ingress-status"><i aria-hidden="true" /> Ready</div>
          </header>

          <RawLogImporter cinematic />

          <details className="theme-saved-report-gate">
            <summary>Open a saved Entropy report</summary>
            <div className="theme-saved-report-body">
              <UploadCard onFile={uploadReport} onUrl={loadFromUrl} error={error} loading={loading} />
            </div>
          </details>

          <footer className="theme-ingress-footer">
            <div className="theme-ingress-formats">
              <span><Activity className="w-3 h-3" /> .zevtc / .evtc</span>
              <span><Link2 className="w-3 h-3" /> dps.report</span>
              <span><Activity className="w-3 h-3" /> shared reports</span>
            </div>
            <button type="button" onClick={onOpenAxiForgeLab} className="theme-command-button theme-builder-entry">
              <FlaskConical className="h-4 w-4" />
              Entropy Builder
            </button>
          </footer>
        </div>
      </section>

      <div className="theme-cinematic-horizon" aria-hidden="true">
        <span>Signal survives the noise</span>
      </div>
    </div>
  );
}




type DiscordShareStatus = "idle" | "missing" | "sending" | "sent" | "failed" | "saved" | "cleared";
type ExportStatus = "idle" | "copied" | "copied-partial" | "downloaded" | "no-link" | "failed";




function ReportShell() {
  const { report, loading, error, source, reloadReport, clearReport } = useReport();
  // Lets you get back to the import screen to add more logs without
  // throwing away the report you already have - Clear is destructive and
  // was previously the only route back.
  const [atHome, setAtHome] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(() => loadDiscordWebhookUrl());
  const [discordDraftUrl, setDiscordDraftUrl] = useState(() => loadDiscordWebhookUrl());
  const [discordOpen, setDiscordOpen] = useState(false);
  const [hostedShareOpen, setHostedShareOpen] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<DiscordShareStatus>("idle");
  const [discordError, setDiscordError] = useState("");
  const { activeView, setActiveView } = useView(); function handleSetActiveView(view: string) { setAtHome(false); setActiveView(view); }




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




  function flashExportStatus(status: ExportStatus) {
    setExportStatus(status);
    window.setTimeout(() => setExportStatus("idle"), 2500);
  }


  function flashDiscordStatus(status: DiscordShareStatus, message = "") {
    setDiscordStatus(status);
    setDiscordError(message);
    if (status !== "sending" && status !== "missing") {
      window.setTimeout(() => {
        setDiscordStatus("idle");
        setDiscordError("");
      }, 3000);
    }
  }




  async function handleExportReport() {
    if (!report) return;

    try {
      const permalinks = getReportPermalinks(report);
      const totalFights = report.stats?.fightBreakdown?.length ?? 0;
      const viewerLink = buildEntropyShareLink(report);
      if (viewerLink && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(viewerLink);
        flashExportStatus(totalFights > 0 && permalinks.length < totalFights ? "copied-partial" : "copied");
        return;
      }

      downloadReportArtifact(report);
      flashExportStatus(permalinks.length === 0 ? "no-link" : "downloaded");
    } catch {
      try {
        downloadReportArtifact(report);
        flashExportStatus("downloaded");
      } catch {
        flashExportStatus("failed");
      }
    }
  }


  function handleSaveDiscordWebhook() {
    const trimmed = discordDraftUrl.trim();
    if (!isDiscordWebhookUrl(trimmed)) {
      flashDiscordStatus("missing", "Paste a valid Discord webhook URL from your Discord channel settings.");
      return;
    }

    saveDiscordWebhookUrl(trimmed);
    setDiscordWebhookUrl(trimmed);
    flashDiscordStatus("saved");
  }


  function handleClearDiscordWebhook() {
    clearDiscordWebhookUrl();
    setDiscordWebhookUrl("");
    setDiscordDraftUrl("");
    flashDiscordStatus("cleared");
  }


  async function handleShareToDiscord(webhookOverride?: string) {
    if (!report) return;

    const webhookUrl = (webhookOverride ?? discordWebhookUrl).trim();
    if (!isDiscordWebhookUrl(webhookUrl)) {
      setDiscordOpen(true);
      flashDiscordStatus("missing", "Save a Discord webhook URL first, then send the report.");
      return;
    }

    try {
      setDiscordStatus("sending");
      setDiscordError("");
      const viewerUrl = buildEntropyShareLink(report);
      await sendDiscordWebhook(webhookUrl, buildDiscordReportPayload(report, viewerUrl));
      flashDiscordStatus("sent");
    } catch (err) {
      flashDiscordStatus("failed", err instanceof Error ? err.message : "Discord share failed.");
    }
  }




  const exportLabel =
    exportStatus === "copied" ? "Viewer link copied" : exportStatus === "copied-partial" ? "Link copied (partial)" : exportStatus === "downloaded" ? "Report saved" : exportStatus === "no-link" ? "No dps.report link" : exportStatus === "failed" ? "Export failed" : "Export";
  const discordLabel =
    discordStatus === "sending" ? "Sending" : discordStatus === "sent" ? "Sent" : discordStatus === "failed" ? "Failed" : discordStatus === "saved" ? "Saved" : "Discord";
  const viewIcon = VIEW_ICONS[activeView] ?? <Activity className="w-4 h-4" />;


  async function handleReplaceLogs() {
    await clearReport();
    setAtHome(true);
  }


  async function handleReloadCurrent() {
    await reloadReport();
    setAtHome(false);
  }




  // When no report loaded yet (and not in the middle of initial load), show Import Center
  const showImport = (!report || atHome) && !loading && !error;
  const showLoading = loading && !report;
  const showError = !loading && !report && !!error;




  return (
    <div className="theme-app-shell flex h-screen w-full overflow-hidden">
      <div className="entropy-bg" />




      {/* Only show sidebar when a report is loaded */}
      {(report || showTool) && <Sidebar activeView={activeView} setActiveView={handleSetActiveView} />}




      <main
        className="theme-main flex-1 overflow-y-auto h-full scroll-smooth custom-scrollbar"
        data-workspace-tone={VIEW_TONES[activeView] ?? "overview"}
      >
        {/* Header - only when report is active */}
        {report && (
          <header className="theme-topbar sticky top-0 z-30 px-6 py-4">
            <div className="theme-topbar-inner flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-theme-accent">{viewIcon}</span>
                <div>
                  <h1 className="theme-view-title text-lg font-black text-theme-text uppercase font-display">{viewTitle}</h1>
                  <p className="theme-view-meta text-xs text-theme-accent/80 font-medium">
                    {headerInfo?.title} - {headerInfo?.dateLabel}
                  </p>
                </div>
              </div>
              <div className="theme-topbar-actions flex flex-wrap items-center justify-end gap-2">
                {/* These toggles only actually affect Offensive/Squad Stats (damage scope) and Defensive (per-second + squad-only) - hidden elsewhere so they stay honest about which views they change. */}
                {(activeView === "offensive" || activeView === "squad-stats") && <DamageScopeToggle />}
                {(activeView === "defensive" || activeView === "offensive") && <StatsDisplayToggle />}
                {(activeView === "defensive" || activeView === "squad-stats") && <AllyScopeToggle />}
                <button
                  onClick={() => void handleReloadCurrent()}
                  disabled={loading}
                  title="Re-fetch the current report's dps.report fights and rebuild metrics with this Entropy version when source links are available."
                  className="theme-quiet-button flex items-center gap-1.5 px-2.5 py-1.5 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Reloading" : "Reload"}
                </button>
                <button
                  onClick={() => setAtHome(true)}
                  title="Open the combat record intake. The current report stays active until you view or combine new fights."
                  className="theme-quiet-button flex items-center gap-1.5 px-2.5 py-1.5"
                >
                  <Upload className="w-3 h-3" />
                  Add logs
                </button>
                <button
                  onClick={() => void handleReplaceLogs()}
                  title="Clear the current report and start a fresh log intake."
                  className="theme-quiet-button flex items-center gap-1.5 px-2.5 py-1.5 hover:text-amber-300"
                >
                  <Upload className="w-3 h-3" />
                  Replace logs
                </button>
                <button
                  onClick={handleExportReport}
                  title="Copy a live Entropy viewer link that reloads these fights from their dps.report permalinks — works for any fight imported as a raw .zevtc/.evtc file or pasted dps.report link. Falls back to a local report file when no permalinks are available."
                  className="theme-quiet-button flex items-center gap-1.5 px-2.5 py-1.5"
                >
                  <Link2 className="w-3 h-3" />
                  {exportLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setHostedShareOpen(true)}
                  title="Upload this report as a public, unlisted Entropy web report."
                  className="theme-quiet-button flex items-center gap-1.5 px-2.5 py-1.5"
                >
                  <CloudUpload className="h-3 w-3" />
                  Share to Web
                </button>
                <button
                  onClick={() => handleShareToDiscord()}
                  title="Post a compact Entropy summary embed to your saved Discord webhook."
                  className="theme-quiet-button flex items-center gap-1.5 px-2.5 py-1.5 disabled:opacity-60"
                  disabled={discordStatus === "sending"}
                >
                  <MessageCircle className="w-3 h-3" />
                  {discordLabel}
                </button>
                <button
                  onClick={() => {
                    setDiscordDraftUrl(discordWebhookUrl);
                    setDiscordOpen(true);
                  }}
                  title="Configure the Discord webhook used by the share button."
                  className="theme-quiet-button flex items-center gap-1.5 px-2.5 py-1.5"
                >
                  <Send className="w-3 h-3" />
                  Webhook
                </button>
                {source && (
                  <button
                    type="button"
                    onClick={handleExportReport}
                    title="Copy a live Entropy viewer link that reloads these fights from their dps.report permalinks — works for any fight imported as a raw .zevtc/.evtc file or pasted dps.report link. Falls back to a local report file when no permalinks are available."
                    className={`theme-status-pill flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:brightness-125 cursor-pointer ${
                      source === "upload"
                        ? "text-amber-400 border-amber-500/30 bg-amber-500/5"
                        : "text-sky-400 border-sky-500/30 bg-sky-500/5"
                    }`}
                  >
                    {exportStatus !== "idle" ? <Link2 className="w-3 h-3" /> : source === "upload" ? <Upload className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                    {exportStatus !== "idle" ? exportLabel : source === "upload" ? "Uploaded" : "Shared link"}
                  </button>
                )}
                <button
                  onClick={clearReport}
                  title="Clear the current report from this session."
                  className="theme-quiet-button flex items-center gap-1.5 px-2.5 py-1.5 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
                {headerInfo && (
                  <div className="theme-status-pill flex items-center gap-3 px-4 py-2 text-xs font-mono">
                    <span>v{headerInfo.version}</span>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {hostedShareOpen && report && <HostedReportShareModal report={report} onClose={() => setHostedShareOpen(false)} />}

        {discordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="theme-modal w-full max-w-xl rounded-2xl border border-violet-400/20 bg-slate-950/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-100">Discord webhook</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Save a channel webhook here, then Entropy can post a compact report summary embed. The full report JSON is never sent.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiscordOpen(false)}
                  className="rounded-lg border border-white/[0.06] bg-black/30 p-2 text-slate-500 transition hover:border-rose-400/30 hover:text-rose-300"
                  aria-label="Close Discord webhook settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-5 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Discord webhook URL
              </label>
              <input
                value={discordDraftUrl}
                onChange={(event) => {
                  setDiscordDraftUrl(event.target.value);
                  if (discordStatus === "missing" || discordStatus === "failed") {
                    setDiscordStatus("idle");
                    setDiscordError("");
                  }
                }}
                placeholder="https://discord.com/api/webhooks/..."
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400/40"
              />

              {(discordError || discordStatus === "saved" || discordStatus === "cleared" || discordStatus === "sent") && (
                <p
                  className={`mt-3 text-xs ${
                    discordStatus === "failed" || discordStatus === "missing"
                      ? "text-rose-300"
                      : discordStatus === "sent" || discordStatus === "saved"
                        ? "text-emerald-300"
                        : "text-slate-400"
                  }`}
                >
                  {discordError ||
                    (discordStatus === "sent"
                      ? "Report sent to Discord."
                      : discordStatus === "saved"
                        ? "Webhook saved locally."
                        : "Webhook cleared.")}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClearDiscordWebhook}
                  className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:border-rose-400/30 hover:text-rose-300"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleSaveDiscordWebhook}
                  className="rounded-xl border border-violet-400/20 bg-violet-500/[0.08] px-4 py-2 text-xs font-bold uppercase tracking-wider text-violet-200 transition hover:bg-violet-500/[0.16]"
                >
                  Save webhook
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const trimmed = discordDraftUrl.trim();
                    if (!isDiscordWebhookUrl(trimmed)) {
                      flashDiscordStatus("missing", "Paste a valid Discord webhook URL from your Discord channel settings.");
                      return;
                    }
                    saveDiscordWebhookUrl(trimmed);
                    setDiscordWebhookUrl(trimmed);
                    await handleShareToDiscord(trimmed);
                  }}
                  disabled={discordStatus === "sending" || !report}
                  className="rounded-xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/[0.16] disabled:opacity-60"
                >
                  {discordStatus === "sending" ? "Sending..." : "Save + send"}
                </button>
              </div>
            </div>
          </div>
        )}


        {report && error && !atHome && (
          <div className="theme-alert-plate mx-6 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-rose-200/90 leading-relaxed">
              <span className="font-bold">Report reload needs a source.</span>{" "}
              {error}
            </div>
          </div>
        )}




        {report && report.meta.appVersion !== METRICS_VERSION && !atHome && (
          <div className="theme-alert-plate mx-6 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 flex items-start gap-3">
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
        <div className={showImport ? "min-h-full" : report || showTool ? "theme-content p-6" : "min-h-full"}>
          {showTool ? (
            <AxiForgeLabView />
          ) : showLoading ? (
            <LoadingState />
          ) : showError ? (
            <ErrorState message={error!} />
          ) : showImport ? (
            <motion.div className="min-h-full w-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="min-h-full w-full">
                {report && (
                  <div className="theme-landing-return">
                    <button
                      onClick={() => setAtHome(false)}
                      className="theme-command-button text-[10px] font-bold uppercase tracking-wider px-3 py-2 transition-colors"
                    >
                      Back to current report
                    </button>
                  </div>
                )}
                <NoReportState onOpenAxiForgeLab={() => setActiveView("axiforge-lab")} />
              </div>
            </motion.div>
          ) : report ? (
            <div className="min-h-full w-full">
              <ReportRouter activeView={activeView} />
            </div>
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

