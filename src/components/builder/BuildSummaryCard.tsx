import { useMemo, useRef } from "react";
import { Check, Clipboard, Copy, EllipsisVertical, Link2, Trash2, X } from "lucide-react";
import { computeAttributeProfile } from "../../lib/gw2/computeAttributes";
import { validateBuilder } from "../../lib/axiforge/builderModel";
import type { BuilderPressureIdentity } from "../../lib/axiforge/squadTactics";
import type { Gw2Specialization, SavedBuilderBuild } from "../../types/buildEditor";
import ClassIcon from "../ui/ClassIcon";

interface BuildSummaryCardProps {
  build: SavedBuilderBuild;
  index?: number;
  onOpen: (build: SavedBuilderBuild) => void;
  onDuplicate?: (build: SavedBuilderBuild) => void;
  onDelete?: (id: string) => void;
  onCopy?: (code: string) => void;
  onShare?: (code: string) => void;
  deletePending?: boolean;
  onRequestDelete?: (id: string) => void;
  onCancelDelete?: () => void;
  onFocus?: (id: string) => void;
  slotCount?: number;
  draggable?: boolean;
  specsById: Map<number, Gw2Specialization>;
}

function pressureLabel(identity: BuilderPressureIdentity): string {
  if (identity === "strike") return "Strike pressure";
  if (identity === "condition") return "Condition pressure";
  if (identity === "support") return "Support uptime";
  return "Sustain core";
}

function pressureShortLabel(identity: BuilderPressureIdentity): string {
  if (identity === "strike") return "Strike";
  if (identity === "condition") return "Condi";
  if (identity === "support") return "Support";
  return "Sustain";
}

function eliteSpecName(build: SavedBuilderBuild, specsById: Map<number, Gw2Specialization>): string {
  for (const id of build.state.specializationIds) {
    if (id == null) continue;
    const spec = specsById.get(id);
    if (spec?.elite) return spec.name;
  }
  return build.state.professionId;
}

function weaponSummary(build: SavedBuilderBuild): string {
  const { weapons } = build.state.equipment;
  const setOne = [weapons.mainhand1, weapons.offhand1].filter(Boolean).join(" + ");
  const setTwo = [weapons.mainhand2, weapons.offhand2].filter(Boolean).join(" + ");
  return [setOne, setTwo].filter(Boolean).join(" / ") || "Weapons open";
}

function skillCount(build: SavedBuilderBuild): number {
  return [build.state.healSkillId, ...build.state.utilitySkillIds, build.state.eliteSkillId].filter(Boolean).length;
}

function gearCount(build: SavedBuilderBuild): number {
  const gearSlots = Object.values(build.state.equipment.slots).filter(Boolean).length;
  const runes = Object.values(build.state.equipment.runes).filter(Boolean).length;
  const sigils = Object.values(build.state.equipment.sigils).flat().filter(Boolean).length;
  const extras = [build.state.equipment.relic, build.state.equipment.food, build.state.equipment.utility, build.state.equipment.enrichment].filter(Boolean).length;
  return gearSlots + runes + sigils + extras;
}

export default function BuildSummaryCard({
  build,
  index,
  onOpen,
  onDuplicate,
  onDelete,
  onCopy,
  onShare,
  deletePending = false,
  onRequestDelete,
  onCancelDelete,
  onFocus,
  slotCount = 0,
  draggable = false,
  specsById,
}: BuildSummaryCardProps) {
  const actionMenuRef = useRef<HTMLDetailsElement>(null);
  const actionMenuTriggerRef = useRef<HTMLElement>(null);
  const profile = useMemo(() => computeAttributeProfile(build.state, null), [build]);
  const readinessIssues = useMemo(() => validateBuilder(build.state), [build]);
  const isDraft = !build.shareCode || readinessIssues.length > 0;
  const hasSecondaryActions = Boolean(onDuplicate || onCopy || onShare || onDelete);
  const summary = [build.state.role, build.state.equipment.statPackage, weaponSummary(build)].filter(Boolean).join(" / ");
  const cancelDelete = () => {
    onCancelDelete?.();
    window.requestAnimationFrame(() => actionMenuTriggerRef.current?.focus());
  };
  const runMenuAction = (action: () => void) => {
    action();
    actionMenuRef.current?.removeAttribute("open");
  };

  return (
    <article
      className="theme-builder-library-card"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", build.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
      onFocus={() => onFocus?.(build.id)}
      onMouseEnter={() => onFocus?.(build.id)}
    >
      {index != null && <div className="theme-builder-index">{String(index + 1).padStart(2, "0")}</div>}
      <button type="button" className="theme-builder-library-card-main" onClick={() => onOpen(build)} title={`Open ${build.name}`}>
        <ClassIcon name={eliteSpecName(build, specsById)} size="md" />
        <span>
          <strong>{build.name}</strong>
          <small>{[build.state.professionId, pressureLabel(profile.primaryIdentity)].join(" / ")}</small>
          <em>{summary || "No doctrine assigned"}</em>
        </span>
      </button>
      <div className="theme-builder-library-card-stats">
        <span><b>{profile.pressure[profile.primaryIdentity]}</b>{pressureShortLabel(profile.primaryIdentity)}</span>
        <span><b>{skillCount(build)}</b>Skills</span>
        <span><b>{gearCount(build)}</b>Gear</span>
      </div>
      <div className="theme-builder-card-badges">
        <span className={isDraft ? "is-draft" : "is-ready"}>{isDraft ? "Draft" : "Ready"}</span>
        {slotCount > 0 && <span className="is-assigned">Squad x{slotCount}</span>}
      </div>
      <div className="theme-builder-row-actions">
        {deletePending ? (
          <div
            className="theme-builder-delete-confirm"
            role="group"
            aria-label={`Confirm deletion of ${build.name}`}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              cancelDelete();
            }}
          >
            <span>Delete build?</span>
            <button type="button" className="is-confirm" onClick={() => onDelete?.(build.id)} title="Confirm delete" aria-label={`Confirm deletion of ${build.name}`} autoFocus><Check /></button>
            <button type="button" onClick={cancelDelete} title="Cancel delete" aria-label={`Cancel deletion of ${build.name}`}><X /></button>
          </div>
        ) : (
          hasSecondaryActions && <details ref={actionMenuRef} className="theme-builder-card-menu">
            <summary ref={actionMenuTriggerRef} title="Build actions" aria-label={`Actions for ${build.name}`}><EllipsisVertical /></summary>
            <div role="menu" aria-label={`Actions for ${build.name}`}>
              {onDuplicate && <button type="button" role="menuitem" onClick={() => runMenuAction(() => onDuplicate(build))}><Copy /><span>Duplicate</span></button>}
              {onCopy && <button type="button" role="menuitem" onClick={() => runMenuAction(() => onCopy(build.shareCode))} title={build.shareCode ? "Copy Entropy code" : "Draft has no exportable Entropy code yet"} disabled={!build.shareCode}><Clipboard /><span>Copy Entropy code</span></button>}
              {onShare && <button type="button" role="menuitem" onClick={() => runMenuAction(() => onShare(build.shareCode))} title={build.shareCode ? "Copy share link" : "Draft has no share link yet"} disabled={!build.shareCode}><Link2 /><span>Copy share link</span></button>}
              {onDelete && <button type="button" role="menuitem" onClick={() => runMenuAction(() => onRequestDelete?.(build.id))}><Trash2 /><span>Delete</span></button>}
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
