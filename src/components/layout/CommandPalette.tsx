import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, Swords, UserRound } from "lucide-react";
import { VIEW_SECTIONS } from "../../lib/viewRegistry";
import { useReport } from "../../store/ReportContext";
import type { ViewNavigationTarget } from "../../store/ViewContext";
import WorkspaceDialog from "../ui/WorkspaceDialog";
import { VIEW_ICONS } from "./Sidebar";

export type WorkspaceDestination = Omit<ViewNavigationTarget, "targetView">;
type Command = { id: string; label: string; detail: string; view: string; kind: "View" | "Player" | "Fight"; target?: WorkspaceDestination; keywords: string };

export default function CommandPalette({ open, onClose, onNavigate }: {
  open: boolean; onClose: () => void; onNavigate: (view: string, target?: WorkspaceDestination) => void;
}) {
  const { report } = useReport();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [category, setCategory] = useState("All");
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const commands = useMemo<Command[]>(() => [
    ...VIEW_SECTIONS.flatMap((section) => section.items.filter((item) => report || item.requiresReport === false).map((item) => ({
      id: `view:${item.id}`, label: item.label, detail: section.title, view: item.id, kind: "View" as const,
      keywords: [item.label, ...(item.keywords ?? [])].join(" "),
    }))),
    ...(report?.stats.attendanceData ?? []).map((player) => ({
      id: `player:${player.account}`, label: player.account, detail: player.classTimes.map((entry) => entry.profession).join(", "), view: "roster", kind: "Player" as const,
      target: { source: "other" as const, account: player.account }, keywords: `${player.account} ${player.characterNames.join(" ")} ${player.classTimes.map((entry) => entry.profession).join(" ")}`,
    })),
    ...(report?.stats.fightBreakdown ?? []).map((fight, index) => ({
      id: `fight:${fight.id}`, label: `Fight ${index + 1}`, detail: `${fight.label} / ${fight.duration}`, view: "fight-breakdown", kind: "Fight" as const,
      target: { source: "other" as const, fightId: fight.id, fightIndex: index }, keywords: `fight ${index + 1} ${fight.fullLabel} ${fight.mapName}`,
    })),
  ], [report]);
  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((item) => (category === "All" || category === `${item.kind}s`) && terms.every((term) => item.keywords.toLowerCase().includes(term)));
  }, [commands, query, category]);

  useEffect(() => { if (open) { setQuery(""); setActive(0); setCategory("All"); } }, [open]);
  useEffect(() => { setActive(0); }, [query, category, report]);
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active]);

  function choose(command: Command) { onClose(); onNavigate(command.view, command.target); }

  return <WorkspaceDialog open={open} onClose={onClose} title="Search workspace" className="entropy-command-dialog">
    <div className="entropy-command-input">
      <Search size={20} aria-hidden="true" />
      <input autoFocus role="combobox" aria-label="Search views, players, and fights" aria-autocomplete="list" aria-expanded="true"
        aria-controls={listId} aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        placeholder="Find a view, player, or fight" value={query} onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            if (results.length) setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
          }
          if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); }
        }} />
    </div>
    <div className="entropy-command-categories" role="group" aria-label="Search category">
      {["All", "Views", "Players", "Fights"].map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
      <span role="status">{results.length} results</span>
    </div>
    <div className="entropy-command-results custom-scrollbar" id={listId} role="listbox" aria-label="Search results" ref={listRef}>
      {results.map((item, index) => <button type="button" role="option" id={`${listId}-${index}`} key={item.id} aria-selected={index === active}
        tabIndex={-1} className="entropy-command-result" onPointerMove={() => setActive(index)} onClick={() => choose(item)}>
        <span className="entropy-command-result-icon">{item.kind === "Player" ? <UserRound size={18} /> : item.kind === "Fight" ? <Swords size={18} /> : VIEW_ICONS[item.view]}</span>
        <span className="entropy-command-result-copy"><strong>{item.label}</strong><span>{item.detail}</span></span>
        <small>{item.kind}</small><ArrowUpRight size={15} aria-hidden="true" />
      </button>)}
    </div>
    {!results.length && <div className="entropy-empty-state"><Search size={24} /><strong>No matches</strong><p>No matching views, players, or fights in this workspace.</p></div>}
  </WorkspaceDialog>;
}
