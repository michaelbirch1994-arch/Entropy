import { useEffect, useMemo, useState } from "react";
import Panel from "../components/ui/Panel";
import { Archive, Search, Trash2, FolderOpen, GitCompare } from "lucide-react";
import { getAllArchived, deleteFromArchive, type ArchiveEntry } from "../utils/reportArchive";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";
import { useCompare } from "../store/CompareContext";
import { fmtCompact, fmtNum } from "../utils/format";
import { SortableHeader } from "../components/ui/SortableHeader";

type SortKey = "title" | "commanders" | "fights" | "record" | "totalDamage" | "avgSquadSize";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export default function ArchiveView() {
  const { setReport } = useReport();
  const { setActiveView } = useView();
  const { setCompareIds } = useCompare();
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>(null);

  function refresh() {
    getAllArchived().then(setEntries);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    const visible = q
      ? entries.filter(
          (e) => e.title.toLowerCase().includes(q) || e.commanders.some((c) => c.toLowerCase().includes(q)),
        )
      : entries;
    const base = [...visible].sort((a, b) => a.title.localeCompare(b.title) || a.dateLabel.localeCompare(b.dateLabel));
    if (!sort) return base;
    const dir = sort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      if (sort.key === "title") return a.title.localeCompare(b.title) * dir || a.dateLabel.localeCompare(b.dateLabel);
      if (sort.key === "commanders") return a.commanders.join(", ").localeCompare(b.commanders.join(", ")) * dir || a.title.localeCompare(b.title);
      if (sort.key === "record") {
        const ar = a.wins - a.losses;
        const br = b.wins - b.losses;
        return (ar - br) * dir || a.title.localeCompare(b.title);
      }
      return (a[sort.key] - b[sort.key]) * dir || a.title.localeCompare(b.title);
    });
  }, [entries, query, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Cap at 2 - compare mode is always exactly two reports side by side.
        if (next.size >= 2) {
          const [oldest] = next;
          next.delete(oldest);
        }
        next.add(id);
      }
      return next;
    });
  }

  async function handleDelete(id: string) {
    await deleteFromArchive(id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    refresh();
  }

  function handleOpen(entry: ArchiveEntry) {
    void setReport(entry.report);
    setActiveView("overview");
  }

  function handleCompare() {
    const ids = Array.from(selected);
    if (ids.length !== 2) return;
    setCompareIds([ids[0], ids[1]]);
    setActiveView("compare");
  }

  if (entries === null) {
    return <div className="flex items-center justify-center py-24 text-theme-muted text-sm">Loading archive...</div>;
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Report Archive"
        subtitle="Every report you've loaded on this device, searchable by title or commander - stored locally, no server involved"
        icon={<Archive className="w-4 h-4" />}
        action={<span className="text-[10px] text-theme-muted font-mono">{entries.length} reports saved</span>}
      >
        {entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-theme-muted">
            No archived reports yet - it fills up automatically as you load reports.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title or commander..."
                  className="w-full rounded-lg border border-theme-border bg-theme-surface-inset pl-8 pr-3 py-2 text-xs text-theme-text placeholder:text-theme-faint outline-none transition-all focus:border-theme-accent/50"
                />
              </div>
              {selected.size === 2 && (
                <button
                  type="button"
                  onClick={handleCompare}
                  className="flex items-center gap-1.5 rounded-lg border border-theme-accent/35 bg-theme-accent/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-theme-accent-strong transition-all hover:bg-theme-accent/15"
                >
                  <GitCompare className="w-3.5 h-3.5" /> Compare Selected
                </button>
              )}
              {selected.size > 0 && (
                <span className="text-[10px] text-theme-muted">{selected.size}/2 selected for compare</span>
              )}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] text-theme-muted uppercase font-bold tracking-wider border-b border-theme-border/50">
                    <th className="p-2.5 w-8"></th>
                    <SortableHeader label="Report" sortKey="title" state={sort} onSort={toggleSort} />
                    <SortableHeader label="Commanders" sortKey="commanders" state={sort} onSort={toggleSort} />
                    <SortableHeader label="Fights" sortKey="fights" state={sort} onSort={toggleSort} align="right" />
                    <SortableHeader label="Outcome" sortKey="record" state={sort} onSort={toggleSort} align="right" />
                    <SortableHeader label="Squad Damage" sortKey="totalDamage" state={sort} onSort={toggleSort} align="right" />
                    <SortableHeader label="Avg Squad" sortKey="avgSquadSize" state={sort} onSort={toggleSort} align="right" />
                    <th className="p-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/30 font-mono">
                  {filtered.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-theme-surface-elevated/60">
                      <td className="p-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggleSelected(e.id)}
                          aria-label={`Select ${e.title} for comparison`}
                          className="w-3.5 h-3.5 accent-theme-accent cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5">
                        <div className="text-theme-text font-semibold">{e.title}</div>
                        <div className="text-[10px] text-theme-muted">{e.dateLabel}</div>
                      </td>
                      <td className="p-2.5 text-theme-muted whitespace-nowrap">{e.commanders.join(", ") || "—"}</td>
                      <td className="p-2.5 text-right text-theme-text/80">{fmtNum(e.fights)}</td>
                      <td className="p-2.5 text-right">
                        {e.wins + e.losses > 0 ? <>
                          <span className="text-emerald-400">{e.wins}</span>
                          <span className="text-theme-faint"> / </span>
                          <span className="text-rose-400">{e.losses}</span>
                        </> : <span className="text-theme-muted">{e.unclassified ?? e.fights} unclassified</span>}
                      </td>
                      <td className="p-2.5 text-right text-orange-400 font-bold">{fmtCompact(e.totalDamage)}</td>
                      <td className="p-2.5 text-right text-theme-text/80">{e.avgSquadSize.toFixed(1)}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpen(e)}
                            title="Open this report"
                            aria-label={`Open ${e.title}`}
                            className="text-theme-muted hover:text-theme-accent-strong transition-colors"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(e.id)}
                            title="Remove from archive"
                            aria-label={`Remove ${e.title} from archive`}
                            className="text-theme-muted hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
