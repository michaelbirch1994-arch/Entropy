import { useState } from "react";
import { BarChart3, Crown, Star } from "lucide-react";
import Panel from "../components/ui/Panel";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { useReport } from "../store/ReportContext";
import CommanderStatsView from "./CommanderStatsView";
import HighlightsView from "./HighlightsView";

type CommanderWorkspaceTab = "stats" | "highlights";

export default function CommanderStatsHighlightsView({ initialTab = "stats" }: { initialTab?: CommanderWorkspaceTab }) {
  const { report } = useReport();
  const [activeTab, setActiveTab] = useState<CommanderWorkspaceTab>(initialTab);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  if (!report) return null;

  const rows = report.stats.commanderStats?.rows ?? [];
  const commander = rows.find((row) => row.account === selectedAccount) ?? rows[0] ?? null;
  const coversWholeReport = Boolean(commander && rows.length === 1 && commander.fights === report.stats.total);
  const commanderFightIndices = commander
    ? commander.fightIndices ?? (
      rows.length === 1 && commander.fights === report.stats.total
        ? report.stats.fightBreakdown.map((_, index) => index)
        : []
    )
    : undefined;
  const displayCommander = commander && coversWholeReport && typeof commander.squadKills !== "number"
    ? {
      ...commander,
      squadKills: report.stats.totalSquadKills,
      squadDowns: report.stats.totalEnemyDowns,
      alliesDown: report.stats.totalSquadDowns,
      alliesDead: report.stats.totalSquadDeaths,
      avgSquadSize: report.stats.avgSquadSize,
      avgEnemySize: report.stats.avgEnemies,
      fightIndices: commanderFightIndices,
    }
    : commander;
  const commanderLabel = commander?.characterNames[0] || commander?.account;

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-col gap-3 border-b border-theme-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          ariaLabel="Commander stats and highlights view"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> },
            { value: "highlights", label: "Highlights", icon: <Star className="h-4 w-4" /> },
          ]}
        />

        {rows.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar" role="group" aria-label="Select commander">
            {rows.map((row) => (
              <button
                key={row.account}
                type="button"
                aria-pressed={row.account === commander?.account}
                onClick={() => setSelectedAccount(row.account)}
                className={`theme-filter-chip min-w-max border px-3 py-2 text-xs font-black ${row.account === commander?.account ? "border-theme-focus bg-theme-accentDim text-theme-accentStrong" : "border-theme-border text-theme-muted"}`}
              >
                {row.characterNames[0] || row.account}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === "stats" && (
        displayCommander ? (
          <CommanderStatsView
            commander={displayCommander}
            fightBreakdown={commander?.fightIndices ? report.stats.fightBreakdown : []}
          />
        ) : (
          <Panel title="Commander Stats" icon={<Crown className="h-4 w-4" />}>
            <div className="border-l-2 border-theme-focus bg-black/25 px-4 py-8 text-sm text-theme-muted">
              No commander identity was recorded for this report.
            </div>
          </Panel>
        )
      )}

      {activeTab === "highlights" && (
        <HighlightsView fightIndices={commanderFightIndices} commanderLabel={commanderLabel} />
      )}
    </div>
  );
}
