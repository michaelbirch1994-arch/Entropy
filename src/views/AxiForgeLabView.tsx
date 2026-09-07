import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  computeAttributeProfile,
  type AttributeProfile,
  type AttributeTotals,
  type Gw2Attribute,
} from "../lib/gw2/computeAttributes";
import {
  AlertCircle,
  ArrowLeftRight,
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  Eraser,
  ExternalLink,
  FileCode2,
  Gauge,
  ListFilter,
  Layers3,
  Link2,
  Loader2,
  MinusCircle,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Save,
  Search,
  Share2,
  Shield,
  Sparkles,
  Swords,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  decodeAxiForgeCode,
  detectAxiForgeCodeKind,
  encodeAxiForgeBuildCode,
  encodeAxiForgeCompCode,
  brandEntropyCode,
  type AxiForgeDecodeResult,
} from "../lib/axiforge/axiForgeAdapter";
import {
  buildAxiForgeShareUrl,
  parseAxiForgeShareQuery,
  clearAxiForgeShareQuery,
} from "../lib/axiforge/axiForgeShareLink";
import {
  ARMOR_SLOTS,
  STAT_OPTIONS,
  buildAxiShape,
  builderFromAxiBuild,
  cloneBuilder,
  createComposition,
  createBuilderId,
  createEmptyBuilder,
  createParty,
  createSavedBuild,
  validateBuilder,
} from "../lib/axiforge/builderModel";
import { loadBuilderWorkspace, saveBuilderWorkspace } from "../lib/axiforge/builderStorage";
import { BOON_DISPLAY_ORDER, enrichedFactsForEntity, isProvidedEffectFact, type BoonCoverageEntry } from "../lib/axiforge/boonEngine";
import { computeBuildBoonCoverage, mergeLiveBuildForCoverage } from "../lib/axiforge/squadBoons";
import {
  BUILDER_CONDITION_DISPLAY_ORDER,
  fallbackConditionIcon,
  type BuilderConditionEntry,
} from "../lib/axiforge/conditionEngine";
import { computeBuildConditionAccess } from "../lib/axiforge/squadConditions";
import { BUILD_UTILITY_LABELS, BUILD_UTILITY_ORDER, type BuildUtilityEntry } from "../lib/axiforge/utilityEngine";
import { computeBuildUtilityCoverage } from "../lib/axiforge/squadUtility";
import { estimateSquadBoonUptime } from "../lib/axiforge/squadCoverageMath";
import { moveSquadAssignment, type SquadSlotLocation } from "../lib/axiforge/squadAssignments";
import { matchesBuilderLibraryFilters } from "../lib/axiforge/builderLibrary";
import {
  fetchGw2Skills,
  fetchGw2Specializations,
  fetchGw2Traits,
  wikiSearchUrl,
  fetchGw2ProfessionSkillPalette,
  fetchGw2LegendCodes,
} from "../lib/gw2/gw2Api";
import { encodeBuildChatCode, isBuildChatCode, type ChatCodeCatalog } from "../lib/gw2/chatCode";
import { importGw2BuildChatCode, importGw2SkillsBuild, validateGw2SkillsEditorUrl } from "../lib/gw2/gw2SkillsImport";
import {
  availableProfessionSkills,
  availableProfessionWeapons,
  isTerrestrialRangerPet,
  isTwoHandedWeapon,
  loadBuilderFoundationCatalog,
  validateBuilderEquipmentAgainstCatalog,
  validateBuilderSkillsAgainstCatalog,
  weaponFitsBuilderSlot,
  type BuilderCatalogSource,
} from "../lib/gw2/builderCatalog";
import { weaponSkillIds, type WeaponSetNumber } from "../lib/gw2/weaponSkillBar";
import {
  availableRevenantLegends,
  validateRevenantLegendSelection,
} from "../lib/gw2/professionMechanics";
import {
  BUILDER_FOOD_CHOICES,
  BUILDER_RELIC_CHOICES,
  BUILDER_UTILITY_CHOICES,
  BUILDER_RUNE_CHOICES,
  BUILDER_SIGIL_CHOICES,
  BUILDER_ENRICHMENT_CHOICES,
  BUILDER_RELIC_IDS,
  choiceIsCodecSupported,
  equipmentItemIds,
  loadBuilderItemsByIds,
  type BuilderNamedChoice,
} from "../lib/gw2/builderEquipmentCatalog";
import {
  BUILDER_ARMOR_SLOT_ICONS,
  BUILDER_TRINKET_SLOT_ICONS,
  builderWeaponIcon,
} from "../lib/gw2/builderEquipmentVisuals";
import type {
  BuilderComposition,
  BuilderSummaryItem,
  BuilderWorkspace,
  EntropyBuilderState,
  Gw2ApiFact,
  Gw2Item,
  Gw2ItemStat,
  Gw2Legend,
  Gw2Pet,
  Gw2Profession,
  Gw2Skill,
  Gw2SkillSlot,
  Gw2Specialization,
  Gw2Trait,
  SavedBuilderBuild,
} from "../types/buildEditor";
import ClassIcon from "../components/ui/ClassIcon";
import BuildCombatBar from "../components/builder/BuildCombatBar";
import BuildSummaryCard from "../components/builder/BuildSummaryCard";

type WorkbenchTab = "build" | "library" | "squad";
type BuilderSection = "overview" | "traits" | "equipment" | "notes" | "preview";
type EquipmentSection = "weapons" | "armor" | "upgrades" | "consumables";
type MobileRailPanel = "readiness" | "inspector" | "details";
const BUILDER_COMPACT_DETAILS_QUERY = "(max-width: 1180px)";
type Notice = { tone: "success" | "warning" | "error"; message: string };

const GAME_MODES = [
  { id: "wvw", label: "WvW" },
  { id: "pve", label: "PvE" },
  { id: "pvp", label: "PvP" },
] as const;

const ROLE_OPTIONS = ["", "DPS", "Support", "Healer", "Boon Support", "Control", "Roamer", "Commander"];
const QUICK_STAT_OPTIONS = ["Celestial", "Marauder's", "Berserker's", "Minstrel's", "Trailblazer's", "Viper's", "Harrier's", "Ritualist's"];
const ARMOR_SLOT_LABELS: Record<(typeof ARMOR_SLOTS)[number], string> = {
  head: "Head",
  shoulders: "Shoulders",
  chest: "Chest",
  hands: "Hands",
  legs: "Legs",
  feet: "Feet",
};
const BUILDER_FOOD_LABELS = BUILDER_FOOD_CHOICES.map((choice) => choice.label);
const BUILDER_UTILITY_LABELS = BUILDER_UTILITY_CHOICES.map((choice) => choice.label);
const BUILDER_SECTIONS: Array<{ id: BuilderSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "traits", label: "Traits & Skills" },
  { id: "equipment", label: "Equipment" },
  { id: "notes", label: "Notes" },
  { id: "preview", label: "Preview" },
];
const EQUIPMENT_SECTIONS: Array<{ id: EquipmentSection; label: string }> = [
  { id: "weapons", label: "Weapons" },
  { id: "armor", label: "Armor & Trinkets" },
  { id: "upgrades", label: "Upgrades" },
  { id: "consumables", label: "Consumables" },
];
const BUILDER_SECTION_SESSION_KEY = "entropy.builder.section";

function loadBuilderSection(): BuilderSection {
  if (typeof window === "undefined") return "overview";
  const stored = window.sessionStorage.getItem(BUILDER_SECTION_SESSION_KEY);
  return BUILDER_SECTIONS.some((section) => section.id === stored) ? stored as BuilderSection : "overview";
}

function legendLabel(id: string): string {
  return id.replace(/^Legendary/, "").replace(/([a-z])([A-Z])/g, "$1 $2").trim() || id;
}

function factLabel(fact: Gw2ApiFact): string {
  const parts = [fact.text, fact.status, fact.description].filter(Boolean);
  const value = fact.value ?? fact.percent ?? fact.apply_count ?? fact.duration;
  if (value !== undefined) parts.push(String(value));
  return parts.join(" / ");
}

function kindLabel(kind: AxiForgeDecodeResult["kind"]): string {
  if (kind === "build") return "Build code detected";
  if (kind === "comp") return "Squad code detected";
  return "Waiting for Entropy code";
}

function formatInteger(value: number | undefined): string {
  return Math.round(value ?? 0).toLocaleString();
}

function pressureLabel(identity: AttributeProfile["primaryIdentity"]): string {
  if (identity === "strike") return "Strike pressure";
  if (identity === "condition") return "Condition pressure";
  if (identity === "support") return "Support uptime";
  return "Sustain core";
}

function contributionTotal(
  contribution: AttributeProfile["contributions"][number],
  attributes: Gw2Attribute[],
): number {
  return attributes.reduce((total, attribute) => total + (contribution.stats[attribute] ?? 0), 0);
}

function isGw2SkillsInput(value: string): boolean {
  try {
    validateGw2SkillsEditorUrl(value);
    return true;
  } catch {
    return false;
  }
}

function selectedItemIcon(selected: BuilderSummaryItem): string | undefined {
  if (selected.kind === "profession") return selected.item.icon_big ?? selected.item.icon;
  return selected.item.icon;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="theme-builder-label">{children}</span>;
}

function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`theme-builder-input ${props.className ?? ""}`} />;
}

function itemChoiceGroup(label: string): string {
  const value = label.toLowerCase();
  if (/(altruism|dwayna|flock|karakosa|leadership|mercy|monk|transference|water)/.test(value)) return "Support";
  if (/(antitoxin|durability|earth|evasion|melandru|resistance|sanctuary|trooper)/.test(value)) return "Defense";
  if (/(agony|afflicted|krait|nightmare|torment|venom|viper|lich|demon)/.test(value)) return "Condition";
  if (/(fire|fireworks|scholar|strength|force|impact|rage|accuracy|air|bloodlust|eagle)/.test(value)) return "Power";
  if (/(guardian|revenant|warrior|engineer|ranger|thief|elementalist|mesmer|necromancer|herald|firebrand|weaver|druid|scrapper|reaper|scourge|mirage|deadeye|daredevil|dragonhunter|spellbreaker|soulbeast|holosmith|renegade|tempest|chronomancer)/.test(value)) return "Profession";
  return "General";
}

type BuilderPickerChoice = {
  value: string;
  label: string;
  meta?: string;
  icon?: string;
  group?: string;
  disabled?: boolean;
  disabledReason?: string;
};

function moveTabFocus<T extends string>(
  items: readonly T[],
  current: T,
  event: React.KeyboardEvent<HTMLButtonElement>,
  onSelect: (value: T) => void,
  buttonId: (value: T) => string,
) {
  const keyMap: Record<string, number | "first" | "last"> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
    Home: "first",
    End: "last",
  };
  const move = keyMap[event.key];
  if (move === undefined) return;
  event.preventDefault();
  const currentIndex = Math.max(0, items.indexOf(current));
  const nextIndex = move === "first"
    ? 0
    : move === "last"
      ? items.length - 1
      : (currentIndex + move + items.length) % items.length;
  const next = items[nextIndex];
  onSelect(next);
  window.requestAnimationFrame(() => document.getElementById(buttonId(next))?.focus());
}

function providedEffectLabel(fact: Gw2ApiFact): string {
  const details: string[] = [];
  if ((fact.apply_count ?? 1) > 1) details.push(`${fact.apply_count} stacks`);
  if ((fact.duration ?? 0) > 0) details.push(`${fact.duration}s`);
  return details.join(" / ");
}

function itemForNamedChoice(value: string, choices: readonly BuilderNamedChoice[], items: Record<number, Gw2Item>): Gw2Item | undefined {
  const id = choices.find((choice) => choice.label === value)?.id;
  return id ? items[id] : undefined;
}

function EquipmentArtwork({ src, fallback, label }: { src?: string; fallback: React.ReactNode; label: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt="" title={label} onError={() => setFailed(true)} />;
}

function handleModalDialogKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null,
  onClose: () => void,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== "Tab" || !dialog) return;
  const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function useModalScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);
}

function ChoicePickerField({
  id,
  label,
  value,
  choices,
  onChange,
  placeholder,
  clearLabel = "Clear slot",
  disabled = false,
  disabledLabel,
  onPreview,
  emptyIcon,
  triggerAriaLabel,
}: {
  id: string;
  label: string;
  value: string;
  choices: BuilderPickerChoice[];
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel?: string;
  disabled?: boolean;
  disabledLabel?: string;
  onPreview?: (value: string) => void;
  emptyIcon?: React.ReactNode;
  triggerAriaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const selected = choices.find((choice) => choice.value === value);
  const filters = useMemo(() => ["All", ...Array.from(new Set(choices.map((choice) => choice.group).filter(Boolean) as string[])).sort()], [choices]);
  const filteredChoices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return choices.filter((choice) => {
      const haystack = [choice.label, choice.meta, choice.group].filter(Boolean).join(" ").toLowerCase();
      return (filter === "All" || choice.group === filter) && (!needle || haystack.includes(needle));
    });
  }, [choices, filter, query]);

  function closePicker() {
    setOpen(false);
    window.setTimeout(() => document.getElementById(`${id}-trigger`)?.focus(), 0);
  }

  function choose(choice: BuilderPickerChoice) {
    if (choice.disabled) return;
    onChange(choice.value);
    closePicker();
    setQuery("");
  }

  useModalScrollLock(open);

  return (
    <div className="theme-builder-picker-field">
      <FieldLabel>{label}</FieldLabel>
      <button
        id={`${id}-trigger`}
        type="button"
        ref={triggerRef}
        className="theme-builder-picker-trigger"
        onClick={() => !disabled && setOpen(true)}
        onFocus={() => value && onPreview?.(value)}
        onMouseEnter={() => value && onPreview?.(value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-dialog`}
        aria-label={triggerAriaLabel}
        disabled={disabled}
      >
        <span className="theme-builder-picker-icon">
          {selected?.icon ? <img src={selected.icon} alt="" /> : emptyIcon ?? <FileCode2 className="h-4 w-4" aria-hidden="true" />}
        </span>
        <span>
          <strong>{disabled ? (disabledLabel ?? placeholder) : (selected?.label ?? (value || placeholder))}</strong>
          {(selected?.meta ?? selected?.group) && <small>{selected?.meta ?? selected?.group}</small>}
        </span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="theme-builder-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}>
          <section ref={dialogRef} id={`${id}-dialog`} className="theme-builder-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={(event) => handleModalDialogKeyDown(event, dialogRef.current, closePicker)}>
            <div className="theme-builder-picker-head">
              <div><div className="theme-builder-kicker">Builder picker</div><h3 id={`${id}-title`}>{label}</h3></div>
              <button type="button" onClick={closePicker} aria-label="Close picker"><X className="h-4 w-4" /></button>
            </div>
            <div className="theme-builder-picker-search">
              <Search className="h-4 w-4" aria-hidden="true" />
              <TextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`} aria-label={`Search ${label} choices`} autoFocus />
            </div>
            {filters.length > 1 && (
              <div className="theme-builder-picker-filters" role="group" aria-label={`${label} filters`}>
                {filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? "is-active" : undefined} onClick={() => setFilter(item)}>{item}</button>)}
              </div>
            )}
            <div className="theme-builder-picker-list">
              <button type="button" aria-pressed={!value} className={!value ? "is-active" : undefined} onClick={() => { onChange(""); closePicker(); }}>
                <span className="theme-builder-picker-icon"><Eraser className="h-4 w-4" aria-hidden="true" /></span>
                <span><strong>{clearLabel}</strong><small>Use default or leave empty</small></span>
              </button>
              {filteredChoices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={choice.value === value}
                  className={choice.value === value ? "is-active" : undefined}
                  disabled={choice.disabled}
                  title={choice.disabledReason ?? choice.label}
                  onClick={() => choose(choice)}
                  onFocus={() => onPreview?.(choice.value)}
                  onMouseEnter={() => onPreview?.(choice.value)}
                >
                  <span className="theme-builder-picker-icon">{choice.icon ? <img src={choice.icon} alt="" /> : <FileCode2 className="h-4 w-4" aria-hidden="true" />}</span>
                  <span><strong>{choice.label}</strong><small>{choice.disabledReason ?? choice.meta ?? choice.group ?? "Available"}</small></span>
                </button>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ItemPickerField({
  id,
  label,
  value,
  valueKind,
  choices,
  onChange,
  placeholder,
  items,
}: {
  id: string;
  label: string;
  value: string;
  valueKind: "id" | "label";
  choices: readonly BuilderNamedChoice[];
  onChange: (value: string) => void;
  placeholder: string;
  items: Record<number, Gw2Item>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [choiceItems, setChoiceItems] = useState<Record<number, Gw2Item>>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const byId = useMemo(() => new Map(choices.filter((choice) => choice.id != null).map((choice) => [String(choice.id), choice.label])), [choices]);
  const selectedChoice = valueKind === "id"
    ? choices.find((choice) => String(choice.id) === value)
    : choices.find((choice) => choice.label === value);
  const selectedId = selectedChoice?.id ?? (valueKind === "id" ? Number(value) || 0 : 0);
  const selectedItem = selectedId ? (choiceItems[selectedId] ?? items[selectedId]) : null;
  const displayValue = value ? (selectedChoice?.label ?? selectedItem?.name ?? (valueKind === "id" ? byId.get(value) ?? "Unavailable imported item" : value)) : "";
  const resolved = !value || Boolean(selectedChoice) || (valueKind === "id" && byId.has(value));
  const enrichedItems = { ...items, ...choiceItems };
  const filters = useMemo(() => ["All", ...Array.from(new Set(choices.map((choice) => itemChoiceGroup(choice.label)))).sort()], [choices]);
  const filteredChoices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return choices.filter((choice) => {
      const group = itemChoiceGroup(choice.label);
      const item = choice.id ? enrichedItems[choice.id] : null;
      const haystack = [choice.label, group, item?.type, item?.subtype, item?.description].filter(Boolean).join(" ").toLowerCase();
      return (filter === "All" || group === filter) && (!needle || haystack.includes(needle));
    });
  }, [choices, enrichedItems, filter, query]);

  useEffect(() => {
    if (!open) return;
    const ids = choices.flatMap((choice) => choice.id ? [choice.id] : []);
    let cancelled = false;
    loadBuilderItemsByIds(ids).then((loaded) => {
      if (!cancelled) setChoiceItems((current) => ({ ...current, ...loaded }));
    });
    return () => { cancelled = true; };
  }, [choices, open]);

  function closePicker() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(choice: BuilderNamedChoice) {
    onChange(valueKind === "id" ? String(choice.id ?? "") : choice.label);
    closePicker();
    setQuery("");
  }

  useModalScrollLock(open);

  return (
    <div className="theme-builder-picker-field">
      <FieldLabel>{label}</FieldLabel>
      <button
        id={`${id}-trigger`}
        type="button"
        ref={triggerRef}
        className="theme-builder-picker-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-dialog`}
      >
        <span className="theme-builder-picker-icon">
          {selectedItem?.icon ? <img src={selectedItem.icon} alt="" /> : <FileCode2 className="h-4 w-4" aria-hidden="true" />}
        </span>
        <span>
          <strong>{displayValue || placeholder}</strong>
          {displayValue && <small>{itemChoiceGroup(displayValue)}</small>}
        </span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
      {!resolved && <span className="theme-builder-choice-note"><AlertCircle className="h-3.5 w-3.5" /> Imported item is not in the curated catalog.</span>}
      {open && createPortal(
        <div className="theme-builder-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}>
          <section ref={dialogRef} id={`${id}-dialog`} className="theme-builder-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={(event) => handleModalDialogKeyDown(event, dialogRef.current, closePicker)}>
            <div className="theme-builder-picker-head">
              <div><div className="theme-builder-kicker">Equipment picker</div><h3 id={`${id}-title`}>{label}</h3></div>
              <button type="button" onClick={closePicker} aria-label="Close picker"><X className="h-4 w-4" /></button>
            </div>
            <div className="theme-builder-picker-search">
              <Search className="h-4 w-4" aria-hidden="true" />
              <TextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label} choices`} aria-label={`Search ${label} choices`} autoFocus />
            </div>
            <div className="theme-builder-picker-filters" role="group" aria-label={`${label} filters`}>
              {filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? "is-active" : undefined} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
            <div className="theme-builder-picker-list">
              <button type="button" aria-pressed={!value} className={!value ? "is-active" : undefined} onClick={() => { onChange(""); closePicker(); }}>
                <span className="theme-builder-picker-icon"><Eraser className="h-4 w-4" aria-hidden="true" /></span>
                <span><strong>Clear slot</strong><small>Use no {label.toLowerCase()}</small></span>
              </button>
              {filteredChoices.map((choice) => {
                const item = choice.id ? enrichedItems[choice.id] : null;
                const active = selectedChoice?.label === choice.label;
                return (
                  <button key={choice.label} type="button" aria-pressed={active} className={active ? "is-active" : undefined} onClick={() => choose(choice)}>
                    <span className="theme-builder-picker-icon">{item?.icon ? <img src={item.icon} alt="" /> : <FileCode2 className="h-4 w-4" aria-hidden="true" />}</span>
                    <span><strong>{item?.name ?? choice.label}</strong><small>{itemChoiceGroup(choice.label)}</small></span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

function resolveEliteSpecName(
  specializationIds: (number | null | undefined)[] | undefined,
  specsById: Map<number, Gw2Specialization>,
  fallback: string,
): string {
  if (!specializationIds || !specsById.size) return fallback;
  for (const id of specializationIds) {
    if (id == null) continue;
    const spec = specsById.get(id);
    if (spec?.elite) return spec.name;
  }
  return fallback;
}

function BuilderReadiness({ issues, embedded = false }: { issues: string[]; embedded?: boolean }) {
  const score = Math.max(0, 6 - issues.length);
  return (
    <div className={`theme-builder-readiness${embedded ? " is-embedded" : ""}`}>
      <div className="theme-builder-kicker">Readiness</div>
      <div className="theme-builder-readiness-score"><strong>{score}</strong><span>/ 6</span></div>
      <div className="theme-builder-progress"><i style={{ width: `${score / 6 * 100}%` }} /></div>
      {issues.length ? (
        <ul>{issues.map((issue) => <li key={issue}><ChevronRight className="h-3.5 w-3.5" />{issue}</li>)}</ul>
      ) : (
        <p className="is-ready"><Check className="h-4 w-4" /> Build is ready to archive.</p>
      )}
    </div>
  );
}

function BuilderAdvancedData({ builder }: { builder: EntropyBuilderState }) {
  return (
    <details className="theme-builder-advanced-data">
      <summary><Wrench className="h-3.5 w-3.5" /> Advanced build data</summary>
      <pre>{JSON.stringify(builder, null, 2)}</pre>
    </details>
  );
}

function DetailPanel({ selected, builder, embedded = false, showAdvanced = true }: { selected: BuilderSummaryItem | null; builder: EntropyBuilderState; embedded?: boolean; showAdvanced?: boolean }) {
  const className = `theme-builder-inspector${embedded ? " is-embedded" : ""}`;
  if (!selected) {
    return (
      <aside className={className}>
        <div className="theme-builder-kicker"><BookOpen className="h-4 w-4" /> Field manual</div>
        <h3>Inspect the loadout</h3>
        <p>Focus a profession, specialization, trait, or skill to read its live Guild Wars 2 details here.</p>
        {showAdvanced && <BuilderAdvancedData builder={builder} />}
      </aside>
    );
  }

  const item = selected.item;
  const facts = "facts" in item ? item.facts ?? [] : [];
  const enrichedFacts = selected.kind === "skill" || selected.kind === "trait"
    ? enrichedFactsForEntity(selected.item, builder.gameMode)
    : facts;
  const providedEffects = selected.kind === "skill" || selected.kind === "trait"
    ? enrichedFacts.filter(isProvidedEffectFact)
    : [];
  const providedStatuses = new Set(providedEffects.map((fact) => fact.status));
  const combatFacts = enrichedFacts.filter((fact) => !fact.status || !providedStatuses.has(fact.status));
  const description = "description" in item ? item.description : "";

  return (
    <aside className={className}>
      <div className="flex items-start gap-3">
        <div className="theme-builder-inspector-icon">
          {selectedItemIcon(selected) ? <img src={selectedItemIcon(selected)} alt="" /> : <Sparkles className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <div className="theme-builder-kicker">{selected.kind}</div>
          <h3>{item.name}</h3>
        </div>
      </div>
      {description && <p className="whitespace-pre-line">{description}</p>}
      {providedEffects.length > 0 && (
        <div className="theme-builder-provided-effects">
          <FieldLabel>Provides</FieldLabel>
          <div className="theme-builder-provided-effects-grid">
            {providedEffects.map((fact, index) => (
              <div key={`${fact.status ?? "effect"}-${index}`} className="theme-builder-provided-effect">
                {fact.icon || fallbackConditionIcon(fact.status ?? "")
                  ? <img src={fact.icon ?? fallbackConditionIcon(fact.status ?? "")} alt="" />
                  : <Sparkles className="h-4 w-4" />}
                <span>
                  <strong>{fact.status}</strong>
                  {providedEffectLabel(fact) && <small>{providedEffectLabel(fact)}</small>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {combatFacts.length > 0 && (
        <div className="mt-4 space-y-2">
          <FieldLabel>Combat facts</FieldLabel>
          {combatFacts.slice(0, 8).map((fact, index) => (
            <div key={`${fact.type ?? "fact"}-${index}`} className="theme-builder-fact">
              {fact.icon && <img src={fact.icon} alt="" />}
              <span>{factLabel(fact) || fact.type || "Effect"}</span>
            </div>
          ))}
        </div>
      )}
      <a href={wikiSearchUrl(item.name)} target="_blank" rel="noreferrer" className="theme-builder-link">
        Open wiki <ExternalLink className="h-3.5 w-3.5" />
      </a>
      {showAdvanced && <BuilderAdvancedData builder={builder} />}
    </aside>
  );
}

function BuilderMobileTools({
  issues,
  selected,
  builder,
  openPanel,
  setOpenPanel,
  returnFocusRef,
}: {
  issues: string[];
  selected: BuilderSummaryItem | null;
  builder: EntropyBuilderState;
  openPanel: MobileRailPanel | null;
  setOpenPanel: React.Dispatch<React.SetStateAction<MobileRailPanel | null>>;
  returnFocusRef: React.MutableRefObject<HTMLButtonElement | null>;
}) {
  const readinessButtonRef = useRef<HTMLButtonElement>(null);
  const inspectorButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const score = Math.max(0, 6 - issues.length);

  const showPanel = (panel: MobileRailPanel, trigger: HTMLButtonElement | null) => {
    returnFocusRef.current = trigger;
    setOpenPanel(panel);
  };
  const closePanel = () => setOpenPanel(null);
  const sheetTitle = openPanel === "readiness" ? "Build readiness" : openPanel === "inspector" ? "Loadout inspector" : "Builder details";

  const handleSheetKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div className="theme-builder-mobile-tools" aria-label="Builder details">
        <button
          ref={readinessButtonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={openPanel === "readiness"}
          onClick={() => showPanel("readiness", readinessButtonRef.current)}
        >
          {issues.length
            ? <AlertCircle className="h-4 w-4" aria-hidden="true" />
            : <Check className="h-4 w-4" aria-hidden="true" />}
          <span>Readiness</span>
          <strong>{score}/6</strong>
        </button>
        <button
          ref={inspectorButtonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={openPanel === "inspector"}
          onClick={() => showPanel("inspector", inspectorButtonRef.current)}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span>Inspector</span>
          <strong>{selected?.item.name ?? "No selection"}</strong>
        </button>
      </div>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence onExitComplete={() => { if (returnFocusRef.current?.offsetParent) returnFocusRef.current.focus(); returnFocusRef.current = null; }}>
          {openPanel && (
            <motion.div
              key="builder-mobile-sheet"
              className="theme-builder-mobile-sheet-backdrop"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.16 }}
              onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}
              onKeyDown={handleSheetKeyDown}
            >
              <motion.section
                role="dialog"
                aria-modal="true"
                aria-labelledby="builder-mobile-sheet-title"
                className="theme-builder-mobile-sheet"
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <header>
                  <div><div className="theme-builder-kicker">Builder details</div><h2 id="builder-mobile-sheet-title">{sheetTitle}</h2></div>
                  <button type="button" autoFocus onClick={closePanel} aria-label={`Close ${sheetTitle}`} title="Close"><X className="h-4 w-4" /></button>
                </header>
                <div className="theme-builder-mobile-sheet-content">
                  {openPanel === "readiness" ? (
                    <BuilderReadiness issues={issues} embedded />
                  ) : openPanel === "inspector" ? (
                    <DetailPanel selected={selected} builder={builder} embedded />
                  ) : (
                    <div className="theme-builder-compact-details">
                      <BuilderReadiness issues={issues} embedded />
                      <DetailPanel selected={selected} builder={builder} embedded />
                    </div>
                  )}
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function SkillPicker({
  label,
  slot,
  selectedId,
  skills,
  allSkills,
  usedIds,
  onChange,
  onInspect,
}: {
  label: string;
  slot: Gw2SkillSlot;
  selectedId: number | null;
  skills: Gw2Skill[];
  allSkills: Gw2Skill[];
  usedIds: Array<number | null>;
  onChange: (id: number | null) => void;
  onInspect: (skill: Gw2Skill) => void;
}) {
  const selected = allSkills.find((skill) => skill.id === selectedId) ?? null;
  const options = skills.filter((skill) => skill.slot === slot && (!usedIds.includes(skill.id) || skill.id === selectedId));
  const selectedIsUnavailable = Boolean(selected && !options.some((skill) => skill.id === selected.id));

  return (
    <div className="theme-builder-skill-slot">
      <ChoicePickerField
        id={`builder-skill-${label.toLowerCase().replaceAll(/\W+/g, "-")}`}
        label={label}
        value={selectedId ? String(selectedId) : ""}
        choices={[
          ...(selectedIsUnavailable && selected ? [{
            value: String(selected.id),
            label: selected.name,
            icon: selected.icon,
            group: "Unavailable",
            meta: "Not available to the selected specializations",
            disabled: true,
            disabledReason: "Not available to the selected specializations",
          }] : []),
          ...options.map((skill) => ({
          value: String(skill.id),
          label: skill.name,
          icon: skill.icon,
          group: skill.type ?? skill.slot,
          meta: skill.description ? skill.description.replaceAll(/<[^>]+>/g, " ").replaceAll(/\s+/g, " ").trim() : skill.type ?? skill.slot,
          })),
        ]}
        onChange={(value) => onChange(value ? Number(value) : null)}
        onPreview={(value) => {
          const skill = options.find((item) => String(item.id) === value);
          if (skill) onInspect(skill);
        }}
        emptyIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        placeholder={`Choose ${label.toLowerCase()}`}
        clearLabel={`Clear ${label}`}
      />
    </div>
  );
}

function BuildLibrary({
  builds,
  onLoad,
  onDuplicate,
  onDelete,
  onCopy,
  onShare,
  specsById,
}: {
  builds: SavedBuilderBuild[];
  onLoad: (build: SavedBuilderBuild) => void;
  onDuplicate: (build: SavedBuilderBuild) => void;
  onDelete: (id: string) => void;
  onCopy: (code: string) => void;
  onShare: (code: string) => void;
  specsById: Map<number, Gw2Specialization>;
}) {
  const [query, setQuery] = useState("");
  const [professionFilter, setProfessionFilter] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const professionOptions = useMemo(() => [...new Set(builds.map((build) => build.state.professionId).filter(Boolean))].sort(), [builds]);
  const specializationOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const build of builds) {
      for (const id of build.state.specializationIds) {
        const specialization = id ? specsById.get(id) : null;
        if (specialization) options.set(String(specialization.id), specialization.name);
      }
    }
    return [...options].sort((left, right) => left[1].localeCompare(right[1]));
  }, [builds, specsById]);
  const roleOptions = useMemo(() => [...new Set(builds.map((build) => build.state.role).filter(Boolean))].sort(), [builds]);
  const modeOptions = useMemo(() => [...new Set(builds.map((build) => build.state.gameMode))].sort(), [builds]);
  const tagOptions = useMemo(() => [...new Set(builds.flatMap((build) => build.state.tags).filter(Boolean))].sort(), [builds]);
  const hasFilters = Boolean(normalizedQuery || professionFilter || specializationFilter || roleFilter || modeFilter || tagFilter);
  const filtered = builds.filter((build) => matchesBuilderLibraryFilters(build, {
    query: normalizedQuery,
    profession: professionFilter,
    specialization: specializationFilter,
    role: roleFilter,
    mode: modeFilter,
    tag: tagFilter,
  }, specsById));
  const clearFilters = () => {
    setQuery("");
    setProfessionFilter("");
    setSpecializationFilter("");
    setRoleFilter("");
    setModeFilter("");
    setTagFilter("");
  };

  return (
    <section className="theme-builder-workspace theme-builder-library-workspace">
      <div className="theme-builder-section-head">
        <div><div className="theme-builder-kicker">Local doctrine</div><h3>Build library</h3></div>
        <div className="theme-builder-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input aria-label="Search builds" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search builds" />
          {query && <button type="button" onClick={() => setQuery("")} title="Clear search" aria-label="Clear build search"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      {builds.length > 0 && (
        <div className="theme-builder-library-filters" aria-label="Filter saved builds">
          <ListFilter className="h-4 w-4" aria-hidden="true" />
          <label><span className="sr-only">Profession</span><select value={professionFilter} onChange={(event) => setProfessionFilter(event.target.value)}><option value="">All professions</option>{professionOptions.map((profession) => <option key={profession} value={profession}>{profession}</option>)}</select></label>
          <label><span className="sr-only">Specialization</span><select value={specializationFilter} onChange={(event) => setSpecializationFilter(event.target.value)}><option value="">All specializations</option>{specializationOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label><span className="sr-only">Role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All roles</option>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <label><span className="sr-only">Game mode</span><select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}><option value="">All modes</option>{modeOptions.map((mode) => <option key={mode} value={mode}>{mode.toUpperCase()}</option>)}</select></label>
          <label><span className="sr-only">Tag</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="">All tags</option>{tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
          <span className="theme-builder-library-result-count">{filtered.length}/{builds.length}</span>
          {hasFilters && <button type="button" onClick={clearFilters} title="Clear library filters" aria-label="Clear all library filters"><X className="h-3.5 w-3.5" /></button>}
        </div>
      )}
      {builds.length === 0 ? (
        <div className="theme-builder-empty"><Archive className="h-7 w-7" /><strong>No saved builds</strong><span>Save a complete build or an unfinished draft to establish the library.</span></div>
      ) : filtered.length === 0 ? (
        <div className="theme-builder-empty is-compact">
          <Search className="h-7 w-7" />
          <strong>No matching builds</strong>
          <span>No saved build matches &quot;{query.trim()}&quot;.</span>
          <button type="button" className="theme-command-button" onClick={clearFilters}><X className="h-4 w-4" /> Clear filters</button>
        </div>
      ) : (
        <div className="theme-builder-library-list">
          {filtered.map((build, index) => (
            <BuildSummaryCard
              key={build.id}
              build={build}
              index={index}
              onOpen={onLoad}
              onDuplicate={onDuplicate}
              onDelete={(id) => {
                onDelete(id);
                setPendingDeleteId(null);
              }}
              deletePending={pendingDeleteId === build.id}
              onRequestDelete={setPendingDeleteId}
              onCancelDelete={() => setPendingDeleteId(null)}
              onCopy={onCopy}
              onShare={onShare}
              draggable
              specsById={specsById}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SquadSlotPicker({
  id,
  slotLabel,
  builds,
  onAssign,
}: {
  id: string;
  slotLabel: string;
  builds: SavedBuilderBuild[];
  onAssign: (buildId: string | null) => void;
}) {
  const choices = useMemo(() => builds.map((build) => ({
    value: build.id,
    label: build.name,
    meta: [build.state.professionId, build.state.role].filter(Boolean).join(" / "),
    group: build.state.professionId || undefined,
  })), [builds]);

  return (
    <div className="theme-builder-squad-picker">
      <ChoicePickerField
        id={id}
        label="Open slot"
        value=""
        choices={choices}
        onChange={(value) => onAssign(value || null)}
        placeholder="Assign build"
        clearLabel="Leave empty"
        triggerAriaLabel={`Assign a saved build to ${slotLabel}`}
      />
    </div>
  );
}

function boonCacheKey(build: SavedBuilderBuild): string {
  return `${build.id}:${build.updatedAt}`;
}

function conditionCacheKey(build: SavedBuilderBuild): string {
  return `${build.id}:${build.updatedAt}`;
}

function utilityCacheKey(build: SavedBuilderBuild): string {
  return `${build.id}:${build.updatedAt}`;
}

interface CoverageDetailSource {
  sourceName: string;
  type: "skill" | "trait";
  icon?: string;
  stacks?: number;
  duration?: number;
  recharge?: number;
  estimatedUptimePercent?: number;
}

interface CoverageDetailProvider {
  buildName: string;
  profession: string;
  partyId?: string;
  partyName?: string;
  slotIndex?: number;
  sources: CoverageDetailSource[];
  estimatedUptimePercent?: number;
}

interface CoverageBreakdown {
  category: string;
  name: string;
  icon?: string;
  estimatedUptimePercent?: number;
  providers: CoverageDetailProvider[];
}

function CoverageBreakdownDialog({ detail, onClose }: { detail: CoverageBreakdown; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useModalScrollLock(true);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const groupedProviders = new Map<string, CoverageDetailProvider & { copies: number }>();
  for (const provider of detail.providers) {
    const sourceKey = provider.sources.map((source) => `${source.type}:${source.sourceName}`).sort().join("|");
    const key = `${provider.partyId ?? "squad"}:${provider.buildName}:${provider.profession}:${sourceKey}`;
    const existing = groupedProviders.get(key);
    if (existing) existing.copies += 1;
    else groupedProviders.set(key, { ...provider, copies: 1 });
  }

  return createPortal(
    <div className="theme-builder-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={dialogRef}
        className="theme-builder-picker-dialog theme-builder-coverage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coverage-breakdown-title"
        tabIndex={-1}
        onKeyDown={(event) => handleModalDialogKeyDown(event, dialogRef.current, onClose)}
      >
        <div className="theme-builder-picker-head theme-builder-coverage-dialog-head">
          <div className="theme-builder-coverage-dialog-title">
            <span>{detail.icon ? <img src={detail.icon} alt="" /> : <Sparkles className="h-5 w-5" />}</span>
            <div><div className="theme-builder-kicker">{detail.category} breakdown</div><h3 id="coverage-breakdown-title">{detail.name}</h3></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close coverage breakdown"><X className="h-4 w-4" /></button>
        </div>
        {detail.estimatedUptimePercent != null && (
          <div className="theme-builder-coverage-summary"><strong>~{Math.round(detail.estimatedUptimePercent)}%</strong><span>estimated squad uptime</span></div>
        )}
        <div className="theme-builder-coverage-provider-list">
          {[...groupedProviders.values()].map((provider) => (
            <section key={`${provider.partyId ?? "squad"}:${provider.buildName}:${provider.profession}:${provider.sources.map(({ sourceName }) => sourceName).join("|")}`}>
              <header>
                <ClassIcon name={provider.profession} size="sm" />
                <span><strong>{provider.buildName}</strong><small>{[provider.profession, provider.partyName, provider.copies > 1 ? `${provider.copies} slots` : provider.slotIndex != null ? `slot ${provider.slotIndex + 1}` : null].filter(Boolean).join(" · ")}</small></span>
                {provider.estimatedUptimePercent != null && <em>~{Math.round(provider.estimatedUptimePercent)}%</em>}
              </header>
              <div>
                {provider.sources.map((source) => {
                  const facts = [
                    source.stacks && source.stacks > 1 ? `${source.stacks} stacks` : null,
                    source.duration ? `${source.duration}s duration` : null,
                    source.recharge ? `${source.recharge}s recharge` : null,
                    source.estimatedUptimePercent != null ? `~${Math.round(source.estimatedUptimePercent)}% uptime` : null,
                  ].filter(Boolean);
                  return (
                    <article key={`${source.type}:${source.sourceName}`}>
                      <span>{source.icon ? <img src={source.icon} alt="" /> : source.type === "trait" ? <Layers3 className="h-4 w-4" /> : <Swords className="h-4 w-4" />}</span>
                      <div><strong>{source.sourceName}</strong><small>{source.type}{facts.length ? ` · ${facts.join(" · ")}` : ""}</small></div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function SquadBoonCoverage({
  composition,
  builds,
  boonCache,
  computing,
}: {
  composition: BuilderComposition;
  builds: SavedBuilderBuild[];
  boonCache: Record<string, BoonCoverageEntry[]>;
  computing: boolean;
}) {
  const [selectedCoverage, setSelectedCoverage] = useState<CoverageBreakdown | null>(null);
  const providers = useMemo(() => {
    const map = new Map<
      string,
      { icon?: string; sources: CoverageDetailProvider[] }
    >();
    for (const party of composition.parties) {
      for (const [slotIndex, buildId] of party.slots.entries()) {
        if (!buildId) continue;
        const build = builds.find((item) => item.id === buildId);
        if (!build) continue;
        const coverage = boonCache[boonCacheKey(build)];
        if (!coverage) continue;
        for (const entry of coverage) {
          if (!entry.hasAllySource) continue;
          const existing = map.get(entry.name) ?? { icon: entry.icon, sources: [] }; if (!existing.icon && entry.icon) existing.icon = entry.icon;
          existing.sources.push({
            buildName: build.name,
            profession: build.state.professionId,
            partyId: party.id,
            partyName: party.name,
            slotIndex,
            sources: entry.sources.filter((source) => source.isAlly).map((source) => ({ ...source })),
            estimatedUptimePercent: entry.estimatedUptimePercent,
          });
          map.set(entry.name, existing);
        }
      }
    }
    return map;
  }, [composition, builds, boonCache]);
  const coveredBoons = BOON_DISPLAY_ORDER.filter((boon) => (providers.get(boon)?.sources.length ?? 0) > 0);
  const missingBoons = BOON_DISPLAY_ORDER.filter((boon) => !coveredBoons.includes(boon));

  return (
    <section className="theme-builder-boon-coverage theme-builder-coverage-disclosure">
      <div className="theme-builder-section-head">
        <div><div className="theme-builder-kicker">Live from assigned squad slots</div><h3>Squad boon coverage</h3></div>
        {computing && <Loader2 className="h-4 w-4 animate-spin" aria-label="Updating boon coverage" />}
      </div>
      <div className="theme-builder-boon-grid" role="group" aria-label="Detected squad boon coverage">
        {coveredBoons.map((boon) => {
          const entry = providers.get(boon); const list = entry?.sources ?? [];
          const covered = list.length > 0;
          const bestUptime = estimateSquadBoonUptime(
            composition.parties,
            list.filter((source): source is CoverageDetailProvider & { partyId: string } => Boolean(source.partyId)),
          );
          const tooltip = `Open ${boon} provider breakdown`;
          return (
            <button
              key={boon}
              type="button"
              className="is-covered"
              title={tooltip}
              aria-label={tooltip}
              onClick={() => setSelectedCoverage({
                category: "Squad boon",
                name: boon,
                icon: entry?.icon,
                estimatedUptimePercent: bestUptime,
                providers: list,
              })}
            >
              <div className="theme-builder-boon-icon">{entry?.icon ? <img src={entry.icon} alt="" /> : <Sparkles className="h-5 w-5" />}{covered && <em>{list.length}</em>}</div>
              <span>{boon}</span>
              {bestUptime != null && <span className="theme-builder-boon-uptime">~{Math.round(bestUptime)}%</span>}
            </button>
          );
        })}
      </div>
      <p className="theme-builder-coverage-missing"><strong>Missing</strong><span>{missingBoons.length ? missingBoons.join(" · ") : "None"}</span></p>
      {selectedCoverage && <CoverageBreakdownDialog detail={selectedCoverage} onClose={() => setSelectedCoverage(null)} />}
    </section>
  );
}

function SquadConditionCoverage({
  composition,
  builds,
  conditionCache,
  computing,
}: {
  composition: BuilderComposition;
  builds: SavedBuilderBuild[];
  conditionCache: Record<string, BuilderConditionEntry[]>;
  computing: boolean;
}) {
  const [selectedCoverage, setSelectedCoverage] = useState<CoverageBreakdown | null>(null);
  const providers = useMemo(() => {
    const map = new Map<
      string,
      { icon?: string; sources: CoverageDetailProvider[] }
    >();
    const referenced = composition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id));
    for (const buildId of referenced) {
      const build = builds.find((item) => item.id === buildId);
      if (!build) continue;
      const coverage = conditionCache[conditionCacheKey(build)];
      if (!coverage) continue;
      for (const entry of coverage) {
        const existing = map.get(entry.name) ?? { icon: entry.icon, sources: [] };
        if (!existing.icon && entry.icon) existing.icon = entry.icon;
        existing.sources.push({
          buildName: build.name,
          profession: build.state.professionId,
          sources: entry.sources.map((source) => ({ ...source })),
          estimatedUptimePercent: entry.estimatedUptimePercent,
        });
        map.set(entry.name, existing);
      }
    }
    return map;
  }, [composition, builds, conditionCache]);
  const coveredConditions = BUILDER_CONDITION_DISPLAY_ORDER.filter((condition) => (providers.get(condition)?.sources.length ?? 0) > 0);
  const missingConditions = BUILDER_CONDITION_DISPLAY_ORDER.filter((condition) => !coveredConditions.includes(condition));

  return (
    <section className="theme-builder-boon-coverage theme-builder-condition-coverage theme-builder-coverage-disclosure">
      <div className="theme-builder-section-head">
        <div><div className="theme-builder-kicker">Detected from assigned skills and traits</div><h3>Squad condition access</h3></div>
        {computing && <Loader2 className="h-4 w-4 animate-spin" aria-label="Updating condition access" />}
      </div>
      <div className="theme-builder-boon-grid theme-builder-condition-grid" role="group" aria-label="Detected squad condition access">
        {coveredConditions.map((condition) => {
          const entry = providers.get(condition); const list = entry?.sources ?? [];
          const covered = list.length > 0;
          const squadUptime = list.reduce<number | undefined>(
            (sum, source) =>
              source.estimatedUptimePercent != null
                ? Math.min(100, (sum ?? 0) + source.estimatedUptimePercent)
                : sum,
            undefined,
          );
          const tooltip = `Open ${condition} source breakdown`;
          return (
            <button
              key={condition}
              type="button"
              className="is-covered"
              title={tooltip}
              aria-label={tooltip}
              onClick={() => setSelectedCoverage({
                category: "Squad condition",
                name: condition,
                icon: entry?.icon,
                estimatedUptimePercent: squadUptime,
                providers: list,
              })}
            >
              <div className="theme-builder-boon-icon">{entry?.icon ? <img src={entry.icon} alt="" /> : <Sparkles className="h-5 w-5" />}{covered && <em>{list.length}</em>}</div>
              <span>{condition}</span>
              {squadUptime != null && <span className="theme-builder-boon-uptime">~{Math.round(squadUptime)}%</span>}
            </button>
          );
        })}
      </div>
      <p className="theme-builder-coverage-missing"><strong>Missing</strong><span>{missingConditions.length ? missingConditions.join(" · ") : "None"}</span></p>
      {selectedCoverage && <CoverageBreakdownDialog detail={selectedCoverage} onClose={() => setSelectedCoverage(null)} />}
    </section>
  );
}

type SquadMoveSource = SquadSlotLocation & { buildId: string };
const SQUAD_SLOT_DRAG_TYPE = "application/x-entropy-squad-slot";

function SquadMoveDialog({
  source,
  composition,
  builds,
  onMove,
  onClose,
}: {
  source: SquadMoveSource;
  composition: BuilderComposition;
  builds: SavedBuilderBuild[];
  onMove: (target: SquadSlotLocation) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const build = builds.find((item) => item.id === source.buildId);
  const sourcePartyIndex = composition.parties.findIndex((party) => party.id === source.partyId);

  useModalScrollLock(true);

  return createPortal(
    <div className="theme-builder-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={dialogRef}
        className="theme-builder-picker-dialog theme-builder-squad-move-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="squad-move-title"
        onKeyDown={(event) => handleModalDialogKeyDown(event, dialogRef.current, onClose)}
      >
        <div className="theme-builder-picker-head">
          <div>
            <div className="theme-builder-kicker">Squad placement</div>
            <h3 id="squad-move-title">Move {build?.name ?? "assignment"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close move assignment dialog"><X className="h-4 w-4" /></button>
        </div>
        <p className="theme-builder-squad-move-summary">
          Currently in subgroup {sourcePartyIndex + 1}, slot {source.slotIndex + 1}. Choosing an occupied slot swaps the two assignments.
        </p>
        <div className="theme-builder-squad-move-list">
          {composition.parties.flatMap((party, partyIndex) => party.slots.map((buildId, slotIndex) => {
            const isSource = party.id === source.partyId && slotIndex === source.slotIndex;
            const occupant = builds.find((item) => item.id === buildId);
            return (
              <button
                key={`${party.id}:${slotIndex}`}
                type="button"
                disabled={isSource}
                autoFocus={!isSource && partyIndex === 0 && slotIndex === (sourcePartyIndex === 0 && source.slotIndex === 0 ? 1 : 0)}
                onClick={() => onMove({ partyId: party.id, slotIndex })}
              >
                <span>{String(partyIndex + 1).padStart(2, "0")}.{slotIndex + 1}</span>
                <span>
                  <strong>{party.name} / Slot {slotIndex + 1}</strong>
                  <small>{isSource ? "Current slot" : occupant ? `Swap with ${occupant.name}` : "Open slot"}</small>
                </span>
                {occupant ? <ClassIcon name={occupant.state.professionId} size="sm" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              </button>
            );
          }))}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function SquadUtilityCoverage({
  composition,
  builds,
  utilityCache,
  computing,
}: {
  composition: BuilderComposition;
  builds: SavedBuilderBuild[];
  utilityCache: Record<string, BuildUtilityEntry[]>;
  computing: boolean;
}) {
  const [selectedCoverage, setSelectedCoverage] = useState<CoverageBreakdown | null>(null);
  const providers = useMemo(() => {
    const map = new Map<string, {
      label: string;
      icon?: string;
      sources: CoverageDetailProvider[];
    }>();
    const referenced = composition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id));
    for (const buildId of referenced) {
      const build = builds.find((item) => item.id === buildId);
      if (!build) continue;
      for (const entry of utilityCache[utilityCacheKey(build)] ?? []) {
        const existing = map.get(entry.kind) ?? { label: entry.label, icon: entry.icon, sources: [] };
        if (!existing.icon && entry.icon) existing.icon = entry.icon;
        existing.sources.push({
          buildName: build.name,
          profession: build.state.professionId,
          sources: entry.sources.map((source) => ({ ...source })),
        });
        map.set(entry.kind, existing);
      }
    }
    return map;
  }, [builds, composition, utilityCache]);
  const coveredUtilities = BUILD_UTILITY_ORDER.filter((kind) => providers.has(kind));
  const missingUtilities = BUILD_UTILITY_ORDER.filter((kind) => !providers.has(kind));

  return (
    <section className="theme-builder-boon-coverage theme-builder-utility-coverage theme-builder-coverage-disclosure">
      <div className="theme-builder-section-head">
        <div><div className="theme-builder-kicker">Resolved from each complete combat kit</div><h3>Squad utility access</h3></div>
        {computing && <Loader2 className="h-4 w-4 animate-spin" aria-label="Updating utility access" />}
      </div>
      <div className="theme-builder-boon-grid theme-builder-utility-grid" role="group" aria-label="Detected squad utility access">
        {coveredUtilities.map((kind) => {
          const entry = providers.get(kind)!;
          const tooltip = `Open ${entry.label} source breakdown`;
          return (
            <button
              key={kind}
              type="button"
              className="is-covered"
              title={tooltip}
              aria-label={tooltip}
              onClick={() => setSelectedCoverage({
                category: "Squad utility",
                name: entry.label,
                icon: entry.icon,
                providers: entry.sources,
              })}
            >
              <div className="theme-builder-boon-icon">
                {entry.icon ? <img src={entry.icon} alt="" /> : <Wrench className="h-5 w-5" />}
                <em>{entry.sources.length}</em>
              </div>
              <span>{entry.label}</span>
            </button>
          );
        })}
      </div>
      <p className="theme-builder-coverage-missing">
        <strong>Missing</strong>
        <span>{missingUtilities.length ? missingUtilities.map((kind) => BUILD_UTILITY_LABELS[kind]).join(" · ") : "None"}</span>
      </p>
      {selectedCoverage && <CoverageBreakdownDialog detail={selectedCoverage} onClose={() => setSelectedCoverage(null)} />}
    </section>
  );
}

function SquadWorkspace({
  composition,
  builds,
  coverageBuilds,
  boonCache,
  boonComputing,
  conditionCache,
  conditionComputing,
  utilityCache,
  utilityComputing,
  onCreate,
  onChange,
  onOpenBuild,
  onCopyCode,
  onShareCode,
  specsById,
}: {
  composition: BuilderComposition | null;
  builds: SavedBuilderBuild[];
  coverageBuilds: SavedBuilderBuild[];
  boonCache: Record<string, BoonCoverageEntry[]>;
  boonComputing: boolean;
  conditionCache: Record<string, BuilderConditionEntry[]>;
  conditionComputing: boolean;
  utilityCache: Record<string, BuildUtilityEntry[]>;
  utilityComputing: boolean;
  onCreate: () => void;
  onChange: (composition: BuilderComposition) => void;
  onOpenBuild: (build: SavedBuilderBuild) => void;
  onCopyCode: () => void;
    onShareCode: () => void;
  specsById: Map<number, Gw2Specialization>;
}) {
  const [rosterQuery, setRosterQuery] = useState("");
  const [moveSource, setMoveSource] = useState<SquadMoveSource | null>(null);
  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    composition?.parties.forEach((party) => {
      party.slots.forEach((buildId) => {
        if (buildId) counts.set(buildId, (counts.get(buildId) ?? 0) + 1);
      });
    });
    return counts;
  }, [composition]);
  const rosterBuilds = useMemo(() => {
    const query = rosterQuery.trim().toLowerCase();
    if (!query) return builds;
    return builds.filter((build) => [build.name, build.state.professionId, build.state.role, ...build.state.tags].join(" ").toLowerCase().includes(query));
  }, [builds, rosterQuery]);

  if (!composition) {
    return (
      <section className="theme-builder-workspace theme-builder-empty">
        <Users className="h-8 w-8" /><strong>No active squad plan</strong><span>Create a plan and assign saved builds into five-player subgroups.</span>
        <button type="button" className="theme-command-button" onClick={onCreate}><Plus className="h-4 w-4" /> Create squad</button>
      </section>
    );
  }

  const assigned = composition.parties.reduce((total, party) => total + party.slots.filter(Boolean).length, 0);
  const availableBuilds = builds;
  const update = (partial: Partial<BuilderComposition>) => onChange({ ...composition, ...partial, updatedAt: new Date().toISOString() });
  const updateSlot = (partyId: string, slotIndex: number, buildId: string | null) => update({
    parties: composition.parties.map((item) => item.id === partyId
      ? { ...item, slots: item.slots.map((slot, index) => index === slotIndex ? buildId : slot) }
      : item),
  });
  const handleSlotDrop = (event: React.DragEvent<HTMLDivElement>, partyId: string, slotIndex: number) => {
    event.preventDefault();
    const sourceValue = event.dataTransfer.getData(SQUAD_SLOT_DRAG_TYPE);
    if (sourceValue) {
      try {
        const source = JSON.parse(sourceValue) as SquadMoveSource;
        const parties = moveSquadAssignment(composition.parties, source, { partyId, slotIndex });
        if (parties !== composition.parties) {
          update({ parties });
          window.setTimeout(() => document.getElementById(`squad-slot-${partyId}-${slotIndex}-trigger`)?.focus(), 0);
        }
      } catch {
        // Ignore malformed external drag data.
      }
      return;
    }
    const buildId = event.dataTransfer.getData("text/plain");
    if (!buildId || !builds.some((build) => build.id === buildId)) return;
    updateSlot(partyId, slotIndex, buildId);
  };
  const closeMoveDialog = () => {
    const source = moveSource;
    setMoveSource(null);
    if (source) window.setTimeout(() => document.getElementById(`squad-slot-${source.partyId}-${source.slotIndex}-move`)?.focus(), 0);
  };
  const moveAssignment = (target: SquadSlotLocation) => {
    if (!moveSource) return;
    const parties = moveSquadAssignment(composition.parties, moveSource, target);
    if (parties === composition.parties) return;
    setMoveSource(null);
    update({ parties });
    window.setTimeout(() => document.getElementById(`squad-slot-${target.partyId}-${target.slotIndex}-trigger`)?.focus(), 0);
  };

  return (
    <div className="theme-builder-squad-command">
      <div className="theme-builder-squad-command-left">
      <section className="theme-builder-workspace theme-builder-squad-roster">
        <div className="theme-builder-section-head">
          <div><div className="theme-builder-kicker">Squad composition</div><h3>Squad roster</h3></div>
          <div className="theme-builder-squad-readout"><strong>{assigned}</strong><span>assigned</span></div>
        </div>
        <div className="theme-builder-squad-toolbar">
          <div className="theme-builder-squad-settings">
            <label><FieldLabel>Squad name</FieldLabel><TextField value={composition.name} onChange={(event) => update({ name: event.target.value })} /></label>
            <div>
              <FieldLabel>Mode</FieldLabel>
              <div className="theme-builder-squad-mode" role="group" aria-label="Squad game mode">
                {GAME_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={composition.gameMode === mode.id}
                    className={composition.gameMode === mode.id ? "is-active" : undefined}
                    onClick={() => update({ gameMode: mode.id })}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="theme-builder-squad-actions">
            <button type="button" className="theme-command-button" onClick={onCopyCode} disabled={!assigned}><Clipboard className="h-4 w-4" /> Copy squad code</button>
            <button type="button" className="theme-command-button" onClick={onShareCode} disabled={!assigned}><Link2 className="h-4 w-4" /> Share squad link</button>
          </div>
        </div>
        <div className="theme-builder-party-stack">
          {composition.parties.map((party, partyIndex) => (
            <div key={party.id} className="theme-builder-party-line">
              <div className="theme-builder-party-name">
                <span>{String(partyIndex + 1).padStart(2, "0")}</span>
                <input aria-label={`Subgroup ${partyIndex + 1} name`} value={party.name} onChange={(event) => update({ parties: composition.parties.map((item) => item.id === party.id ? { ...item, name: event.target.value } : item) })} />
                {composition.parties.length > 1 && <button type="button" title="Remove subgroup" aria-label={`Remove ${party.name}`} onClick={() => update({ parties: composition.parties.filter((item) => item.id !== party.id) })}><X /></button>}
              </div>
              <div className="theme-builder-party-slots">
                {party.slots.map((buildId, slotIndex) => {
                  const selected = builds.find((build) => build.id === buildId);
                  const slotPickerId = `squad-slot-${party.id}-${slotIndex}`;
                  return (
                    <div
                      key={slotIndex}
                      className={selected ? "theme-builder-squad-slot is-filled" : "theme-builder-squad-slot"}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = event.dataTransfer.types.includes(SQUAD_SLOT_DRAG_TYPE) ? "move" : "copy";
                      }}
                      onDrop={(event) => handleSlotDrop(event, party.id, slotIndex)}
                    >
                      <span className="theme-builder-squad-slot-index">{slotIndex + 1}</span>
                      {selected ? (
                        <>
                          <button
                            id={`${slotPickerId}-trigger`}
                            type="button"
                            className="theme-builder-squad-card"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", selected.id);
                              event.dataTransfer.setData(SQUAD_SLOT_DRAG_TYPE, JSON.stringify({ partyId: party.id, slotIndex, buildId: selected.id }));
                            }}
                            onClick={() => onOpenBuild(selected)}
                            title={`Open ${selected.name}`}
                            aria-label={`Open ${selected.name}`}
                          >
                            <ClassIcon name={resolveEliteSpecName(selected.state.specializationIds, specsById, selected.state.professionId)} size="md" />
                          </button>
                          <div className="theme-builder-squad-slot-actions">
                            <button
                              id={`${slotPickerId}-move`}
                              type="button"
                              className="theme-builder-squad-move"
                              onClick={() => setMoveSource({ partyId: party.id, slotIndex, buildId: selected.id })}
                              title="Move squad assignment"
                              aria-label={`Move ${selected.name} from ${party.name}, slot ${slotIndex + 1}`}
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="theme-builder-squad-remove"
                              onClick={() => {
                                updateSlot(party.id, slotIndex, null);
                                window.setTimeout(() => document.getElementById(`${slotPickerId}-trigger`)?.focus(), 0);
                              }}
                              title="Clear squad slot"
                              aria-label={`Clear ${selected.name} from ${party.name}, slot ${slotIndex + 1}`}
                            >
                              <MinusCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <SquadSlotPicker
                          id={slotPickerId}
                          slotLabel={`${party.name}, slot ${slotIndex + 1}`}
                          builds={availableBuilds}
                          onAssign={(buildId) => updateSlot(party.id, slotIndex, buildId)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="theme-builder-add-line" onClick={() => update({ parties: [...composition.parties, createParty(composition.parties.length)] })}><Plus className="h-4 w-4" /> Add subgroup</button>
      </section>
      <div className="theme-builder-squad-coverage-stack">
        <SquadBoonCoverage composition={composition} builds={coverageBuilds} boonCache={boonCache} computing={boonComputing} />
        <SquadConditionCoverage composition={composition} builds={coverageBuilds} conditionCache={conditionCache} computing={conditionComputing} />
        <SquadUtilityCoverage composition={composition} builds={coverageBuilds} utilityCache={utilityCache} computing={utilityComputing} />
      </div>
      </div>
      <div className="theme-builder-squad-command-right">
      <section className="theme-builder-workspace theme-builder-squad-library">
        <div className="theme-builder-section-head">
          <div><div className="theme-builder-kicker">Drag cards into open squad slots</div><h3>Saved build library</h3></div>
          <div className="theme-builder-squad-library-tools">
            <div className="theme-builder-search">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input aria-label="Search squad build roster" value={rosterQuery} onChange={(event) => setRosterQuery(event.target.value)} placeholder="Search builds" />
              {rosterQuery && <button type="button" onClick={() => setRosterQuery("")} title="Clear search" aria-label="Clear squad build search"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <span className="theme-builder-squad-library-count">{rosterBuilds.length}/{availableBuilds.length}</span>
          </div>
        </div>
        {rosterBuilds.length ? (
          <div className="theme-builder-library-list is-compact">
            {rosterBuilds.map((build, index) => (
              <BuildSummaryCard
                key={build.id}
                build={build}
                index={index}
                onOpen={onOpenBuild}
                slotCount={assignmentCounts.get(build.id) ?? 0}
                draggable
                specsById={specsById}
              />
            ))}
          </div>
        ) : availableBuilds.length ? (
          <div className="theme-builder-empty is-compact"><Search className="h-7 w-7" /><strong>No matching builds</strong><span>No saved build matches &quot;{rosterQuery.trim()}&quot;.</span><button type="button" className="theme-command-button" onClick={() => setRosterQuery("")}><X className="h-4 w-4" /> Clear search</button></div>
        ) : (
          <div className="theme-builder-empty is-compact"><Archive className="h-7 w-7" /><strong>No saved builds</strong><span>Save a build or draft, then drag it into as many squad slots as you need.</span></div>
        )}
      </section>
      </div>
      {moveSource && (
        <SquadMoveDialog
          source={moveSource}
          composition={composition}
          builds={builds}
          onMove={moveAssignment}
          onClose={closeMoveDialog}
        />
      )}
    </div>
  );
}

function buildAttributeRows(attributeTotals: AttributeTotals): Array<[string, string, React.ReactNode]> {
  return [
    ["Power", Math.round(attributeTotals.power).toLocaleString(), <Swords className="h-4 w-4" />],
    ["Precision", Math.round(attributeTotals.precision).toLocaleString(), <Sparkles className="h-4 w-4" />],
    ["Toughness", Math.round(attributeTotals.toughness).toLocaleString(), <Shield className="h-4 w-4" />],
    ["Vitality", Math.round(attributeTotals.vitality).toLocaleString(), <Shield className="h-4 w-4" />],
    ["Ferocity", Math.round(attributeTotals.ferocity).toLocaleString(), <Swords className="h-4 w-4" />],
    ["Condition Damage", Math.round(attributeTotals.conditionDamage).toLocaleString(), <Sparkles className="h-4 w-4" />],
    ["Expertise", Math.round(attributeTotals.expertise).toLocaleString(), <Sparkles className="h-4 w-4" />],
    ["Concentration", Math.round(attributeTotals.concentration).toLocaleString(), <Users className="h-4 w-4" />],
    ["Healing Power", Math.round(attributeTotals.healingPower).toLocaleString(), <Users className="h-4 w-4" />],
    ["Crit Chance", attributeTotals.critChance.toFixed(1) + "%", <Swords className="h-4 w-4" />],
    ["Crit Damage", attributeTotals.critDamage.toFixed(1) + "%", <Swords className="h-4 w-4" />],
    ["Boon Duration", attributeTotals.boonDuration.toFixed(1) + "%", <Users className="h-4 w-4" />],
    ["Condition Duration", attributeTotals.conditionDuration.toFixed(1) + "%", <Sparkles className="h-4 w-4" />],
  ];
}

function EquipmentAttributePanel({
  attributeProfile,
}: {
  attributeProfile: AttributeProfile;
}) {
  const bonusSources = attributeProfile.contributions.filter((contribution) =>
    ["rune", "infusion", "relic", "food", "utility", "enrichment"].includes(contribution.source)
      && Object.keys(contribution.stats).length > 0,
  );
  return (
    <aside className="theme-builder-equipment-attributes" aria-label="Live equipment attributes" aria-live="polite">
      <header>
        <div>
          <div className="theme-builder-kicker">Live loadout</div>
          <h4><Gauge className="h-4 w-4" /> Attributes</h4>
        </div>
        <span>Set {attributeProfile.activeWeaponSet === 2 ? "II" : "I"}</span>
      </header>
      <div className="theme-builder-equipment-attribute-grid">
        {buildAttributeRows(attributeProfile.totals).map(([label, value, icon]) => (
          <div key={label} className="theme-builder-equipment-attribute">
            <i>{icon}</i>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {bonusSources.length > 0 && (
        <div className="theme-builder-equipment-bonuses">
          <span>Applied bonuses</span>
          {bonusSources.map((contribution) => (
            <div key={contribution.source}>
              <strong>{contribution.label}</strong>
              <small>{Object.entries(contribution.stats).map(([attribute, value]) => `+${formatInteger(value)} ${attribute.replace(/([a-z])([A-Z])/g, "$1 $2")}`).join(" · ")}</small>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function BuildAnalysis({
  attributeTotals,
  attributeProfile,
}: {
  attributeTotals: AttributeTotals;
  attributeProfile: AttributeProfile;
}) {
  const attributeRows = buildAttributeRows(attributeTotals);
  const pressureRows = [
    ["Strike", attributeProfile.pressure.strike],
    ["Condition", attributeProfile.pressure.condition],
    ["Support", attributeProfile.pressure.support],
    ["Sustain", attributeProfile.pressure.sustain],
  ] as const;
  const offenseAttrs: Gw2Attribute[] = ["Power", "Precision", "Ferocity", "ConditionDamage", "Expertise"];
  const supportAttrs: Gw2Attribute[] = ["Concentration", "HealingPower", "Toughness", "Vitality"];

  return (
    <div className="theme-builder-analysis">
      <section className="theme-builder-analysis-attributes" aria-label="Build attributes">
        <div className="theme-builder-preview-equipment-heading">
          <Gauge className="h-4 w-4" />
          <span>Attributes</span>
        </div>
        <div className="theme-builder-preview-attributes">
          {attributeRows.map(([label, value, icon]) => (
            <div key={label} className="theme-builder-preview-attribute">
              <i>{icon}</i>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <details className="theme-builder-analysis-details">
        <summary>
          <span>Build analysis</span>
          <small>{pressureLabel(attributeProfile.primaryIdentity)} · {attributeProfile.equippedSlots}/{attributeProfile.totalSlots} gear slots scored</small>
        </summary>
        <div className="theme-builder-analysis-detail-body">
          <div className="theme-builder-tactical-strip">
            <div className="theme-builder-tactical-card is-primary">
              <small>Build identity</small>
              <strong>{pressureLabel(attributeProfile.primaryIdentity)}</strong>
              <span>Active set {attributeProfile.activeWeaponSet === 1 ? "I" : "II"} · {attributeProfile.equippedSlots}/{attributeProfile.totalSlots} gear slots scored</span>
            </div>
            {pressureRows.map(([label, value]) => (
              <div key={label} className="theme-builder-tactical-meter">
                <div><small>{label}</small><strong>{value}</strong></div>
                <i><span style={{ width: `${value}%` }} /></i>
              </div>
            ))}
          </div>
          <div className="theme-builder-contribution-grid">
            {attributeProfile.contributions.map((contribution) => (
              <div key={contribution.source} className="theme-builder-contribution-card">
                <small>{contribution.label}</small>
                <strong>+{formatInteger(contributionTotal(contribution, offenseAttrs))}</strong>
                <span>offense stats</span>
                <em>+{formatInteger(contributionTotal(contribution, supportAttrs))} support/sustain</em>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

function BuildPreview({
  builder,
  profession,
  specsById,
  traitsBySpecId,
  skillsById,
  legends,
  pets,
  attributeTotals,
  attributeProfile,
  weaponSet,
  onSwapWeaponSet,
  onInspectSkill,
  onInspectPet,
  onInspectTrait,
  onInspectSpecialization,
  compact = false,
}: {
  builder: EntropyBuilderState;
  profession: Gw2Profession | null;
  specsById: Map<number, Gw2Specialization>;
  traitsBySpecId: Map<number, Gw2Trait[]>;
  skillsById: Map<number, Gw2Skill>;
  legends: Gw2Legend[];
  pets: Gw2Pet[];
  attributeTotals: AttributeTotals;
  attributeProfile: AttributeProfile;
  weaponSet: WeaponSetNumber;
  onSwapWeaponSet: () => void;
  onInspectSkill: (skill: Gw2Skill) => void;
  onInspectPet: (pet: Gw2Pet) => void;
  onInspectTrait: (trait: Gw2Trait) => void;
  onInspectSpecialization: (specialization: Gw2Specialization) => void;
  compact?: boolean;
}) {
  return (
    <div className="theme-builder-preview">
      {!compact && <div className="theme-builder-preview-header">
        {profession && <ClassIcon name={resolveEliteSpecName(builder.specializationIds, specsById, profession.name)} size="lg" />}
        <div>
          <h2>{builder.name || "Untitled Build"}</h2>
          <p className="theme-builder-preview-subtitle">
            {profession?.name ?? "No profession"} · {builder.gameMode.toUpperCase()}
            {builder.role ? " · " + builder.role : ""}
          </p>
        </div>
      </div>}

      <BuildCombatBar builder={builder} profession={profession} specsById={specsById} skillsById={skillsById} legends={legends} pets={pets} health={attributeTotals.health} weaponSet={weaponSet} onSwap={onSwapWeaponSet} onInspect={onInspectSkill} onInspectPet={onInspectPet} showUtilityNames={compact} />

      <div className="theme-builder-preview-specs">
        {[0, 1, 2].map((trackIndex) => {
          const specId = builder.specializationIds[trackIndex];
          const spec = specId ? specsById.get(specId) : null;
          if (!spec) {
            return (
              <div key={trackIndex} className="theme-builder-preview-spec-row is-empty">
                <p>Choose specialization {trackIndex + 1}</p>
              </div>
            );
          }
          const traits = traitsBySpecId.get(spec.id) ?? [];
          const rowStyle = spec.background ? { backgroundImage: "url(" + spec.background + ")" } : undefined;
          return (
            <div key={trackIndex} className="theme-builder-preview-spec-row" style={rowStyle}>
              <button type="button" className="theme-builder-preview-spec-identity" onClick={() => onInspectSpecialization(spec)} title={`Inspect ${spec.name}`}>
                <span className="theme-builder-preview-spec-badge">
                  {spec.icon && <img src={spec.icon} alt="" />}
                </span>
                <span className="theme-builder-preview-spec-name">{spec.name}</span>
              </button>
              <div className="theme-builder-preview-spec-tiers">
                {[1, 2, 3].map((tier) => {
                  const minor = traits.find((trait) => trait.slot === "Minor" && trait.tier === tier);
                  const majors = traits
                    .filter((trait) => trait.slot === "Major" && trait.tier === tier)
                    .sort((a, b) => a.order - b.order);
                  const chosenIndex = builder.traitChoices[trackIndex][tier - 1];
                  return (
                    <div key={tier} className="theme-builder-preview-tier">
                      {minor?.icon && (
                        <button type="button" className="theme-builder-preview-trait-button is-minor" onClick={() => onInspectTrait(minor)} title={`Inspect ${minor.name}`} aria-label={`Inspect ${minor.name}`}><img className="theme-builder-preview-tier-minor" src={minor.icon} alt="" /></button>
                      )}
                      <div className="theme-builder-preview-tier-majors">
                        {majors.map((trait, position) => (
                          trait.icon ? (
                            <button
                              key={trait.id}
                              type="button"
                              className={`theme-builder-preview-trait-button${chosenIndex === position + 1 ? " is-selected" : ""}`}
                              onClick={() => onInspectTrait(trait)}
                              title={`Inspect ${trait.name}`}
                              aria-label={`Inspect ${trait.name}`}
                            ><img src={trait.icon} alt="" /></button>
                          ) : null
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!compact && <BuildAnalysis attributeTotals={attributeTotals} attributeProfile={attributeProfile} />}
    </div>
  );
}

function EquipmentPreview({
  builder,
  items,
  onInspectItem,
  attributeTotals,
  attributeProfile,
}: {
  builder: EntropyBuilderState;
  items: Record<number, Gw2Item>;
  onInspectItem?: (item: Gw2Item) => void;
  attributeTotals?: AttributeTotals;
  attributeProfile?: AttributeProfile;
}) {
  const itemFor = (id: string | number | undefined) => (id ? items[Number(id)] : undefined);
  const trinketSlots = ["amulet", "ring1", "ring2", "accessory1", "accessory2", "backpack"];
  const trinketLabels: Record<string, string> = {
    amulet: "Amulet",
    ring1: "Ring 1",
    ring2: "Ring 2",
    accessory1: "Accessory 1",
    accessory2: "Accessory 2",
    backpack: "Back",
  };
  const weaponSetDefs: Array<{ label: string; mainKey: "mainhand1" | "mainhand2"; offKey: "offhand1" | "offhand2" }> = [
    { label: "I", mainKey: "mainhand1", offKey: "offhand1" },
    { label: "II", mainKey: "mainhand2", offKey: "offhand2" },
  ];

  const relicItem = itemFor(BUILDER_RELIC_IDS[builder.equipment.relic]);
  const foodItem = itemForNamedChoice(builder.equipment.food, BUILDER_FOOD_CHOICES, items);
  const utilityItem = itemForNamedChoice(builder.equipment.utility, BUILDER_UTILITY_CHOICES, items);
  const enrichmentItem = itemFor(builder.equipment.enrichment);

  return (
    <div className="theme-builder-preview-equipment">
      <div className="theme-builder-preview-equipment-heading">
        <Wrench className="h-4 w-4" />
        <span>Equipment Loadout</span>
      </div>
      <div className="theme-builder-preview-equipment-grid">
      <div className="theme-builder-preview-equipment-column">
        <h4>Armor</h4>
        <div className="theme-builder-preview-armor-list">
          {ARMOR_SLOTS.map((slot) => {
            const rune = itemFor(builder.equipment.runes[slot]);
            return (
              <div key={slot} className="theme-builder-preview-armor-row">
                <div className="theme-builder-preview-armor-icon"><EquipmentArtwork src={BUILDER_ARMOR_SLOT_ICONS[slot]} fallback={<Shield className="h-4 w-4" />} label={`${ARMOR_SLOT_LABELS[slot]} slot`} /></div>
                <div className="theme-builder-preview-armor-info">
                  <small>{ARMOR_SLOT_LABELS[slot]}</small>
                  <strong>{builder.equipment.slots[slot] || builder.equipment.statPackage || "Unassigned"}</strong>
                </div>
                <button type="button" className="theme-builder-preview-armor-badge" disabled={!rune || !onInspectItem} onClick={() => rune && onInspectItem?.(rune)} title={rune ? `Inspect ${rune.name}` : "No rune"} aria-label={rune ? `Inspect ${rune.name}` : "No rune"}>
                  {rune?.icon ? <img src={rune.icon} alt="" /> : <Sparkles className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>

        <h4>Weapons</h4>
        {weaponSetDefs.map(({ label, mainKey, offKey }) => {
          const main = builder.equipment.weapons[mainKey];
          const off = builder.equipment.weapons[offKey];
          const rows: Array<{ weapon: string; sigils: string[] }> = [];
          if (main) rows.push({ weapon: main, sigils: builder.equipment.sigils[mainKey] });
          if (off) rows.push({ weapon: off, sigils: builder.equipment.sigils[offKey] });
          return (
            <div key={label} className="theme-builder-preview-weapon-set">
              <small>Set {label}</small>
              {rows.length === 0 ? (
                <p className="theme-builder-preview-empty-note">Empty</p>
              ) : (
                rows.map((row, index) => (
                  <div key={index} className="theme-builder-preview-weapon-row">
                    <span className="theme-builder-preview-weapon-name"><EquipmentArtwork src={builderWeaponIcon(row.weapon)} fallback={<Swords className="h-4 w-4" />} label={`${row.weapon} type artwork`} />{row.weapon}</span>
                    <div className="theme-builder-preview-weapon-badges">
                      {row.sigils.map((sigilId, sigilIndex) => {
                        const sigil = itemFor(sigilId);
                        return (
                          <button key={sigilIndex} type="button" className="theme-builder-preview-armor-badge" disabled={!sigil || !onInspectItem} onClick={() => sigil && onInspectItem?.(sigil)} title={sigil ? `Inspect ${sigil.name}` : "No sigil"} aria-label={sigil ? `Inspect ${sigil.name}` : "No sigil"}>
                            {sigil?.icon ? <img src={sigil.icon} alt="" /> : <Sparkles className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <div className="theme-builder-preview-equipment-column">
        <h4>Trinkets</h4>
        <div className="theme-builder-preview-trinkets">
          {trinketSlots.map((slot) => (
            <div key={slot} className="theme-builder-preview-trinket-card">
              <EquipmentArtwork src={BUILDER_TRINKET_SLOT_ICONS[slot]} fallback={<Sparkles className="h-4 w-4" />} label={`${trinketLabels[slot]} slot`} />
              <small>{trinketLabels[slot]}</small>
              <strong>{builder.equipment.slots[slot] || "Unassigned"}</strong>
            </div>
          ))}
        </div>

        <h4>Relic and consumables</h4>
        <div className="theme-builder-preview-consumables">
          <div className="theme-builder-preview-consumable-row">
            <button type="button" className="theme-builder-preview-armor-badge" disabled={!relicItem || !onInspectItem} onClick={() => relicItem && onInspectItem?.(relicItem)} title={relicItem ? `Inspect ${relicItem.name}` : "No relic"} aria-label={relicItem ? `Inspect ${relicItem.name}` : "No relic"}>{relicItem?.icon ? <img src={relicItem.icon} alt="" /> : <Sparkles className="h-4 w-4" />}</button>
            <div className="theme-builder-preview-armor-info"><small>Relic</small><strong>{builder.equipment.relic || "Unassigned"}</strong></div>
          </div>
          <div className="theme-builder-preview-consumable-row">
            <button type="button" className="theme-builder-preview-armor-badge" disabled={!foodItem || !onInspectItem} onClick={() => foodItem && onInspectItem?.(foodItem)} title={foodItem ? `Inspect ${foodItem.name}` : "No food"} aria-label={foodItem ? `Inspect ${foodItem.name}` : "No food"}>{foodItem?.icon ? <img src={foodItem.icon} alt="" /> : <Sparkles className="h-4 w-4" />}</button>
            <div className="theme-builder-preview-armor-info"><small>Food</small><strong>{builder.equipment.food || "Unassigned"}</strong></div>
          </div>
          <div className="theme-builder-preview-consumable-row">
            <button type="button" className="theme-builder-preview-armor-badge" disabled={!utilityItem || !onInspectItem} onClick={() => utilityItem && onInspectItem?.(utilityItem)} title={utilityItem ? `Inspect ${utilityItem.name}` : "No utility"} aria-label={utilityItem ? `Inspect ${utilityItem.name}` : "No utility"}>{utilityItem?.icon ? <img src={utilityItem.icon} alt="" /> : <Sparkles className="h-4 w-4" />}</button>
            <div className="theme-builder-preview-armor-info"><small>Utility</small><strong>{builder.equipment.utility || "Unassigned"}</strong></div>
          </div>
          <div className="theme-builder-preview-consumable-row">
            <button type="button" className="theme-builder-preview-armor-badge" disabled={!enrichmentItem || !onInspectItem} onClick={() => enrichmentItem && onInspectItem?.(enrichmentItem)} title={enrichmentItem ? `Inspect ${enrichmentItem.name}` : "No enrichment"} aria-label={enrichmentItem ? `Inspect ${enrichmentItem.name}` : "No enrichment"}>{enrichmentItem?.icon ? <img src={enrichmentItem.icon} alt="" /> : <Sparkles className="h-4 w-4" />}</button>
            <div className="theme-builder-preview-armor-info"><small>Enrichment</small><strong>{enrichmentItem?.name ?? (builder.equipment.enrichment || "Unassigned")}</strong></div>
          </div>
        </div>
      </div>
      </div>
      {attributeTotals && attributeProfile && <BuildAnalysis attributeTotals={attributeTotals} attributeProfile={attributeProfile} />}
    </div>
  );
}

type BuildViewerTab = "build" | "equipment";

function BuildViewerDialog({
  build,
  professions,
  specsById,
  legends,
  pets,
  items,
  onClose,
  onEdit,
}: {
  build: SavedBuilderBuild;
  professions: Gw2Profession[];
  specsById: Map<number, Gw2Specialization>;
  legends: Gw2Legend[];
  pets: Gw2Pet[];
  items: Record<number, Gw2Item>;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<BuildViewerTab>("build");
  const [traits, setTraits] = useState<Gw2Trait[]>([]);
  const [skills, setSkills] = useState<Gw2Skill[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selected, setSelected] = useState<BuilderSummaryItem | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [weaponSet, setWeaponSet] = useState<WeaponSetNumber>(build.state.activeWeaponSet === 2 ? 2 : 1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);
  const reduceMotion = useReducedMotion();
  const profession = professions.find((item) => item.id === build.state.professionId) ?? null;
  const selectedSpecs = useMemo(
    () => build.state.specializationIds.map((id) => id ? specsById.get(id) : null).filter((spec): spec is Gw2Specialization => Boolean(spec)),
    [build, specsById],
  );
  const viewerSpecsById = useMemo(() => new Map(selectedSpecs.map((spec) => [spec.id, spec])), [selectedSpecs]);
  const traitsBySpecId = useMemo(() => {
    const map = new Map<number, Gw2Trait[]>();
    traits.forEach((trait) => map.set(trait.specialization, [...(map.get(trait.specialization) ?? []), trait]));
    return map;
  }, [traits]);
  const skillsById = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const profile = useMemo(() => computeAttributeProfile(build.state, profession, items), [build, profession, items]);

  useEffect(() => {
    if (profession) setSelected((current) => current ?? { kind: "profession", item: profession });
  }, [profession]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    const traitIds = selectedSpecs.flatMap((spec) => [...spec.major_traits, ...spec.minor_traits]);
    const legendSkillIds = legends
      .filter((legend) => [...build.state.selectedLegends, ...build.state.selectedUnderwaterLegends].includes(legend.id))
      .flatMap((legend) => [legend.swap, legend.heal, legend.elite, ...(legend.utilities ?? [])].filter((id): id is number => Boolean(id)));
    const skillIds = [
      build.state.healSkillId,
      ...build.state.utilitySkillIds,
      build.state.eliteSkillId,
      ...weaponSkillIds(profession),
      ...legendSkillIds,
    ].filter((id): id is number => Boolean(id));
    Promise.all([fetchGw2Traits(traitIds), fetchGw2Skills(skillIds)]).then(([nextTraits, nextSkills]) => {
      if (cancelled) return;
      setTraits(nextTraits);
      setSkills(nextSkills);
    }).catch(() => {
      if (cancelled) return;
      setTraits([]);
      setSkills([]);
    }).finally(() => {
      if (!cancelled) setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, [build, legends, profession, selectedSpecs]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const closeExportMenu = (event: PointerEvent) => {
      if (exportMenuRef.current?.open && !exportMenuRef.current.contains(event.target as Node)) exportMenuRef.current.open = false;
    };
    document.addEventListener("pointerdown", closeExportMenu);
    return () => document.removeEventListener("pointerdown", closeExportMenu);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (exportMenuRef.current?.open) {
        exportMenuRef.current.open = false;
        exportMenuRef.current.querySelector("summary")?.focus();
        return;
      }
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])') ?? [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const viewerUrl = new URL(window.location.href);
  viewerUrl.searchParams.set("builderBuild", build.id);

  const copyViewerValue = async (value: string, status: string) => {
    await navigator.clipboard?.writeText(value);
    setCopyStatus(status);
    if (exportMenuRef.current) exportMenuRef.current.open = false;
  };

  return createPortal(
    <motion.div className="theme-builder-viewer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div ref={dialogRef} className="theme-builder-viewer" role="dialog" aria-modal="true" aria-labelledby="builder-viewer-title" tabIndex={-1} onKeyDown={handleKeyDown} initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.99 }} transition={{ duration: reduceMotion ? 0 : 0.16 }}>
        <header className="theme-builder-viewer-head">
          <div><ClassIcon name={resolveEliteSpecName(build.state.specializationIds, specsById, build.state.professionId)} size="lg" /><span><small>{build.state.professionId} · {build.state.gameMode.toUpperCase()}</small><h2 id="builder-viewer-title">{build.name}</h2></span></div>
          <div>
            <button type="button" onClick={onEdit}><Wrench className="h-4 w-4" /> Edit build</button>
            <details ref={exportMenuRef} className="theme-builder-viewer-export">
              <summary title="Copy or share build" aria-label="Copy or share build"><Share2 className="h-4 w-4" /><span>Share</span></summary>
              <div>
                <button type="button" aria-label="Copy Entropy build code" disabled={!build.shareCode} onClick={() => copyViewerValue(brandEntropyCode(build.shareCode), "Entropy code copied.")}><Clipboard className="h-4 w-4" /> Copy Entropy code</button>
                <button type="button" aria-label="Copy portable build share link" disabled={!build.shareCode} onClick={() => copyViewerValue(buildAxiForgeShareUrl(build.shareCode), "Portable share link copied.")}><Link2 className="h-4 w-4" /> Copy share link</button>
                {!build.shareCode && <small>Complete required build data to enable portable sharing.</small>}
              </div>
            </details>
            <a href={viewerUrl.toString()} target="_blank" rel="noreferrer" title="Open build in new tab" aria-label="Open build in new tab"><ExternalLink className="h-4 w-4" /></a>
            <button type="button" onClick={onClose} title="Close build viewer" aria-label="Close build viewer"><X className="h-4 w-4" /></button>
          </div>
        </header>
        <nav className="theme-builder-viewer-tabs" role="tablist" aria-label="Build viewer sections">
          {(["build", "equipment"] as const).map((item) => <button key={item} id={`builder-viewer-tab-${item}`} type="button" role="tab" aria-selected={tab === item} aria-controls={`builder-viewer-panel-${item}`} tabIndex={tab === item ? 0 : -1} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)} onKeyDown={(event) => moveTabFocus(["build", "equipment"] as const, item, event, setTab, (next) => `builder-viewer-tab-${next}`)}>{item === "build" ? <Swords className="h-4 w-4" /> : <Shield className="h-4 w-4" />}{item}</button>)}
        </nav>
        <div id={`builder-viewer-panel-${tab}`} className="theme-builder-viewer-body" role="tabpanel" aria-labelledby={`builder-viewer-tab-${tab}`} aria-busy={catalogLoading}>
          <div className="theme-builder-viewer-canvas">
            {tab === "build" ? (
              <BuildPreview builder={build.state} profession={profession} specsById={viewerSpecsById} traitsBySpecId={traitsBySpecId} skillsById={skillsById} legends={legends} pets={pets} attributeTotals={profile.totals} attributeProfile={profile} weaponSet={weaponSet} onSwapWeaponSet={() => setWeaponSet((current) => current === 1 ? 2 : 1)} onInspectSkill={(skill) => setSelected({ kind: "skill", item: skill })} onInspectPet={(pet) => setSelected({ kind: "pet", item: pet })} onInspectTrait={(trait) => setSelected({ kind: "trait", item: trait })} onInspectSpecialization={(specialization) => setSelected({ kind: "specialization", item: specialization })} compact />
            ) : <EquipmentPreview builder={build.state} items={items} attributeTotals={profile.totals} attributeProfile={profile} onInspectItem={(item) => setSelected({ kind: "item", item })} />}
          </div>
          <DetailPanel selected={selected} builder={build.state} embedded showAdvanced={false} />
        </div>
        <span className="sr-only" role="status" aria-live="polite">{copyStatus}</span>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export default function AxiForgeLabView() {
  const [workspace, setWorkspace] = useState<BuilderWorkspace>(() => loadBuilderWorkspace());
  const [viewingBuildId, setViewingBuildId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("builderBuild"));
  const viewerHistoryPushedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("build");
  const [builderViewMode, setBuilderViewMode] = useState<BuilderSection>(loadBuilderSection);
  const [equipmentSection, setEquipmentSection] = useState<EquipmentSection>("weapons");
  const [detailRailOpen, setDetailRailOpen] = useState(false);
  const [compactDetailsPanel, setCompactDetailsPanel] = useState<MobileRailPanel | null>(null);
  const compactDetailsReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);
  const [displayedWeaponSet, setDisplayedWeaponSet] = useState<WeaponSetNumber>(() => workspace.draft.activeWeaponSet === 2 ? 2 : 1);
  const [editingBuildId, setEditingBuildId] = useState<string | null>(null);
  const [professions, setProfessions] = useState<Gw2Profession[]>([]);
  const [itemStats, setItemStats] = useState<Gw2ItemStat[]>([]);
  const [legends, setLegends] = useState<Gw2Legend[]>([]);
  const [pets, setPets] = useState<Gw2Pet[]>([]);
  const [catalogSource, setCatalogSource] = useState<BuilderCatalogSource | null>(null);
  const [professionSpecs, setProfessionSpecs] = useState<Gw2Specialization[]>([]);
  const [allSpecsById, setAllSpecsById] = useState<Map<number, Gw2Specialization>>(new Map());
  const [selectedSpecTraits, setSelectedSpecTraits] = useState<Gw2Trait[]>([]);
  const [professionSkills, setProfessionSkills] = useState<Gw2Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<BuilderSummaryItem | null>(null);
  const [importCode, setImportCode] = useState("");
  const [exportCode, setExportCode] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [boonCache, setBoonCache] = useState<Record<string, BoonCoverageEntry[]>>({});
  const [boonComputing, setBoonComputing] = useState(false);
  const [conditionCache, setConditionCache] = useState<Record<string, BuilderConditionEntry[]>>({});
  const [conditionComputing, setConditionComputing] = useState(false);
  const [utilityCache, setUtilityCache] = useState<Record<string, BuildUtilityEntry[]>>({});
  const [utilityComputing, setUtilityComputing] = useState(false);
  const [equipmentItems, setEquipmentItems] = useState<Record<number, Gw2Item>>({});

  const builder = workspace.draft;
  const viewingBuild = useMemo(() => workspace.builds.find((build) => build.id === viewingBuildId) ?? null, [viewingBuildId, workspace.builds]);
  const updateBuilder = (updater: EntropyBuilderState | ((current: EntropyBuilderState) => EntropyBuilderState)) => {
    setWorkspace((current) => ({ ...current, draft: typeof updater === "function" ? updater(current.draft) : updater }));
  };

  const inspectBuilderItem = (summary: BuilderSummaryItem) => {
    setSelectedSummary(summary);
    if (window.matchMedia(BUILDER_COMPACT_DETAILS_QUERY).matches) {
      compactDetailsReturnFocusRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
      setCompactDetailsPanel("inspector");
    } else setDetailRailOpen(true);
  };

  useEffect(() => {
    const query = window.matchMedia(BUILDER_COMPACT_DETAILS_QUERY);
    const syncDetailSurface = (compact: boolean) => {
      if (compact) setDetailRailOpen(false);
      else setCompactDetailsPanel(null);
    };
    const handleWidthChange = (event: MediaQueryListEvent) => syncDetailSurface(event.matches);
    syncDetailSurface(query.matches);
    query.addEventListener("change", handleWidthChange);
    return () => query.removeEventListener("change", handleWidthChange);
  }, []);

  useEffect(() => saveBuilderWorkspace(workspace), [workspace]);

  useEffect(() => {
    const syncViewerFromUrl = () => {
      viewerHistoryPushedRef.current = false;
      setViewingBuildId(new URLSearchParams(window.location.search).get("builderBuild"));
    };
    window.addEventListener("popstate", syncViewerFromUrl);
    return () => window.removeEventListener("popstate", syncViewerFromUrl);
  }, []);

  useEffect(() => {
    if (!viewingBuildId || viewingBuild) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("builderBuild");
    window.history.replaceState(window.history.state, "", url);
    viewerHistoryPushedRef.current = false;
    setViewingBuildId(null);
    setNotice({ tone: "warning", message: "That saved build is no longer available in this browser." });
  }, [viewingBuild, viewingBuildId]);

  useEffect(() => {
    window.sessionStorage.setItem(BUILDER_SECTION_SESSION_KEY, builderViewMode);
  }, [builderViewMode]);

  useEffect(() => {
    setDisplayedWeaponSet(builder.activeWeaponSet === 2 ? 2 : 1);
  }, [builder.activeWeaponSet, editingBuildId]);

  useEffect(() => {
    const sharedCode = parseAxiForgeShareQuery(window.location.search);
    if (!sharedCode) return;
    const result = decodeAxiForgeCode(sharedCode);
    if (result.ok && result.value && result.kind === "comp") {
    void hydrateSharedComposition(result.value).catch((error) => {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The shared squad could not be restored.",
      });
      clearAxiForgeShareQuery();
    });
    return;
    }
    if (!result.ok || !result.value || result.kind !== "build") {
      setNotice({ tone: "error", message: result.error ?? "This share link could not be read." });
      clearAxiForgeShareQuery();
      return;
    }
    const imported = builderFromAxiBuild(result.value, { name: "Shared Build" });
    updateBuilder(imported);
    setEditingBuildId(null);
    setActiveTab("build");
    setBuilderViewMode("preview");
    setNotice({ tone: "success", message: "Loaded a shared build. This is your own local copy — edit it or save it to keep it." });
    clearAxiForgeShareQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProfession = useMemo(() => professions.find((profession) => profession.id === builder.professionId) ?? null, [builder.professionId, professions]);
  const attributeProfile = useMemo(() => computeAttributeProfile(builder, selectedProfession, equipmentItems), [builder, selectedProfession, equipmentItems]);
  const attributeTotals = attributeProfile.totals;
  const specsById = useMemo(() => new Map(professionSpecs.map((spec) => [spec.id, spec])), [professionSpecs]);
  const equipmentSpecialization = resolveEliteSpecName(builder.specializationIds, specsById, selectedProfession?.name ?? "Build");
  const activeEquipmentWeapons = useMemo(() => {
    const set = builder.activeWeaponSet === 2 ? 2 : 1;
    return [builder.equipment.weapons[`mainhand${set}`], builder.equipment.weapons[`offhand${set}`]]
      .filter(Boolean)
      .map((weapon) => weapon.charAt(0).toUpperCase() + weapon.slice(1))
      .join(" + ");
  }, [builder.activeWeaponSet, builder.equipment.weapons]);
  const traitsBySpecId = useMemo(() => {
    const map = new Map<number, Gw2Trait[]>();
    selectedSpecTraits.forEach((trait) => map.set(trait.specialization, [...(map.get(trait.specialization) ?? []), trait]));
    return map;
  }, [selectedSpecTraits]);
  const skillsById = useMemo(() => new Map(professionSkills.map((skill) => [skill.id, skill])), [professionSkills]);
  const availableWeapons = useMemo(
    () => availableProfessionWeapons(selectedProfession, builder.specializationIds),
    [builder.specializationIds, selectedProfession],
  );
  const statOptions = useMemo<string[]>(() => [...STAT_OPTIONS], []);
  const equipmentIds = useMemo(() => {
    const ids = equipmentItemIds(builder.equipment);
    const relicId = BUILDER_RELIC_IDS[builder.equipment.relic];
    return relicId ? [...ids, relicId] : ids;
  }, [builder.equipment]);
  const equipmentIdsKey = equipmentIds.join(",");
  const runeValues = useMemo(() => [...new Set(Object.values(builder.equipment.runes).filter(Boolean))], [builder.equipment.runes]);
  const hasMixedRunes = runeValues.length > 1;
  const issues = useMemo(() => {
    const next = [
      ...validateBuilder(builder),
      ...validateBuilderEquipmentAgainstCatalog(builder, selectedProfession),
      ...validateBuilderSkillsAgainstCatalog(builder, professionSkills),
      ...validateRevenantLegendSelection(builder, legends, skillsById),
    ];
    if (!choiceIsCodecSupported(builder.equipment.relic, BUILDER_RELIC_CHOICES)) next.push("Relic is not supported by the current Entropy code format.");
    if (!choiceIsCodecSupported(builder.equipment.food, BUILDER_FOOD_LABELS)) next.push("Food is not supported by the current Entropy code format.");
    if (!choiceIsCodecSupported(builder.equipment.utility, BUILDER_UTILITY_LABELS)) next.push("Utility is not supported by the current Entropy code format.");
    return next;
  }, [builder, legends, professionSkills, selectedProfession, skillsById]);
  const builderSectionIssueCounts = useMemo<Record<BuilderSection, number>>(() => {
    const overviewIssues = new Set(["Add a build name."]);
    const traitsIssues = new Set([
      "Choose all three specialization lines.",
      "Choose all nine major traits.",
      "Complete the land skill bar.",
    ]);
    const overview = issues.filter((issue) => overviewIssues.has(issue)).length;
    const traits = issues.filter((issue) => traitsIssues.has(issue) || issue.endsWith(" is not available to the selected specializations.")).length;
    return {
      overview,
      traits,
      equipment: issues.length - overview - traits,
      notes: 0,
      preview: issues.length,
    };
  }, [issues]);
  const detectedKind = useMemo(() => detectAxiForgeCodeKind(importCode), [importCode]);
  const gw2SkillsInput = useMemo(() => isGw2SkillsInput(importCode), [importCode]);
  const gw2ChatCodeInput = useMemo(() => isBuildChatCode(importCode), [importCode]);
  const activeComposition = workspace.compositions.find((composition) => composition.id === workspace.activeCompositionId) ?? null;
  const squadCoverageBuilds = useMemo(
    () => mergeLiveBuildForCoverage(workspace.builds, editingBuildId, builder),
    [builder, editingBuildId, workspace.builds],
  );

  useEffect(() => {
    let cancelled = false;
    loadBuilderItemsByIds(equipmentIds)
      .then((items) => { if (!cancelled) setEquipmentItems(items); })
      .catch(() => { if (!cancelled) setEquipmentItems({}); });
    return () => { cancelled = true; };
  }, [equipmentIdsKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadBuilderFoundationCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setProfessions(catalog.professions);
        const allSpecIds = Array.from(new Set(catalog.professions.flatMap((item) => item.specializations)));
        if (allSpecIds.length) {
          fetchGw2Specializations(allSpecIds)
            .then((specs) => { if (!cancelled) setAllSpecsById(new Map(specs.map((spec) => [spec.id, spec]))); })
            .catch(() => {});
        }
        setItemStats(catalog.itemStats);
        setLegends(catalog.legends);
        setPets(catalog.pets);
        setCatalogSource(catalog.source);
        if (!catalog.professions.some((item) => item.id === builder.professionId) && catalog.professions[0]) {
          updateBuilder((current) => ({ ...current, professionId: catalog.professions[0].id }));
        }
      })
      .catch((error) => !cancelled && setCatalogError(error instanceof Error ? error.message : "Unable to load Guild Wars 2 data."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedProfession) return;
    let cancelled = false;
    setCatalogError(null);
    const legendSwapIds = selectedProfession.id === "Revenant"
      ? legends.flatMap((legend) => legend.swap ? [legend.swap] : [])
      : [];
    const skillIds = [...selectedProfession.skills.map((skill) => skill.id), ...weaponSkillIds(selectedProfession), ...legendSwapIds];
    Promise.all([fetchGw2Specializations(selectedProfession.specializations), fetchGw2Skills(skillIds)])
      .then(([specs, skills]) => {
        if (cancelled) return;
        setProfessionSpecs(specs);
        setProfessionSkills(skills);
        updateBuilder((current) => ({
          ...current,
          specializationIds: current.specializationIds.map((id) => id && specs.some((spec) => spec.id === id) ? id : null) as EntropyBuilderState["specializationIds"],
          healSkillId: current.healSkillId && skills.some((skill) => skill.id === current.healSkillId) ? current.healSkillId : null,
          utilitySkillIds: current.utilitySkillIds.map((id) => id && skills.some((skill) => skill.id === id) ? id : null) as EntropyBuilderState["utilitySkillIds"],
          eliteSkillId: current.eliteSkillId && skills.some((skill) => skill.id === current.eliteSkillId) ? current.eliteSkillId : null,
        }));
      })
      .catch((error) => !cancelled && setCatalogError(error instanceof Error ? error.message : "Unable to load profession data."));
    return () => { cancelled = true; };
  }, [legends, selectedProfession?.id]);

  useEffect(() => {
    const ids = builder.specializationIds.flatMap((id) => id ? specsById.get(id)?.major_traits ?? [] : []);
    let cancelled = false;
    fetchGw2Traits(ids)
      .then((traits) => !cancelled && setSelectedSpecTraits(traits))
      .catch((error) => !cancelled && setCatalogError(error instanceof Error ? error.message : "Unable to load traits."));
    return () => { cancelled = true; };
  }, [builder.specializationIds.join(":"), professionSpecs.length]);

  // Squad boon coverage: for every build currently assigned into any squad
  // slot, resolve and cache its live boon-support profile so the panel above
  // the party stack can stay in sync as builds are saved into the squad.
  useEffect(() => {
    if (!activeComposition) return;
    const referencedIds = new Set(
      activeComposition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id)),
    );
    const targets = [...referencedIds]
      .map((id) => squadCoverageBuilds.find((build) => build.id === id))
      .filter((build): build is SavedBuilderBuild => Boolean(build));
    const missing = targets.filter((build) => !(boonCacheKey(build) in boonCache));
    if (!missing.length) return;
    let cancelled = false;
    setBoonComputing(true);
    Promise.all(
      missing.map(async (build) => {
        try {
          const coverage = await computeBuildBoonCoverage(build.state);
          return [boonCacheKey(build), coverage] as const;
        } catch {
          return [boonCacheKey(build), [] as BoonCoverageEntry[]] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setBoonCache((current) => {
        const next = { ...current };
        for (const [key, coverage] of entries) next[key] = coverage;
        return next;
      });
      setBoonComputing(false);
    });
    return () => { cancelled = true; };
  }, [activeComposition, squadCoverageBuilds, boonCache]);

  useEffect(() => {
    if (!activeComposition) return;
    const referencedIds = new Set(
      activeComposition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id)),
    );
    const targets = [...referencedIds]
      .map((id) => squadCoverageBuilds.find((build) => build.id === id))
      .filter((build): build is SavedBuilderBuild => Boolean(build));
    const missing = targets.filter((build) => !(conditionCacheKey(build) in conditionCache));
    if (!missing.length) return;
    let cancelled = false;
    setConditionComputing(true);
    Promise.all(
      missing.map(async (build) => {
        try {
          const coverage = await computeBuildConditionAccess(build.state);
          return [conditionCacheKey(build), coverage] as const;
        } catch {
          return [conditionCacheKey(build), [] as BuilderConditionEntry[]] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setConditionCache((current) => {
        const next = { ...current };
        for (const [key, coverage] of entries) next[key] = coverage;
        return next;
      });
      setConditionComputing(false);
    });
    return () => { cancelled = true; };
  }, [activeComposition, squadCoverageBuilds, conditionCache]);

  useEffect(() => {
    if (!activeComposition) return;
    const referencedIds = new Set(
      activeComposition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id)),
    );
    const targets = [...referencedIds]
      .map((id) => squadCoverageBuilds.find((build) => build.id === id))
      .filter((build): build is SavedBuilderBuild => Boolean(build));
    const missing = targets.filter((build) => !(utilityCacheKey(build) in utilityCache));
    if (!missing.length) return;
    let cancelled = false;
    setUtilityComputing(true);
    Promise.all(
      missing.map(async (build) => {
        try {
          const coverage = await computeBuildUtilityCoverage(build.state);
          return [utilityCacheKey(build), coverage] as const;
        } catch {
          return [utilityCacheKey(build), [] as BuildUtilityEntry[]] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setUtilityCache((current) => {
        const next = { ...current };
        for (const [key, coverage] of entries) next[key] = coverage;
        return next;
      });
      setUtilityComputing(false);
    });
    return () => { cancelled = true; };
  }, [activeComposition, squadCoverageBuilds, utilityCache]);

  function chooseProfession(profession: Gw2Profession) {
    const next = createEmptyBuilder(profession.id);
    next.gameMode = builder.gameMode;
    next.name = builder.name;
    updateBuilder(next);
    setEditingBuildId(null);
    setSelectedSummary({ kind: "profession", item: profession });
    setExportCode("");
  }

  function chooseSpec(trackIndex: number, id: number | null) {
    const requestedSpec = id ? specsById.get(id) : null;
    const existingElite = builder.specializationIds.some((specId, index) => {
      if (index === trackIndex || !specId) return false;
      return Boolean(specsById.get(specId)?.elite);
    });
    if (requestedSpec?.elite && existingElite) {
      setNotice({ tone: "warning", message: "Only one elite specialization can be equipped per build." });
      return;
    }
    updateBuilder((current) => {
      const specializationIds = [...current.specializationIds] as EntropyBuilderState["specializationIds"];
      const traitChoices = current.traitChoices.map((row) => [...row]) as EntropyBuilderState["traitChoices"];
      const isDuplicate = id != null && specializationIds.some((specId, index) => index !== trackIndex && specId === id);
      const hasOtherElite = id != null && Boolean(specsById.get(id)?.elite) && specializationIds.some((specId, index) => index !== trackIndex && Boolean(specId && specsById.get(specId)?.elite));
      if (isDuplicate || hasOtherElite) return current;
      specializationIds[trackIndex] = id;
      traitChoices[trackIndex] = [0, 0, 0];
      return { ...current, specializationIds, traitChoices };
    });
    if (requestedSpec) setSelectedSummary({ kind: "specialization", item: requestedSpec });
  }

  function chooseTrait(trackIndex: number, tier: number, position: number, trait: Gw2Trait) {
    updateBuilder((current) => {
      const traitChoices = current.traitChoices.map((row) => [...row]) as EntropyBuilderState["traitChoices"];
      traitChoices[trackIndex][tier - 1] = position;
      return { ...current, traitChoices };
    });
    setSelectedSummary({ kind: "trait", item: trait });
  }

  function chooseSkill(slot: Gw2SkillSlot, id: number | null, utilityIndex?: number) {
    updateBuilder((current) => {
      if (slot === "Heal") return { ...current, healSkillId: id };
      if (slot === "Elite") return { ...current, eliteSkillId: id };
      const utilitySkillIds = [...current.utilitySkillIds] as EntropyBuilderState["utilitySkillIds"];
      if (utilityIndex !== undefined) utilitySkillIds[utilityIndex] = id;
      return { ...current, utilitySkillIds };
    });
  }

  function createCurrentCode(): string {
    builder.specializationIds.forEach((specId, trackIndex) => {
      if (!specId || !builder.traitChoices[trackIndex].some(Boolean)) return;
      const majorTraitCount = (traitsBySpecId.get(specId) ?? []).filter((trait) => trait.slot === "Major").length;
      if (majorTraitCount < 9) throw new Error("Trait catalog is still loading.");
    });
    return encodeAxiForgeBuildCode(buildAxiShape(builder, specsById, traitsBySpecId, skillsById));
  }

  async function copyText(value: string, message: string) {
    await navigator.clipboard?.writeText(value);
    setNotice({ tone: "success", message });
  }

  async function saveCurrentBuild() {
    const existing = workspace.builds.find((build) => build.id === editingBuildId);
    let shareCode = existing?.shareCode ?? "";
    let encoded = true;
    try {
      shareCode = createCurrentCode();
    } catch {
      encoded = false;
    }
    try {
      const saved = createSavedBuild(cloneBuilder(builder), shareCode, existing?.id);
      if (existing) saved.createdAt = existing.createdAt;
      setWorkspace((current) => ({ ...current, builds: existing ? current.builds.map((build) => build.id === existing.id ? saved : build) : [saved, ...current.builds] }));
      setEditingBuildId(saved.id);
      setExportCode(shareCode);
      const readinessMessage = issues.length ? `Saved with ${issues.length} readiness item${issues.length === 1 ? "" : "s"}.` : "Build saved to the local library.";
      setNotice({
        tone: encoded && !issues.length ? "success" : "warning",
        message: encoded ? readinessMessage : `${readinessMessage} Entropy code export is unavailable until the missing build data or catalog entries are resolved.`,
      });
    } catch {
      setNotice({ tone: "error", message: "This build could not be saved." });
    }
  }

  async function exportCurrentBuild() {
    try {
      const code = createCurrentCode();
      setExportCode(code);
      await copyText(code, "Entropy build code copied.");
    } catch {
      setNotice({ tone: "error", message: "Build code could not be created yet." });
    }
  }

  async function shareCurrentBuild() {
    try {
      const code = createCurrentCode();
      setExportCode(code);
      await copyText(buildAxiForgeShareUrl(code), "Share link copied.");
    } catch {
      setNotice({ tone: "error", message: "Build code could not be created yet." });
    }
  }

  async function exportChatCode() {
    try {
      const skillPaletteById = await fetchGw2ProfessionSkillPalette(builder.professionId);
      let legendCodeById = new Map<string, number>();
      if (builder.professionId === "Revenant") {
        const legendIds = [...builder.selectedLegends, ...builder.selectedUnderwaterLegends].filter(Boolean);
        const legendRecords = await fetchGw2LegendCodes(legendIds);
        legendCodeById = new Map(legendRecords.map((legend) => [legend.id, legend.code]));
      }
      const catalog: ChatCodeCatalog = { skillPaletteById, legendCodeById };
      const code = encodeBuildChatCode(builder, catalog);
      if (!code) {
        setNotice({ tone: "error", message: "Chat code is not supported for this profession." });
        return;
      }
      await copyText(code, "GW2 chat code copied.");
    } catch {
      setNotice({ tone: "error", message: "Chat code could not be created yet." });
    }
  }

  function hydrateImportedBuild(value: unknown, name?: string): SavedBuilderBuild {
    const state = builderFromAxiBuild(value, { name: name ?? "Imported Build" });
    const code = encodeAxiForgeBuildCode(value);
    return createSavedBuild(state, code);
  }

  async function hydrateSharedComposition(value: unknown) {
    const decoded = value as { name?: string; gameMode?: string; builds?: unknown[]; partyLines?: Array<{ capacity?: number; slots?: unknown[] }>; failedBuildCount?: number };
    const importedBuilds = (decoded.builds ?? []).map((entry, index) => hydrateImportedBuild(entry, `Imported ${index + 1}`));
    const fingerprint = (entry: unknown) => JSON.stringify(entry);
    const sourceByFingerprint = new Map((decoded.builds ?? []).map((entry, index) => [fingerprint(entry), importedBuilds[index]?.id ?? null]));
    const composition = createComposition(decoded.name || "Shared Squad");
    composition.gameMode = decoded.gameMode === "pve" ? "pve" : "wvw";
    composition.parties = (decoded.partyLines ?? []).map((line, index) => ({
    id: createBuilderId(),
    name: `Subgroup ${index + 1}`,
    slots: Array.from({ length: Math.max(1, Math.min(10, line.capacity ?? 5)) }, (_, slotIndex) => sourceByFingerprint.get(fingerprint(line.slots?.[slotIndex])) ?? null),
    }));
    setWorkspace((current) => ({ ...current, builds: [...importedBuilds, ...current.builds], compositions: [composition, ...current.compositions], activeCompositionId: composition.id }));
    setActiveTab("squad");
    setNotice({ tone: decoded.failedBuildCount ? "warning" : "success", message: decoded.failedBuildCount ? `Squad imported; ${decoded.failedBuildCount} build payloads could not be read.` : "Loaded a shared squad. This is your own local copy - edit it or save it to keep it." });
    clearAxiForgeShareQuery();
    }
    
    async function importAxiCode() {
    const result = decodeAxiForgeCode(importCode);
    if (!result.ok || !result.value) {
      setNotice({ tone: "error", message: result.error ?? "Unsupported Entropy code." });
      return;
    }
    if (result.kind === "build") {
      const imported = builderFromAxiBuild(result.value, { name: "Imported Build" });
      updateBuilder(imported);
      setEditingBuildId(null);
      setActiveTab("build");
      setImportOpen(false);
      setNotice({ tone: "success", message: "Build imported with traits, skills, equipment, and profession settings." });
      return;
    }

    const decoded = result.value as { name?: string; gameMode?: string; builds?: unknown[]; partyLines?: Array<{ capacity?: number; slots?: unknown[] }>; failedBuildCount?: number };
    const importedBuilds = (decoded.builds ?? []).map((value, index) => hydrateImportedBuild(value, `Imported ${index + 1}`));
    const fingerprint = (value: unknown) => JSON.stringify(value);
    const sourceByFingerprint = new Map((decoded.builds ?? []).map((value, index) => [fingerprint(value), importedBuilds[index]?.id ?? null]));
    const composition = createComposition(decoded.name || "Imported Squad");
    composition.gameMode = decoded.gameMode === "pve" ? "pve" : "wvw";
    composition.parties = (decoded.partyLines ?? []).map((line, index) => ({
      id: createBuilderId(),
      name: `Subgroup ${index + 1}`,
      slots: Array.from({ length: Math.max(1, Math.min(10, line.capacity ?? 5)) }, (_, slotIndex) => sourceByFingerprint.get(fingerprint(line.slots?.[slotIndex])) ?? null),
    }));
    setWorkspace((current) => ({ ...current, builds: [...importedBuilds, ...current.builds], compositions: [composition, ...current.compositions], activeCompositionId: composition.id }));
    setActiveTab("squad");
    setImportOpen(false);
    setNotice({ tone: decoded.failedBuildCount ? "warning" : "success", message: decoded.failedBuildCount ? `Squad imported; ${decoded.failedBuildCount} build payloads could not be read.` : "Squad and its builds imported into the local workspace." });
  }

  async function importBuildInput() {
    if (gw2ChatCodeInput) {
      setImportBusy(true);
      try {
        const imported = await importGw2BuildChatCode(importCode, { legends });
        updateBuilder(imported);
        setEditingBuildId(null);
        setActiveTab("build");
        setImportOpen(false);
        setNotice({ tone: "success", message: "GW2 build code imported with profession, traits, skills, and profession settings." });
      } catch (error) {
        setNotice({ tone: "error", message: error instanceof Error ? error.message : "The GW2 build code could not be imported." });
      } finally {
        setImportBusy(false);
      }
      return;
    }
    if (!gw2SkillsInput) {
      await importAxiCode();
      return;
    }
    setImportBusy(true);
    try {
      const result = await importGw2SkillsBuild(importCode, {
        itemStatNames: itemStats.map((stat) => stat.name),
        legends,
      });
      updateBuilder(result.state);
      setEditingBuildId(null);
      setActiveTab("build");
      setImportOpen(false);
      setNotice({
        tone: result.warnings.length ? "warning" : "success",
        message: result.warnings.length
          ? `Build imported. ${result.warnings.join(" ")}`
          : "gw2skills build imported with traits, skills, equipment, and consumables.",
      });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "The gw2skills build could not be imported." });
    } finally {
      setImportBusy(false);
    }
  }

  function loadBuild(build: SavedBuilderBuild) {
    updateBuilder(cloneBuilder(build.state));
    setEditingBuildId(build.id);
    setExportCode(build.shareCode);
    setActiveTab("build");
    setNotice({ tone: "success", message: `Opened ${build.name}.` });
  }

  function openBuildViewer(build: SavedBuilderBuild) {
    const url = new URL(window.location.href);
    url.searchParams.set("builderBuild", build.id);
    if (viewingBuildId) window.history.replaceState(window.history.state, "", url);
    else {
      window.history.pushState(window.history.state, "", url);
      viewerHistoryPushedRef.current = true;
    }
    setViewingBuildId(build.id);
  }

  function closeBuildViewer() {
    if (viewerHistoryPushedRef.current) {
      viewerHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("builderBuild");
    window.history.replaceState(window.history.state, "", url);
    setViewingBuildId(null);
  }

  function editViewedBuild(build: SavedBuilderBuild) {
    const url = new URL(window.location.href);
    url.searchParams.delete("builderBuild");
    window.history.replaceState(window.history.state, "", url);
    viewerHistoryPushedRef.current = false;
    setViewingBuildId(null);
    loadBuild(build);
  }

  function duplicateBuild(build: SavedBuilderBuild) {
    const state = cloneBuilder(build.state);
    state.name = `${state.name} Copy`;
    const duplicate = createSavedBuild(state, build.shareCode);
    setWorkspace((current) => ({ ...current, builds: [duplicate, ...current.builds] }));
  }

  function removeBuild(id: string) {
    const removed = workspace.builds.find((build) => build.id === id);
    const assignmentCount = workspace.compositions.reduce(
      (total, composition) => total + composition.parties.reduce(
        (partyTotal, party) => partyTotal + party.slots.filter((slot) => slot === id).length,
        0,
      ),
      0,
    );
    setWorkspace((current) => ({
      ...current,
      builds: current.builds.filter((build) => build.id !== id),
      compositions: current.compositions.map((composition) => ({ ...composition, parties: composition.parties.map((party) => ({ ...party, slots: party.slots.map((slot) => slot === id ? null : slot) })) })),
    }));
    if (editingBuildId === id) setEditingBuildId(null);
    if (removed) {
      setNotice({
        tone: "success",
        message: assignmentCount
          ? `${removed.name} was deleted and removed from ${assignmentCount} squad slot${assignmentCount === 1 ? "" : "s"}.`
          : `${removed.name} was deleted from the local library.`,
      });
    }
  }

  function createSquad() {
    const composition = createComposition();
    setWorkspace((current) => ({ ...current, compositions: [composition, ...current.compositions], activeCompositionId: composition.id }));
  }

  function updateComposition(composition: BuilderComposition) {
    setWorkspace((current) => ({ ...current, compositions: current.compositions.map((item) => item.id === composition.id ? composition : item) }));
  }

  async function createSquadCode(): Promise<string | null> {
    if (!activeComposition) return null;
    const referencedIds = new Set(activeComposition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id)));
    const decodedBuilds: Record<string, unknown> = {};
    for (const id of referencedIds) {
      const saved = workspace.builds.find((build) => build.id === id);
      if (!saved) throw new Error("One assigned build is no longer available in the library.");
      const result = decodeAxiForgeCode(saved.shareCode);
      const state = result.ok && result.value
        ? builderFromAxiBuild(result.value, saved.state)
        : cloneBuilder(saved.state);
      const specIds = state.specializationIds.filter((value): value is number => Boolean(value));
      const specs = await fetchGw2Specializations(specIds);
      const traits = await fetchGw2Traits(specs.flatMap((spec) => spec.major_traits));
      const bySpec = new Map<number, Gw2Trait[]>();
      traits.forEach((trait) => bySpec.set(trait.specialization, [...(bySpec.get(trait.specialization) ?? []), trait]));
      decodedBuilds[id] = buildAxiShape(state, new Map(specs.map((spec) => [spec.id, spec])), bySpec, new Map());
    }
    return encodeAxiForgeCompCode({ name: activeComposition.name, gameMode: activeComposition.gameMode, partyLines: activeComposition.parties.map((party) => ({ capacity: party.slots.length, slots: party.slots.filter((id): id is string => Boolean(id)) })) }, decodedBuilds);
  }

  async function exportSquad() {
    try {
      const code = await createSquadCode();
      if (!code) throw new Error("Squad code could not be created.");
      setExportCode(code);
      await copyText(code, "Entropy squad code copied.");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Squad code could not be created." });
    }
  }

  async function shareSquad() {
    try {
      const code = await createSquadCode();
      if (!code) throw new Error("Squad code could not be created.");
      setExportCode(code);
      const url = buildAxiForgeShareUrl(code);
      if (url.length > 7500) {
        setNotice({ tone: "warning", message: 'This squad is too large for a share link. Use "Copy squad code" and share the Entropy code instead.' });
        return;
      }
      await copyText(url, "Squad share link copied.");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Squad share link could not be created." });
    }
    }
    
    const availableSkills = useMemo(
      () => availableProfessionSkills(professionSkills, builder.specializationIds),
      [builder.specializationIds, professionSkills],
    );
    const availableLegends = useMemo(
      () => availableRevenantLegends(legends, builder.specializationIds, skillsById),
      [builder.specializationIds, legends, skillsById],
    );
    const skillGroups = useMemo(() => ({ Heal: availableSkills.filter((skill) => skill.slot === "Heal"), Utility: availableSkills.filter((skill) => skill.slot === "Utility"), Elite: availableSkills.filter((skill) => skill.slot === "Elite") }), [availableSkills]);
  const engineerKitOptions = useMemo(
    () => professionSkills.filter((skill) => skill.name.toLowerCase().includes("kit")),
    [professionSkills],
  );
  const thiefArtifactOptions = useMemo(
    () => professionSkills.filter((skill) => skill.slot === "Profession"),
    [professionSkills],
  );
  const workbenchTabs = [
    { id: "build", label: "Build", icon: Swords, count: issues.length },
    { id: "library", label: "Library", icon: Archive, count: workspace.builds.length },
    { id: "squad", label: "Squad", icon: Users, count: activeComposition?.parties.reduce((total, party) => total + party.slots.filter(Boolean).length, 0) ?? 0 },
  ] as const;
  const builderViewModes = BUILDER_SECTIONS.map((section) => section.id);

  return (
    <div className="theme-builder-root">
      <header className="theme-builder-command-deck">
        <div className="theme-builder-title-block">
          <div className="theme-builder-mark"><Wrench className="h-5 w-5" /></div>
          <div>
            <div className="theme-builder-kicker">Guild Wars 2 loadout workshop</div>
            <div className="theme-builder-title-line">
              <h2>Entropy Builder</h2>
              {catalogSource && <span className="theme-builder-catalog-state">{catalogSource === "cache" ? "Catalog cached" : "Catalog live"}</span>}
            </div>
          </div>
        </div>
        <div className="theme-builder-command-actions">
          <button
            type="button"
            onClick={() => setImportOpen((open) => !open)}
            aria-expanded={importOpen}
            aria-controls="builder-import-rack"
            aria-label={importOpen ? "Hide build import panel" : "Show build import panel"}
            className="theme-command-button"
          >
            <Download className="h-4 w-4" /> Import
          </button>
          <details ref={exportMenuRef} className="theme-builder-export-menu">
            <summary className="theme-command-button"><Share2 className="h-4 w-4" /> Export</summary>
            <div role="menu" aria-label="Export build">
              <button type="button" role="menuitem" onClick={() => { exportCurrentBuild(); exportMenuRef.current?.removeAttribute("open"); }}><FileCode2 className="h-4 w-4" /><span><strong>Entropy code</strong><small>Copy a portable build code</small></span></button>
              <button type="button" role="menuitem" onClick={() => { exportChatCode(); exportMenuRef.current?.removeAttribute("open"); }}><Clipboard className="h-4 w-4" /><span><strong>Chat code</strong><small>Copy a Guild Wars 2 build code</small></span></button>
              <button type="button" role="menuitem" onClick={() => { shareCurrentBuild(); exportMenuRef.current?.removeAttribute("open"); }}><Link2 className="h-4 w-4" /><span><strong>Share link</strong><small>Copy a link to this build</small></span></button>
            </div>
          </details>
          <button type="button" onClick={saveCurrentBuild} className="theme-command-button is-primary"><Save className="h-4 w-4" /> {editingBuildId ? "Update" : "Save"}</button>
        </div>
      </header>

      <nav className="theme-builder-tabs" role="tablist" aria-label="Builder workspaces">
        {workbenchTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            id={`builder-tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`builder-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => moveTabFocus(workbenchTabs.map((item) => item.id), tab.id, event, setActiveTab, (item) => `builder-tab-${item}`)}
          >
            <tab.icon className="h-4 w-4" /><span>{tab.label}</span><strong>{tab.count}</strong>
          </button>
        ))}
        <div className="theme-builder-mode-switch" role="group" aria-label="Build game mode">
          {GAME_MODES.map((mode) => <button key={mode.id} type="button" aria-pressed={builder.gameMode === mode.id} className={builder.gameMode === mode.id ? "is-active" : ""} onClick={() => updateBuilder((current) => ({ ...current, gameMode: mode.id }))}>{mode.label}</button>)}
        </div>
      </nav>

      {importOpen && (
        <section id="builder-import-rack" className="theme-builder-import-rack">
          <div><FieldLabel>Paste an Entropy code, GW2 build code, or gw2skills.net URL</FieldLabel><textarea aria-label="Entropy code, GW2 build code, or gw2skills.net URL" value={importCode} onChange={(event) => setImportCode(event.target.value)} placeholder="<Entropy:...>, [&DQ...], or https://en.gw2skills.net/editor/?..." spellCheck={false} /></div>
          <div className="theme-builder-import-actions"><span className={detectedKind === "unknown" && !gw2SkillsInput && !gw2ChatCodeInput ? "" : "is-ready"}>{gw2ChatCodeInput ? "GW2 build code detected" : gw2SkillsInput ? "gw2skills build detected" : kindLabel(detectedKind)}</span><button type="button" onClick={() => { setImportCode(""); setImportOpen(false); }}><Eraser className="h-4 w-4" /> Clear</button><button type="button" onClick={importBuildInput} disabled={importBusy || (detectedKind === "unknown" && !gw2SkillsInput && !gw2ChatCodeInput)}>{importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Import</button></div>
        </section>
      )}

      {(loading || catalogError || notice) && (
        <div
          className={`theme-builder-notice ${catalogError || notice?.tone === "error" ? "is-error" : notice?.tone === "warning" ? "is-warning" : "is-success"}`}
          role={catalogError || notice?.tone === "error" ? "alert" : "status"}
          aria-live={catalogError || notice?.tone === "error" ? "assertive" : "polite"}
        >
          {loading && !catalogError ? <Loader2 className="h-4 w-4 animate-spin" /> : catalogError || notice?.tone === "error" ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          <span>{catalogError ?? notice?.message ?? "Loading live Guild Wars 2 catalog..."}</span>
          {notice && <button type="button" onClick={() => setNotice(null)} title="Dismiss" aria-label="Dismiss Builder notice"><X className="h-4 w-4" /></button>}
        </div>
      )}

      {activeTab === "library" && (
        <div id="builder-panel-library" role="tabpanel" aria-labelledby="builder-tab-library">
          <BuildLibrary builds={workspace.builds} onLoad={openBuildViewer} onDuplicate={duplicateBuild} onDelete={removeBuild} onCopy={(code) => copyText(brandEntropyCode(code), "Entropy build code copied.")} onShare={(code) => copyText(buildAxiForgeShareUrl(code), "Share link copied.")} specsById={allSpecsById} />
        </div>
      )}
      {activeTab === "squad" && (
        <div id="builder-panel-squad" role="tabpanel" aria-labelledby="builder-tab-squad">
          <SquadWorkspace composition={activeComposition} builds={workspace.builds} coverageBuilds={squadCoverageBuilds} boonCache={boonCache} boonComputing={boonComputing} conditionCache={conditionCache} conditionComputing={conditionComputing} utilityCache={utilityCache} utilityComputing={utilityComputing} onCreate={createSquad} onChange={updateComposition} onOpenBuild={openBuildViewer} onCopyCode={exportSquad} onShareCode={shareSquad} specsById={allSpecsById} />
        </div>
      )}

      {activeTab === "build" && (
        <div id="builder-panel-build" role="tabpanel" aria-labelledby="builder-tab-build" className={`theme-builder-layout${detailRailOpen ? " is-rail-open" : " is-rail-collapsed"}`}>
          <main className="space-y-5">
          <div className="theme-builder-mode-toggle" role="tablist" aria-label="Build editor sections">
            {BUILDER_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                id={`builder-view-tab-${section.id}`}
                role="tab"
                aria-selected={builderViewMode === section.id}
                aria-controls="builder-view-panel"
                tabIndex={builderViewMode === section.id ? 0 : -1}
                className={builderViewMode === section.id ? "is-active" : ""}
                onClick={() => setBuilderViewMode(section.id)}
                onKeyDown={(event) => moveTabFocus(builderViewModes, section.id, event, setBuilderViewMode, (item) => `builder-view-tab-${item}`)}
              >
                <span>{section.label}</span>
                {section.id !== "notes" && (
                  <span
                    className={`theme-builder-mode-status ${builderSectionIssueCounts[section.id] === 0 ? "is-complete" : ""}`}
                    aria-label={builderSectionIssueCounts[section.id] === 0
                      ? `${section.label} complete`
                      : `${builderSectionIssueCounts[section.id]} ${builderSectionIssueCounts[section.id] === 1 ? "issue" : "issues"} in ${section.label}`}
                  >
                    {builderSectionIssueCounts[section.id] === 0
                      ? <Check className="h-3 w-3" aria-hidden="true" />
                      : builderSectionIssueCounts[section.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div key={builderViewMode} id="builder-view-panel" role="tabpanel" aria-labelledby={`builder-view-tab-${builderViewMode}`} className="theme-builder-mode-content">
          {builderViewMode === "overview" && (
            <section className="theme-builder-loadout-canvas theme-builder-overview-canvas">
              <header className="theme-builder-canvas-header">
                <div className="theme-builder-canvas-identity">
                  {selectedProfession && <ClassIcon name={selectedProfession.name} size="lg" />}
                  <div>
                    <div className="theme-builder-kicker">Build profile · {builder.gameMode.toUpperCase()}</div>
                    <h3>{builder.name.trim() || "Untitled build"}</h3>
                  </div>
                </div>
                <button type="button" className="theme-quiet-button theme-builder-canvas-reset" aria-label="Reset build draft" title="Reset build draft" onClick={() => { updateBuilder(createEmptyBuilder(builder.professionId)); setEditingBuildId(null); setExportCode(""); }}><RotateCcw className="h-4 w-4" /> Reset</button>
              </header>

              <div className="theme-builder-canvas-stage is-identity">
                <div className="theme-builder-canvas-stage-head"><div><div className="theme-builder-kicker">Identity</div><h4>{editingBuildId ? "Saved build details" : "Draft details"}</h4></div></div>
                <div className="grid gap-3 md:grid-cols-[minmax(16rem,1.5fr)_minmax(10rem,.7fr)_minmax(14rem,1fr)]">
                <label><FieldLabel>Build name</FieldLabel><TextField value={builder.name} onChange={(event) => updateBuilder((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="theme-builder-role-field"><FieldLabel>Role</FieldLabel><select className="theme-builder-input" aria-label="Build role" value={builder.role} onChange={(event) => updateBuilder((current) => ({ ...current, role: event.target.value }))}>{ROLE_OPTIONS.map((role) => <option key={role || "none"} value={role}>{role || "No role"}</option>)}</select></label>
                <label><FieldLabel>Tags, comma separated</FieldLabel><TextField value={builder.tags.join(", ")} onChange={(event) => updateBuilder((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} placeholder="zerg, cleanse, guild" /></label>
                </div>
              </div>

              <div className="theme-builder-canvas-stage is-profession">
                <div className="theme-builder-canvas-stage-head"><div><div className="theme-builder-kicker">Character chassis</div><h4>Profession</h4></div><span className="theme-builder-stage-value">{selectedProfession?.name ?? "Not selected"}</span></div>
                <div className="theme-builder-professions">
                  {professions.map((profession) => (
                    <button key={profession.id} type="button" aria-pressed={builder.professionId === profession.id} className={builder.professionId === profession.id ? "is-active" : ""} onClick={() => chooseProfession(profession)} onFocus={() => setSelectedSummary({ kind: "profession", item: profession })} onMouseEnter={() => setSelectedSummary({ kind: "profession", item: profession })}>
                      <span><ClassIcon name={profession.name} size="lg" /></span><strong>{profession.name}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {builderViewMode === "traits" && (
            <div className="theme-panel theme-builder-loadout-canvas">
              <header className="theme-builder-canvas-header">
                <div className="theme-builder-canvas-identity">
                  {selectedProfession && <ClassIcon name={equipmentSpecialization} size="lg" />}
                  <div>
                    <div className="theme-builder-kicker">{equipmentSpecialization} · {builder.gameMode.toUpperCase()}</div>
                    <h3>{builder.name.trim() || "Untitled build"}</h3>
                    <div className="theme-builder-canvas-meta" aria-label="Build loadout summary">
                      <span>{builder.role || "Role open"}</span>
                      <span>{activeEquipmentWeapons || "Weapons open"}</span>
                    </div>
                  </div>
                </div>
                <div className="theme-builder-canvas-status"><span>Loadout</span><strong>{6 - Math.min(6, issues.length)}/6</strong></div>
              </header>

              <div className="theme-builder-canvas-stage is-combat">
                <div className="theme-builder-canvas-stage-head"><h4>Combat bar</h4><ArrowLeftRight className="h-4 w-4" /></div>
                <BuildCombatBar
                  builder={builder}
                  profession={selectedProfession}
                  specsById={specsById}
                  skillsById={skillsById}
                  legends={legends}
                  pets={pets}
                  health={attributeTotals.health}
                  weaponSet={displayedWeaponSet}
                  onSwap={() => setDisplayedWeaponSet((current) => current === 1 ? 2 : 1)}
                  onInspect={(skill) => inspectBuilderItem({ kind: "skill", item: skill })}
                  onInspectPet={(pet) => inspectBuilderItem({ kind: "pet", item: pet })}
                />
              </div>

              <div className="theme-builder-canvas-stage">
              <div className="theme-builder-canvas-stage-head"><h4>Specializations</h4><Layers3 className="h-4 w-4" /></div>
              <div className="theme-builder-spec-stack">
                {[0, 1, 2].map((trackIndex) => {
                  const selectedSpecId = builder.specializationIds[trackIndex];
                  const selectedSpec = selectedSpecId ? specsById.get(selectedSpecId) : null;
                  return (
                    <div
                      key={trackIndex}
                      className={`theme-builder-spec-line ${selectedSpec ? "is-selected" : "is-empty"} ${selectedSpec?.elite ? "is-elite" : ""}`}
                      style={selectedSpec?.background ? { "--builder-spec-art": `url("${selectedSpec.background}")` } as React.CSSProperties : undefined}
                    >
                      <div className="theme-builder-spec-selector">
                        <span>{String(trackIndex + 1).padStart(2, "0")}</span>
                        <ChoicePickerField
                          id={`builder-spec-${trackIndex}`}
                          label={`Track ${trackIndex + 1}`}
                          value={selectedSpecId ? String(selectedSpecId) : ""}
                          choices={professionSpecs.map((spec) => {
                            const isUsedElsewhere = builder.specializationIds.some((id, index) => index !== trackIndex && id === spec.id);
                            const eliteUsedElsewhere = spec.elite && builder.specializationIds.some((id, index) => index !== trackIndex && Boolean(id && specsById.get(id)?.elite));
                            return {
                              value: String(spec.id),
                              label: spec.name,
                              icon: spec.icon,
                              group: spec.elite ? "Elite" : "Core",
                              meta: spec.elite ? "Elite specialization" : "Core specialization",
                              disabled: isUsedElsewhere || eliteUsedElsewhere,
                              disabledReason: isUsedElsewhere ? "Already equipped" : eliteUsedElsewhere ? "Elite already equipped" : undefined,
                            };
                          })}
                          onChange={(value) => chooseSpec(trackIndex, value ? Number(value) : null)}
                          onPreview={(value) => {
                            const spec = specsById.get(Number(value));
                            if (spec) setSelectedSummary({ kind: "specialization", item: spec });
                          }}
                          placeholder="Choose specialization"
                          clearLabel="Clear specialization"
                        />
                        {selectedSpec?.icon && (
                          <button
                            className="theme-builder-spec-inspect"
                            type="button"
                            onClick={() => inspectBuilderItem({ kind: "specialization", item: selectedSpec })}
                            aria-label={`Inspect ${selectedSpec.name} specialization`}
                            title={`Inspect ${selectedSpec.name} specialization`}
                          >
                            <BookOpen className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <div className="theme-builder-trait-grid">
                        {[1, 2, 3].map((tier) => {
                          const traits = (selectedSpecId ? traitsBySpecId.get(selectedSpecId) ?? [] : []).filter((trait) => trait.slot === "Major" && trait.tier === tier).sort((a, b) => a.order - b.order);
                          const selectedPosition = builder.traitChoices[trackIndex][tier - 1];
                          const selectedTrait = selectedPosition ? traits[selectedPosition - 1] : null;
                          return (
                            <div key={tier} className={`theme-builder-trait-tier ${selectedTrait ? "has-selection" : ""}`}>
                              <div className="theme-builder-trait-tier-head"><span>Tier {tier}</span><strong>{selectedTrait?.name ?? "Choose trait"}</strong></div>
                              <div>{traits.map((trait, position) => <button key={trait.id} type="button" aria-label={`Choose ${trait.name} trait`} aria-pressed={selectedPosition === position + 1} className={selectedPosition === position + 1 ? "is-active" : ""} onClick={() => chooseTrait(trackIndex, tier, position + 1, trait)} onFocus={() => setSelectedSummary({ kind: "trait", item: trait })} onMouseEnter={() => setSelectedSummary({ kind: "trait", item: trait })} title={trait.name}>{trait.icon ? <img src={trait.icon} alt="" /> : position + 1}</button>)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              <div className="theme-builder-canvas-stage is-utility">
              <div className="theme-builder-canvas-stage-head"><h4>Utility skills</h4><Swords className="h-4 w-4" /></div>
              <div className="theme-builder-skill-bar">
                <SkillPicker label="Heal" slot="Heal" selectedId={builder.healSkillId} skills={skillGroups.Heal} allSkills={professionSkills} usedIds={[]} onChange={(id) => chooseSkill("Heal", id)} onInspect={(skill) => setSelectedSummary({ kind: "skill", item: skill })} />
                {[0, 1, 2].map((index) => <SkillPicker key={index} label={`Utility ${index + 1}`} slot="Utility" selectedId={builder.utilitySkillIds[index]} skills={skillGroups.Utility} allSkills={professionSkills} usedIds={builder.utilitySkillIds} onChange={(id) => chooseSkill("Utility", id, index)} onInspect={(skill) => setSelectedSummary({ kind: "skill", item: skill })} />)}
                <SkillPicker label="Elite" slot="Elite" selectedId={builder.eliteSkillId} skills={skillGroups.Elite} allSkills={professionSkills} usedIds={[]} onChange={(id) => chooseSkill("Elite", id)} onInspect={(skill) => setSelectedSummary({ kind: "skill", item: skill })} />
              </div>
              </div>
            </div>
          )}

          {builderViewMode === "equipment" && (
            <section className="theme-builder-loadout-canvas theme-builder-equipment-workspace">
              <header className="theme-builder-canvas-header">
                <div className="theme-builder-canvas-identity">
                  {selectedProfession && <ClassIcon name={equipmentSpecialization} size="lg" />}
                  <div>
                    <div className="theme-builder-kicker">{equipmentSpecialization} · {builder.gameMode.toUpperCase()}</div>
                    <h3>{builder.name.trim() || "Untitled build"}</h3>
                    <div className="theme-builder-canvas-meta" aria-label="Build loadout summary">
                      <span>{builder.role || "Role open"}</span>
                      <span>{activeEquipmentWeapons || "Weapons open"}</span>
                    </div>
                  </div>
                </div>
                <div className="theme-builder-canvas-status">
                  <span>Stat doctrine</span>
                  <strong>{builder.equipment.statPackage || "Unassigned"}</strong>
                  <small>Active set {builder.activeWeaponSet === 2 ? "II" : "I"}</small>
                </div>
              </header>
              <nav className="theme-builder-equipment-nav" role="tablist" aria-label="Equipment editor sections">
                {EQUIPMENT_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    id={`builder-equipment-tab-${section.id}`}
                    type="button"
                    role="tab"
                    aria-selected={equipmentSection === section.id}
                    aria-controls="builder-equipment-editor"
                    tabIndex={equipmentSection === section.id ? 0 : -1}
                    className={equipmentSection === section.id ? "is-active" : ""}
                    onClick={() => setEquipmentSection(section.id)}
                    onKeyDown={(event) => moveTabFocus(EQUIPMENT_SECTIONS.map((item) => item.id), section.id, event, setEquipmentSection, (item) => `builder-equipment-tab-${item}`)}
                  >
                    {section.id === "weapons" ? <Swords className="h-4 w-4" /> : section.id === "armor" ? <Shield className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    <span>{section.label}</span>
                  </button>
                ))}
              </nav>
              <div id="builder-equipment-editor" role="tabpanel" aria-labelledby={`builder-equipment-tab-${equipmentSection}`} className="theme-builder-equipment-grid is-focused">
                <div className="theme-builder-equipment-group is-weapons" hidden={equipmentSection !== "weapons"}>
                  <h4>Weapons and stats</h4>
                  <ChoicePickerField
                    id="builder-stat-package"
                    label="Stat package"
                    value={builder.equipment.statPackage}
                    choices={statOptions.filter(Boolean).map((stat) => ({ value: stat, label: stat, group: (QUICK_STAT_OPTIONS as readonly string[]).includes(stat) ? "Common" : "All stats" }))}
                    onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, statPackage: value } }))}
                    placeholder="Choose stats"
                    clearLabel="Clear stat package"
                  />
                  <div className="theme-builder-stat-picks" role="group" aria-label="Quick stat packages">
                    {QUICK_STAT_OPTIONS.filter((stat) => statOptions.includes(stat)).map((stat) => (
                      <button
                        key={stat}
                        type="button"
                        aria-pressed={builder.equipment.statPackage === stat}
                        className={builder.equipment.statPackage === stat ? "is-active" : ""}
                        onClick={() => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, statPackage: stat } }))}
                      >
                        {stat.replace("'s", "")}
                      </button>
                    ))}
                  </div>
                  <div className="theme-builder-weapon-sets">
                    {([1, 2] as const).map((set) => (
                      <section key={set} className="theme-builder-weapon-set" aria-labelledby={`builder-weapon-set-${set}`}>
                        <h5 id={`builder-weapon-set-${set}`}>Weapon set {set === 1 ? "I" : "II"}{builder.activeWeaponSet === set && <b>Active</b>}</h5>
                        <div className="grid grid-cols-2 gap-2">
                          {([`mainhand${set}`, `offhand${set}`] as const).map((slot) => {
                            const currentWeapon = builder.equipment.weapons[slot];
                            const validWeapons = availableWeapons.filter(([, weapon]) => weaponFitsBuilderSlot(weapon, slot));
                            const currentIsValid = !currentWeapon || validWeapons.some(([name]) => name.toLowerCase() === currentWeapon.toLowerCase());
                            const mainhand = builder.equipment.weapons[`mainhand${set}`];
                            const offhandDisabled = slot.startsWith("offhand") && isTwoHandedWeapon(selectedProfession, mainhand);
                            return (
                              <div key={slot}>
                                <ChoicePickerField
                                  id={`builder-weapon-${slot}`}
                                  label={slot.startsWith("mainhand") ? "Main hand" : "Off hand"}
                                  value={currentWeapon}
                                  disabled={offhandDisabled}
                                  disabledLabel="Two-handed weapon equipped"
                                  choices={[
                                    ...(!currentIsValid ? [{ value: currentWeapon, label: currentWeapon, group: "Imported", meta: "Unavailable for this slot" }] : []),
                                    ...validWeapons.map(([name, weapon]) => ({
                                      value: name.toLowerCase(),
                                      label: name,
                                      icon: builderWeaponIcon(name),
                                      group: weapon.flags?.includes("TwoHand") ? "Two-handed" : slot.startsWith("mainhand") ? "Main hand" : "Off hand",
                                      meta: weapon.specialization ? "Elite weapon" : "Profession weapon",
                                    })),
                                  ]}
                                  onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, weapons: { ...current.equipment.weapons, [slot]: value } } }))}
                                  placeholder={offhandDisabled ? "Two-handed weapon equipped" : "Choose weapon"}
                                  clearLabel="Clear weapon"
                                  emptyIcon={<Swords className="h-4 w-4" aria-hidden="true" />}
                                />
                                <ChoicePickerField
                                  id={`builder-weapon-stat-${slot}`}
                                  label="Stat override"
                                  value={builder.equipment.slots[slot] || ""}
                                  disabled={offhandDisabled}
                                  disabledLabel="Unavailable with a two-handed weapon"
                                  choices={statOptions.filter(Boolean).map((stat) => ({ value: stat, label: stat, group: (QUICK_STAT_OPTIONS as readonly string[]).includes(stat) ? "Common" : "All stats" }))}
                                  onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, slots: { ...current.equipment.slots, [slot]: value } } }))}
                                  placeholder="Use doctrine stats"
                                  clearLabel="Use doctrine stats"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
                <div className="theme-builder-equipment-stack is-gear" hidden={equipmentSection !== "armor" && equipmentSection !== "upgrades"}>
                  <div className="theme-builder-equipment-group is-armor" hidden={equipmentSection !== "armor"}>
                    <h4>Armor stats</h4>
                    <span className="theme-builder-choice-note">Each slot uses the doctrine stat package unless you set an override.</span>
                    <div className="theme-builder-armor-stat-grid">
                      {ARMOR_SLOTS.map((slot) => (
                        <ChoicePickerField
                          key={slot}
                          id={`builder-armor-stat-${slot}`}
                          label={ARMOR_SLOT_LABELS[slot]}
                          value={builder.equipment.slots[slot] || ""}
                          choices={statOptions.filter(Boolean).map((stat) => ({ value: stat, label: stat, group: (QUICK_STAT_OPTIONS as readonly string[]).includes(stat) ? "Common" : "All stats" }))}
                          onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, slots: { ...current.equipment.slots, [slot]: value } } }))}
                          placeholder="Use doctrine stats"
                          clearLabel="Use doctrine stats"
                          emptyIcon={<EquipmentArtwork src={BUILDER_ARMOR_SLOT_ICONS[slot]} fallback={<Shield className="h-4 w-4" />} label={`${ARMOR_SLOT_LABELS[slot]} slot`} />}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="theme-builder-equipment-group is-trinkets" hidden={equipmentSection !== "armor"}>
  <h4>Trinkets</h4>
  <div className="theme-builder-trinket-grid grid grid-cols-2 gap-2">
    {["amulet", "ring1", "ring2", "accessory1", "accessory2", "backpack"].map((trinketSlot) => {
      const current = builder.equipment.slots[trinketSlot] || "";
      return (
        <div key={trinketSlot}>
          <ChoicePickerField
            id={`builder-trinket-stat-${trinketSlot}`}
            label={trinketSlot}
            value={current}
            choices={statOptions.filter(Boolean).map((stat) => ({ value: stat, label: stat, group: (QUICK_STAT_OPTIONS as readonly string[]).includes(stat) ? "Common" : "All stats" }))}
            onChange={(value) => updateBuilder((next) => ({ ...next, equipment: { ...next.equipment, slots: { ...next.equipment.slots, [trinketSlot]: value } } }))}
            placeholder="Use doctrine stats"
            clearLabel="Use doctrine stats"
            emptyIcon={<EquipmentArtwork src={BUILDER_TRINKET_SLOT_ICONS[trinketSlot]} fallback={<Sparkles className="h-4 w-4" />} label={`${trinketSlot} slot`} />}
          />
          {!current && <span className="theme-builder-choice-note">Unassigned</span>}
        </div>
      );
    })}
  </div>
</div>
                  <div className="theme-builder-equipment-group is-upgrades" hidden={equipmentSection !== "upgrades"}>
                    <h4>Runes and sigils</h4>
                  {hasMixedRunes ? (
                    <div className="theme-builder-split-runes">
                      <span className="theme-builder-choice-note"><Layers3 className="h-3.5 w-3.5" /> Mixed imported rune set — each armor slot remains editable.</span>
                      {ARMOR_SLOTS.map((slot) => <ItemPickerField key={slot} id={`builder-rune-${slot}`} label={`${slot} rune`} value={builder.equipment.runes[slot]} valueKind="id" choices={BUILDER_RUNE_CHOICES} items={equipmentItems} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, runes: { ...current.equipment.runes, [slot]: value } } }))} placeholder="Choose rune" />)}
                    </div>
                  ) : (
                    <ItemPickerField id="builder-rune-all" label="Armor rune" value={builder.equipment.runes.head} valueKind="id" choices={BUILDER_RUNE_CHOICES} items={equipmentItems} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, runes: Object.fromEntries(ARMOR_SLOTS.map((slot) => [slot, value])) as EntropyBuilderState["equipment"]["runes"] } }))} placeholder="Choose rune" />
                  )}
                  {(["mainhand1", "mainhand2"] as const).map((slot) => { const current = builder.equipment.sigils[slot]; return (
  <div key={slot} className="theme-builder-sigil-pair">
    <FieldLabel>{slot === "mainhand1" ? "Weapon set I sigils" : "Weapon set II sigils"}</FieldLabel>
    <div className="grid grid-cols-2 gap-2">
      {[0, 1].map((sigilIndex) => (
        <ItemPickerField
          key={sigilIndex}
          id={`builder-sigil-${slot}-${sigilIndex}`}
          label={`Sigil ${sigilIndex + 1}`}
          value={current[sigilIndex] ?? ""}
          valueKind="id"
          choices={BUILDER_SIGIL_CHOICES}
          items={equipmentItems}
          onChange={(value) => updateBuilder((next) => {
            const nextValues = [...next.equipment.sigils[slot]];
            if (value) nextValues[sigilIndex] = value; else nextValues.splice(sigilIndex, 1);
            return { ...next, equipment: { ...next.equipment, sigils: { ...next.equipment.sigils, [slot]: nextValues.filter(Boolean) } } };
          })}
          placeholder="Choose sigil"
        />
      ))}
    </div>
  </div>
); })}
                  </div>
                </div>
                <div className="theme-builder-equipment-group is-consumables" hidden={equipmentSection !== "consumables"}>
                  <h4>Relic and consumables</h4>
                  <ItemPickerField id="builder-relics" label="Relic" value={builder.equipment.relic} valueKind="label" choices={BUILDER_RELIC_CHOICES.map((choice) => ({ label: choice, id: BUILDER_RELIC_IDS[choice] }))} items={equipmentItems} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, relic: value } }))} placeholder="Choose relic" />
                  <ItemPickerField id="builder-foods" label="Food" value={builder.equipment.food} valueKind="label" choices={BUILDER_FOOD_CHOICES} items={equipmentItems} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, food: value } }))} placeholder="Choose food" />
                  <ItemPickerField id="builder-utilities" label="Utility" value={builder.equipment.utility} valueKind="label" choices={BUILDER_UTILITY_CHOICES} items={equipmentItems} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, utility: value } }))} placeholder="Choose utility" />
                  <ItemPickerField id="builder-enrichment" label="Enrichment" value={builder.equipment.enrichment} valueKind="id" choices={BUILDER_ENRICHMENT_CHOICES} items={equipmentItems} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, enrichment: value } }))} placeholder="Choose enrichment" />
                  {Object.keys(builder.equipment.infusions).length > 0 && (
                    <div>
                      <FieldLabel>Imported infusions</FieldLabel>
                      <div className="theme-builder-item-summary">
                        {Object.entries(builder.equipment.infusions).map(([slot, value]) => {
                          const values = (Array.isArray(value) ? value : [value]).filter(Boolean);
                          return (
                            <div key={slot}>
                              <EquipmentArtwork src={equipmentItems[Number(values[0])]?.icon} fallback={<Sparkles className="h-4 w-4" />} label={`${slot} infusion`} />
                              <span><strong>{slot}</strong><small>{values.map((itemId) => equipmentItems[Number(itemId)]?.name ?? itemId).join(" · ")}</small></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <EquipmentAttributePanel attributeProfile={attributeProfile} />
              </div>
            </section>
          )}

            {builderViewMode === "traits" && (builder.professionId === "Revenant" || builder.professionId === "Ranger" || builder.professionId === "Elementalist" || builder.professionId === "Engineer" || builder.professionId === "Warrior" || builder.professionId === "Thief") && (
              <section className="theme-panel theme-builder-panel"><div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Profession system</div><h3>{builder.professionId} mechanics</h3></div><Sparkles className="h-5 w-5 text-theme-accent" /></div><div className="theme-builder-mechanics">
                {builder.professionId === "Revenant" && <>{[0, 1].map((index) => {
                  const selectedLegendId = builder.selectedLegends[index];
                  const selectedLegend = legends.find((legend) => legend.id === selectedLegendId);
                  const selectedSwapSkill = selectedLegend?.swap ? skillsById.get(selectedLegend.swap) : null;
                  const legalChoices: BuilderPickerChoice[] = availableLegends
                    .filter((legend) => !builder.selectedLegends.includes(legend.id) || legend.id === selectedLegendId)
                    .map((legend) => {
                      const swapSkill = legend.swap ? skillsById.get(legend.swap) : null;
                      return {
                        value: legend.id,
                        label: swapSkill?.name ?? legendLabel(legend.id),
                        icon: swapSkill?.icon,
                        group: swapSkill?.specialization ? "Elite legend" : "Core legend",
                        meta: swapSkill?.description ?? legend.id,
                      };
                    });
                  if (selectedLegend && !availableLegends.some((legend) => legend.id === selectedLegend.id)) {
                    legalChoices.unshift({
                      value: selectedLegend.id,
                      label: selectedSwapSkill?.name ?? legendLabel(selectedLegend.id),
                      icon: selectedSwapSkill?.icon,
                      group: "Unavailable",
                      meta: "Not available to the selected specializations",
                      disabled: true,
                      disabledReason: "Not available to the selected specializations",
                    });
                  }
                  return <ChoicePickerField key={index} id={`builder-legend-${index}`} label={`Legend ${index + 1}`} value={selectedLegendId} choices={legalChoices} onChange={(value) => updateBuilder((current) => ({ ...current, selectedLegends: current.selectedLegends.map((item, itemIndex) => itemIndex === index ? value : item) as [string, string] }))} onPreview={(value) => { const legend = legends.find((item) => item.id === value); const skill = legend?.swap ? skillsById.get(legend.swap) : null; if (skill) setSelectedSummary({ kind: "skill", item: skill }); }} placeholder="Choose legend" clearLabel="Clear legend" />;
                })}</>}
                {builder.professionId === "Ranger" && <>{(["terrestrial1", "terrestrial2"] as const).map((field, index) => {
                  const selectedPetId = builder.selectedPets[field];
                  const selectedPet = pets.find((pet) => pet.id === selectedPetId);
                  const choices: BuilderPickerChoice[] = pets
                    .filter((pet) => isTerrestrialRangerPet(pet.id))
                    .map((pet) => ({ value: String(pet.id), label: pet.name, icon: pet.icon, group: "Pet", meta: pet.description }));
                  if (selectedPet && !isTerrestrialRangerPet(selectedPet.id)) {
                    choices.unshift({
                      value: String(selectedPet.id),
                      label: selectedPet.name,
                      icon: selectedPet.icon,
                      group: "Imported",
                      meta: "Aquatic pet; choose a terrestrial or amphibious pet",
                      disabled: true,
                      disabledReason: "Aquatic pet; choose a terrestrial or amphibious pet",
                    });
                  }
                  return <ChoicePickerField key={field} id={`builder-pet-${field}`} label={`Terrestrial pet ${index + 1}`} value={selectedPetId ? String(selectedPetId) : ""} choices={choices} onChange={(value) => updateBuilder((current) => ({ ...current, selectedPets: { ...current.selectedPets, [field]: Number(value) || 0 } }))} placeholder="Choose pet" clearLabel="Clear pet" />;
                })}</>}
                {builder.professionId === "Elementalist" && <>{(["activeAttunement", "activeAttunement2"] as const).map((field, index) => <div key={field}><FieldLabel>Attunement {index + 1}</FieldLabel><div className="theme-builder-mechanic-pills">{["", "Fire", "Water", "Air", "Earth"].map((attunement) => <button key={attunement || "None"} type="button" aria-pressed={builder[field] === attunement} className={builder[field] === attunement ? "is-active" : undefined} onClick={() => updateBuilder((current) => ({ ...current, [field]: attunement }))}>{attunement || "None"}</button>)}</div></div>)}</>}
                {builder.professionId === "Engineer" && <ChoicePickerField id="builder-engineer-kit" label="Active kit" value={builder.activeKit ? String(builder.activeKit) : ""} choices={[...(builder.activeKit > 0 && !engineerKitOptions.some((skill) => skill.id === builder.activeKit) ? [{ value: String(builder.activeKit), label: "Unavailable imported skill", group: "Imported", meta: "Imported value" }] : []), ...engineerKitOptions.map((skill) => ({ value: String(skill.id), label: skill.name, icon: skill.icon, group: skill.type ?? "Kit", meta: skill.description }))]} onChange={(value) => updateBuilder((current) => ({ ...current, activeKit: Number(value) || 0 }))} onPreview={(value) => { const skill = engineerKitOptions.find((item) => String(item.id) === value); if (skill) setSelectedSummary({ kind: "skill", item: skill }); }} placeholder="Choose kit" clearLabel="Clear kit" />}
                {builder.professionId === "Warrior" && <div><FieldLabel>Active weapon set</FieldLabel><div className="theme-builder-mechanic-pills">{[1, 2].map((weaponSet) => <button key={weaponSet} type="button" aria-pressed={builder.activeWeaponSet === weaponSet} className={builder.activeWeaponSet === weaponSet ? "is-active" : undefined} onClick={() => updateBuilder((current) => ({ ...current, activeWeaponSet: weaponSet }))}>Set {weaponSet === 1 ? "I" : "II"}</button>)}</div></div>}
                {builder.professionId === "Thief" && <>{(["f2", "f3", "f4"] as const).map((field) => { const currentId = builder.antiquaryArtifacts[field]; return <ChoicePickerField key={field} id={`builder-antiquary-${field}`} label={`Antiquary ${field.toUpperCase()}`} value={currentId ? String(currentId) : ""} choices={[...(currentId > 0 && !thiefArtifactOptions.some((skill) => skill.id === currentId) ? [{ value: String(currentId), label: "Unavailable imported skill", group: "Imported", meta: "Imported value" }] : []), ...thiefArtifactOptions.map((skill) => ({ value: String(skill.id), label: skill.name, icon: skill.icon, group: skill.type ?? "Profession", meta: skill.description }))]} onChange={(value) => updateBuilder((current) => ({ ...current, antiquaryArtifacts: { ...current.antiquaryArtifacts, [field]: Number(value) || 0 } }))} onPreview={(value) => { const skill = thiefArtifactOptions.find((item) => String(item.id) === value); if (skill) setSelectedSummary({ kind: "skill", item: skill }); }} placeholder="Choose artifact" clearLabel="Clear artifact" />; })}</>}
              </div></section>
            )}

            {builderViewMode === "notes" && (
            <section className="theme-panel theme-builder-panel"><div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Field notes</div><h3>Usage and callouts</h3></div><BookOpen className="h-5 w-5 text-theme-muted" /></div><textarea className="theme-builder-notes" aria-label="Usage and callouts" value={builder.notes} onChange={(event) => updateBuilder((current) => ({ ...current, notes: event.target.value }))} placeholder="Rotation priorities, weapon swaps, party role, situational substitutions..." /></section>
            )}

            {builderViewMode === "preview" && (
                    <>
                      <BuildPreview
                        builder={builder}
                        profession={selectedProfession}
                        specsById={specsById}
                        traitsBySpecId={traitsBySpecId}
                        skillsById={skillsById}
                        legends={legends}
                        pets={pets}
                        attributeTotals={attributeTotals}
                        attributeProfile={attributeProfile}
                        weaponSet={displayedWeaponSet}
                        onSwapWeaponSet={() => setDisplayedWeaponSet((current) => current === 1 ? 2 : 1)}
                        onInspectSkill={(skill) => inspectBuilderItem({ kind: "skill", item: skill })}
                        onInspectPet={(pet) => inspectBuilderItem({ kind: "pet", item: pet })}
                        onInspectTrait={(trait) => inspectBuilderItem({ kind: "trait", item: trait })}
                        onInspectSpecialization={(specialization) => inspectBuilderItem({ kind: "specialization", item: specialization })}
                      />
                      <EquipmentPreview
                        builder={builder}
                        items={equipmentItems}
                        onInspectItem={(item) => inspectBuilderItem({ kind: "item", item })}
                      />
                    </>
            )}
          </div>
          </main>

          <BuilderMobileTools
            issues={issues}
            selected={selectedSummary}
            builder={builder}
            openPanel={compactDetailsPanel}
            setOpenPanel={setCompactDetailsPanel}
            returnFocusRef={compactDetailsReturnFocusRef}
          />

          <button
            type="button"
            className="theme-builder-rail-toggle"
            aria-expanded={detailRailOpen || compactDetailsPanel === "details"}
            aria-controls="builder-detail-rail"
            aria-label={detailRailOpen || compactDetailsPanel === "details" ? "Hide build readiness and inspector" : "Show build readiness and inspector"}
            title={detailRailOpen || compactDetailsPanel === "details" ? "Hide build details" : "Show build details"}
            onClick={(event) => {
              if (window.matchMedia(BUILDER_COMPACT_DETAILS_QUERY).matches) {
                compactDetailsReturnFocusRef.current = event.currentTarget;
                setCompactDetailsPanel((panel) => panel === "details" ? null : "details");
              }
              else setDetailRailOpen((open) => !open);
            }}
          >
            {detailRailOpen || compactDetailsPanel === "details" ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            {!detailRailOpen && compactDetailsPanel !== "details" && <span aria-label={`${issues.length} build issues`}>{issues.length}</span>}
          </button>

          <aside id="builder-detail-rail" className="theme-builder-rail" hidden={!detailRailOpen}>
            <BuilderReadiness issues={issues} />
            <DetailPanel selected={selectedSummary} builder={builder} />
            {exportCode && <div className="theme-builder-code-output"><div className="flex items-center justify-between"><FieldLabel>Last exported code</FieldLabel><button type="button" title="Copy code" aria-label="Copy last exported Entropy code" onClick={() => copyText(brandEntropyCode(exportCode), "Entropy code copied.")}><Clipboard className="h-4 w-4" /></button></div><code>{brandEntropyCode(exportCode)}</code></div>}
          </aside>
        </div>
      )}
      <AnimatePresence>
        {viewingBuild && <BuildViewerDialog key={viewingBuild.id} build={viewingBuild} professions={professions} specsById={allSpecsById} legends={legends} pets={pets} items={equipmentItems} onClose={closeBuildViewer} onEdit={() => editViewedBuild(viewingBuild)} />}
      </AnimatePresence>
    </div>
  );
}
