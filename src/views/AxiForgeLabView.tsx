import { useEffect, useMemo, useState } from "react";
import { computeAttributeTotals, type AttributeTotals } from "../lib/gw2/computeAttributes";
import {
  AlertCircle,
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Layers3,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  decodeAxiForgeCode,
  detectAxiForgeCodeKind,
  encodeAxiForgeBuildCode,
  encodeAxiForgeCompCode,
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
import { BOON_DISPLAY_ORDER, type BoonCoverageEntry } from "../lib/axiforge/boonEngine";
import { computeBuildBoonCoverage } from "../lib/axiforge/squadBoons";
import {
  fetchGw2Skills,
  fetchGw2Specializations,
  fetchGw2Traits,
  wikiSearchUrl,
  fetchGw2ProfessionSkillPalette,
  fetchGw2LegendCodes,
} from "../lib/gw2/gw2Api";
import { encodeBuildChatCode, type ChatCodeCatalog } from "../lib/gw2/chatCode";
import { importGw2SkillsBuild, validateGw2SkillsEditorUrl } from "../lib/gw2/gw2SkillsImport";
import {
  availableProfessionWeapons,
  isTwoHandedWeapon,
  loadBuilderFoundationCatalog,
  validateBuilderEquipmentAgainstCatalog,
  weaponFitsBuilderSlot,
  type BuilderCatalogSource,
} from "../lib/gw2/builderCatalog";
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
} from "../lib/gw2/builderEquipmentCatalog";
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

type WorkbenchTab = "build" | "library" | "squad";
type Notice = { tone: "success" | "warning" | "error"; message: string };

const GAME_MODES = [
  { id: "wvw", label: "WvW" },
  { id: "pve", label: "PvE" },
  { id: "pvp", label: "PvP" },
] as const;

const ROLE_OPTIONS = ["", "DPS", "Support", "Healer", "Boon Support", "Control", "Roamer", "Commander"];
const BUILDER_FOOD_LABELS = BUILDER_FOOD_CHOICES.map((choice) => choice.label);
const BUILDER_UTILITY_LABELS = BUILDER_UTILITY_CHOICES.map((choice) => choice.label);

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
  return "Waiting for AxiCode";
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

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`theme-builder-input ${props.className ?? ""}`} />;
}

function SearchableChoiceField({
  id,
  label,
  value,
  choices,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  choices: readonly string[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const supported = choiceIsCodecSupported(value, choices);
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      <div className="theme-builder-choice-input">
        <Search className="h-4 w-4" aria-hidden="true" />
        <TextField list={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      </div>
      <datalist id={id}>{choices.map((choice) => <option key={choice} value={choice} />)}</datalist>
      {!supported && <span className="theme-builder-choice-note is-warning"><AlertCircle className="h-3.5 w-3.5" /> Kept in this draft, but this AxiCode version cannot encode it.</span>}
    </label>
  );
}

function SearchableItemChoiceField({
  id,
  label,
  valueId,
  choices,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  valueId: string;
  choices: readonly { label: string; id?: number }[];
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const byId = useMemo(() => new Map(choices.filter((choice) => choice.id != null).map((choice) => [String(choice.id), choice.label])), [choices]);
  const byLabel = useMemo(() => new Map(choices.map((choice) => [choice.label, choice])), [choices]);
  const displayValue = valueId ? (byId.get(valueId) ?? valueId) : "";
  const resolved = !valueId || byId.has(valueId);
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      <div className="theme-builder-choice-input">
        <Search className="h-4 w-4" aria-hidden="true" />
        <TextField
          list={id}
          value={displayValue}
          onChange={(event) => {
            const typed = event.target.value;
            const match = byLabel.get(typed);
            onChange(match ? String(match.id) : typed);
          }}
          placeholder={placeholder}
        />
      </div>
      <datalist id={id}>{choices.map((choice) => <option key={choice.label} value={choice.label} />)}</datalist>
      {!resolved && <span className="theme-builder-choice-note"><AlertCircle className="h-3.5 w-3.5" /> Raw item ID {valueId} — not in the curated catalog.</span>}
    </label>
  );
}

function EquipmentItemSummary({ values, items }: { values: string[]; items: Record<number, Gw2Item> }) {
  const uniqueValues = [...new Set(values.filter(Boolean))];
  if (!uniqueValues.length) return null;
  return (
    <div className="theme-builder-item-summary">
      {uniqueValues.map((value) => {
        const item = items[Number(value)];
        return (
          <div key={value}>
            {item?.icon ? <img src={item.icon} alt="" /> : <FileCode2 className="h-4 w-4" aria-hidden="true" />}
            <span><strong>{item?.name ?? "Unresolved item"}</strong><small>Item {value}</small></span>
          </div>
        );
      })}
    </div>
  );
}

function EquipmentLoadoutSheet({ builder, items }: { builder: EntropyBuilderState; items: Record<number, Gw2Item> }) {
  const weaponSet = (set: 1 | 2) => {
    const main = builder.equipment.weapons[`mainhand${set}`] || "Empty";
    const off = builder.equipment.weapons[`offhand${set}`];
    return off ? `${main} + ${off}` : main;
  };
  const runeIds = [...new Set(Object.values(builder.equipment.runes).filter(Boolean))];
  const runeNames = runeIds.map((id) => items[Number(id)]?.name ?? `Item ${id}`);
  const cells = [
    ["Stat doctrine", builder.equipment.statPackage || "Unassigned"],
    ["Weapon set I", weaponSet(1)],
    ["Weapon set II", weaponSet(2)],
    ["Armor runes", runeNames.length ? runeNames.join(" · ") : "Unassigned"],
    ["Relic", builder.equipment.relic || "Unassigned"],
    ["Consumables", [builder.equipment.food, builder.equipment.utility].filter(Boolean).join(" · ") || "Unassigned"],
  ];
  return (
    <div className="theme-builder-equipment-sheet" aria-label="Current equipment summary">
      <div className="theme-builder-equipment-sheet-mark"><ClassIcon name={builder.professionId} size="lg" /><span><small>Field loadout</small><strong>{builder.name || builder.professionId}</strong></span></div>
      {cells.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
    </div>
  );
}

function DetailPanel({ selected }: { selected: BuilderSummaryItem | null }) {
  if (!selected) {
    return (
      <aside className="theme-builder-inspector">
        <div className="theme-builder-kicker"><BookOpen className="h-4 w-4" /> Field manual</div>
        <h3>Inspect the loadout</h3>
        <p>Focus a profession, specialization, trait, or skill to read its live Guild Wars 2 details here.</p>
      </aside>
    );
  }

  const item = selected.item;
  const facts = "facts" in item ? item.facts ?? [] : [];
  const description = "description" in item ? item.description : "";

  return (
    <aside className="theme-builder-inspector">
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
      {facts.length > 0 && (
        <div className="mt-4 space-y-2">
          <FieldLabel>Combat facts</FieldLabel>
          {facts.slice(0, 8).map((fact, index) => (
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
    </aside>
  );
}

function SkillPicker({
  label,
  slot,
  selectedId,
  skills,
  usedIds,
  onChange,
  onInspect,
}: {
  label: string;
  slot: Gw2SkillSlot;
  selectedId: number | null;
  skills: Gw2Skill[];
  usedIds: Array<number | null>;
  onChange: (id: number | null) => void;
  onInspect: (skill: Gw2Skill) => void;
}) {
  const selected = skills.find((skill) => skill.id === selectedId) ?? null;
  const options = skills.filter((skill) => skill.slot === slot && (!usedIds.includes(skill.id) || skill.id === selectedId));
  return (
    <div className="theme-builder-skill-slot">
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        className="theme-builder-skill-icon"
        onClick={() => selected && onInspect(selected)}
        title={selected ? `Inspect ${selected.name}` : `Choose ${label}`}
      >
        {selected?.icon ? <img src={selected.icon} alt="" /> : <Plus className="h-5 w-5" />}
      </button>
      <SelectField value={selectedId ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Choose skill</option>
        {options.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
      </SelectField>
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
}: {
  builds: SavedBuilderBuild[];
  onLoad: (build: SavedBuilderBuild) => void;
  onDuplicate: (build: SavedBuilderBuild) => void;
  onDelete: (id: string) => void;
  onCopy: (code: string) => void;
  onShare: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = builds.filter((build) => {
    const haystack = [build.name, build.state.professionId, build.state.role, ...build.state.tags].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <section className="theme-builder-workspace">
      <div className="theme-builder-section-head">
        <div><div className="theme-builder-kicker">Local doctrine</div><h3>Build library</h3></div>
        <div className="theme-builder-search"><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search builds" /></div>
      </div>
      {filtered.length === 0 ? (
        <div className="theme-builder-empty"><Archive className="h-7 w-7" /><strong>No saved builds</strong><span>Complete a loadout in Build and save it to establish the library.</span></div>
      ) : (
        <div className="theme-builder-library-list">
          {filtered.map((build, index) => (
            <article key={build.id} className="theme-builder-library-row">
              <div className="theme-builder-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h4>{build.name}</h4><span>{build.state.professionId}</span>{build.state.role && <span>{build.state.role}</span>}</div>
                <p>{build.state.tags.length ? build.state.tags.join(" / ") : "No tags"} · Updated {new Date(build.updatedAt).toLocaleDateString()}</p>
              </div>
              <div className="theme-builder-row-actions">
                <button type="button" onClick={() => onLoad(build)} title="Open build"><FolderOpen /></button>
                <button type="button" onClick={() => onDuplicate(build)} title="Duplicate build"><Copy /></button>
                <button type="button" onClick={() => onCopy(build.shareCode)} title="Copy AxiCode"><Clipboard /></button>
                <button type="button" onClick={() => onShare(build.shareCode)} title="Copy share link"><Link2 /></button>
                <button type="button" onClick={() => onDelete(build.id)} title="Delete build"><Trash2 /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function boonCacheKey(build: SavedBuilderBuild): string {
  return `${build.id}:${build.updatedAt}`;
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
  const providers = useMemo(() => {
    const map = new Map<string, { icon?: string; sources: Array<{ buildName: string; profession: string }> }>();
    const referenced = composition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id));
    for (const buildId of referenced) {
      const build = builds.find((item) => item.id === buildId);
      if (!build) continue;
      const coverage = boonCache[boonCacheKey(build)];
      if (!coverage) continue;
      for (const entry of coverage) {
        if (!entry.hasAllySource) continue;
        const existing = map.get(entry.name) ?? { icon: entry.icon, sources: [] }; if (!existing.icon && entry.icon) existing.icon = entry.icon;
        existing.sources.push({ buildName: build.name, profession: build.state.professionId });
        map.set(entry.name, existing);
      }
    }
    return map;
  }, [composition, builds, boonCache]);

  return (
    <section className="theme-builder-boon-coverage">
      <div className="theme-builder-section-head">
        <div><div className="theme-builder-kicker">Live from assigned squad slots</div><h3>Squad boon coverage</h3></div>
        {computing && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      <div className="theme-builder-boon-grid">
        {BOON_DISPLAY_ORDER.map((boon) => {
          const entry = providers.get(boon); const list = entry?.sources ?? [];
          const covered = list.length > 0;
          return (
            <div
              key={boon}
              className={covered ? "is-covered" : "is-missing"}
              title={covered ? list.map((source) => `${source.buildName} (${source.profession})`).join(", ") : "No assigned build grants this to allies"}
            >
              <div className="theme-builder-boon-icon">{entry?.icon ? <img src={entry.icon} alt="" /> : <Sparkles className="h-5 w-5" />}{covered && <em>{list.length}</em>}</div>
              <span>{boon}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SquadWorkspace({
  composition,
  builds,
  boonCache,
  boonComputing,
  onCreate,
  onChange,
  onCopyCode,
  onShareCode,
}: {
  composition: BuilderComposition | null;
  builds: SavedBuilderBuild[];
  boonCache: Record<string, BoonCoverageEntry[]>;
  boonComputing: boolean;
  onCreate: () => void;
  onChange: (composition: BuilderComposition) => void;
  onCopyCode: () => void;
    onShareCode: () => void;
}) {
  if (!composition) {
    return (
      <section className="theme-builder-workspace theme-builder-empty">
        <Users className="h-8 w-8" /><strong>No active squad plan</strong><span>Create a plan and assign saved builds into five-player subgroups.</span>
        <button type="button" className="theme-command-button" onClick={onCreate}><Plus className="h-4 w-4" /> Create squad</button>
      </section>
    );
  }

  const assigned = composition.parties.reduce((total, party) => total + party.slots.filter(Boolean).length, 0);
  const update = (partial: Partial<BuilderComposition>) => onChange({ ...composition, ...partial, updatedAt: new Date().toISOString() });

  return (
    <>
      <SquadBoonCoverage composition={composition} builds={builds} boonCache={boonCache} computing={boonComputing} />
      <section className="theme-builder-workspace">
        <div className="theme-builder-section-head">
          <div className="grid flex-1 gap-3 md:grid-cols-[minmax(15rem,1fr)_9rem]">
            <label><FieldLabel>Squad name</FieldLabel><TextField value={composition.name} onChange={(event) => update({ name: event.target.value })} /></label>
            <label><FieldLabel>Mode</FieldLabel><SelectField value={composition.gameMode} onChange={(event) => update({ gameMode: event.target.value as BuilderComposition["gameMode"] })}>{GAME_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</SelectField></label>
          </div>
          <div className="theme-builder-squad-readout"><strong>{assigned}</strong><span>assigned</span></div>
          <button type="button" className="theme-command-button" onClick={onCopyCode} disabled={!assigned}><Clipboard className="h-4 w-4" /> Copy squad code</button>
                    <button type="button" className="theme-command-button" onClick={onShareCode} disabled={!assigned}><Link2 className="h-4 w-4" /> Share squad link</button>
        </div>
        <div className="theme-builder-party-stack">
          {composition.parties.map((party, partyIndex) => (
            <div key={party.id} className="theme-builder-party-line">
              <div className="theme-builder-party-name">
                <span>{String(partyIndex + 1).padStart(2, "0")}</span>
                <input value={party.name} onChange={(event) => update({ parties: composition.parties.map((item) => item.id === party.id ? { ...item, name: event.target.value } : item) })} />
                {composition.parties.length > 1 && <button type="button" title="Remove subgroup" onClick={() => update({ parties: composition.parties.filter((item) => item.id !== party.id) })}><X /></button>}
              </div>
              <div className="theme-builder-party-slots">
                {party.slots.map((buildId, slotIndex) => {
                  const selected = builds.find((build) => build.id === buildId);
                  return (
                    <label key={slotIndex} className={selected ? "is-filled" : ""}>
                      <span>{slotIndex + 1}</span>
                      <select value={buildId ?? ""} onChange={(event) => update({ parties: composition.parties.map((item) => item.id === party.id ? { ...item, slots: item.slots.map((slot, index) => index === slotIndex ? event.target.value || null : slot) } : item) })}>
                        <option value="">Open slot</option>
                        {builds.map((build) => <option key={build.id} value={build.id}>{build.name} · {build.state.professionId}</option>)}
                      </select>
                      {selected && <small>{selected.state.role || selected.state.professionId}</small>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="theme-builder-add-line" onClick={() => update({ parties: [...composition.parties, createParty(composition.parties.length)] })}><Plus className="h-4 w-4" /> Add subgroup</button>
      </section>
    </>
  );
}

function BuildPreview({
  builder,
  profession,
  specsById,
  traitsBySpecId,
  skillsById,
  attributeTotals,
}: {
  builder: EntropyBuilderState;
  profession: Gw2Profession | null;
  specsById: Map<number, Gw2Specialization>;
  traitsBySpecId: Map<number, Gw2Trait[]>;
  skillsById: Map<number, Gw2Skill>;
  attributeTotals: AttributeTotals;
}) {
  const skillIds = [builder.healSkillId, builder.utilitySkillIds[0], builder.utilitySkillIds[1], builder.utilitySkillIds[2], builder.eliteSkillId];
  const skillLabels = ["Heal", "Utility", "Utility", "Utility", "Elite"];
  const attributeRows: Array<[string, string]> = [
    ["Power", Math.round(attributeTotals.power).toLocaleString()],
    ["Precision", Math.round(attributeTotals.precision).toLocaleString()],
    ["Toughness", Math.round(attributeTotals.toughness).toLocaleString()],
    ["Vitality", Math.round(attributeTotals.vitality).toLocaleString()],
    ["Ferocity", Math.round(attributeTotals.ferocity).toLocaleString()],
    ["Condition Damage", Math.round(attributeTotals.conditionDamage).toLocaleString()],
    ["Expertise", Math.round(attributeTotals.expertise).toLocaleString()],
    ["Concentration", Math.round(attributeTotals.concentration).toLocaleString()],
    ["Healing Power", Math.round(attributeTotals.healingPower).toLocaleString()],
    ["Crit Chance", attributeTotals.critChance.toFixed(1) + "%"],
    ["Crit Damage", attributeTotals.critDamage.toFixed(1) + "%"],
    ["Boon Duration", attributeTotals.boonDuration.toFixed(1) + "%"],
    ["Condition Duration", attributeTotals.conditionDuration.toFixed(1) + "%"],
  ];

  return (
    <div className="theme-builder-preview">
      <div className="theme-builder-preview-header">
        {profession && <ClassIcon name={profession.name} size="lg" />}
        <div>
          <h2>{builder.name || "Untitled Build"}</h2>
          <p className="theme-builder-preview-subtitle">
            {profession?.name ?? "No profession"} · {builder.gameMode.toUpperCase()}
            {builder.role ? " · " + builder.role : ""}
          </p>
        </div>
      </div>

      <div className="theme-builder-preview-skillbar">
        {skillIds.map((id, index) => {
          const skill = id ? skillsById.get(id) : null;
          return (
            <div key={index} className="theme-builder-preview-skill" title={skill?.name ?? skillLabels[index]}>
              {skill?.icon ? <img src={skill.icon} alt="" /> : <span className="theme-builder-preview-skill-empty">{skillLabels[index][0]}</span>}
            </div>
          );
        })}
        <div className="theme-builder-preview-hp">
          <strong>{Math.round(attributeTotals.health).toLocaleString()}</strong>
          <span>HP</span>
        </div>
      </div>

      <div className="theme-builder-preview-attributes">
        {attributeRows.map(([label, value]) => (
          <div key={label} className="theme-builder-preview-attribute">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

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
              <div className="theme-builder-preview-spec-badge">
                {spec.icon && <img src={spec.icon} alt="" />}
              </div>
              <span className="theme-builder-preview-spec-name">{spec.name}</span>
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
                        <img className="theme-builder-preview-tier-minor" src={minor.icon} alt="" title={minor.name} />
                      )}
                      <div className="theme-builder-preview-tier-majors">
                        {majors.map((trait, position) => (
                          trait.icon ? (
                            <img
                              key={trait.id}
                              className={chosenIndex === position + 1 ? "is-selected" : ""}
                              src={trait.icon}
                              alt=""
                              title={trait.name}
                            />
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
    </div>
  );
}

function EquipmentPreview({
  builder,
  items,
  availableWeapons,
  skillsById,
}: {
  builder: EntropyBuilderState;
  items: Record<number, Gw2Item>;
  availableWeapons: Array<[string, { skills?: Array<{ id: number; slot: string }> }]>;
  skillsById: Map<number, Gw2Skill>;
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

  function weaponSkillsFor(weaponName: string) {
    if (!weaponName) return [];
    const entry = availableWeapons.find(([name]) => name.toLowerCase() === weaponName.toLowerCase());
    return entry ? entry[1].skills ?? [] : [];
  }

  const relicItem = itemFor(BUILDER_RELIC_IDS[builder.equipment.relic]);
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
                <div className="theme-builder-preview-armor-icon"><Shield className="h-4 w-4" /></div>
                <div className="theme-builder-preview-armor-info">
                  <small>{slot}</small>
                  <strong>{builder.equipment.statPackage || "Unassigned"}</strong>
                </div>
                <div className="theme-builder-preview-armor-badge" title={rune?.name ?? "No rune"}>
                  {rune?.icon ? <img src={rune.icon} alt="" /> : <Sparkles className="h-4 w-4" />}
                </div>
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
                    <span className="theme-builder-preview-weapon-name">{row.weapon}</span>
                    <div className="theme-builder-preview-weapon-badges">
                      {row.sigils.map((sigilId, sigilIndex) => {
                        const sigil = itemFor(sigilId);
                        return (
                          <div key={sigilIndex} className="theme-builder-preview-armor-badge" title={sigil?.name ?? "No sigil"}>
                            {sigil?.icon ? <img src={sigil.icon} alt="" /> : <Sparkles className="h-4 w-4" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              <div className="theme-builder-preview-weapon-skills">
                {rows.flatMap((row) => weaponSkillsFor(row.weapon)).map((skillRef, index) => {
                  const skill = skillsById.get(skillRef.id);
                  if (!skill?.icon) return null;
                  return (
                    <div key={`${skillRef.id}-${index}`} className="theme-builder-preview-skill" title={skill.name}>
                      <img src={skill.icon} alt="" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="theme-builder-preview-equipment-column">
        <h4>Trinkets</h4>
        <div className="theme-builder-preview-trinkets">
          {trinketSlots.map((slot) => (
            <div key={slot} className="theme-builder-preview-trinket-card">
              <small>{trinketLabels[slot]}</small>
              <strong>{builder.equipment.slots[slot] || "Unassigned"}</strong>
            </div>
          ))}
        </div>

        <h4>Relic and consumables</h4>
        <div className="theme-builder-preview-consumables">
          <div className="theme-builder-preview-consumable-row">
            <div className="theme-builder-preview-armor-badge">{relicItem?.icon ? <img src={relicItem.icon} alt="" /> : <Sparkles className="h-4 w-4" />}</div>
            <div className="theme-builder-preview-armor-info"><small>Relic</small><strong>{builder.equipment.relic || "Unassigned"}</strong></div>
          </div>
          <div className="theme-builder-preview-consumable-row">
            <div className="theme-builder-preview-armor-badge"><Sparkles className="h-4 w-4" /></div>
            <div className="theme-builder-preview-armor-info"><small>Food</small><strong>{builder.equipment.food || "Unassigned"}</strong></div>
          </div>
          <div className="theme-builder-preview-consumable-row">
            <div className="theme-builder-preview-armor-badge"><Sparkles className="h-4 w-4" /></div>
            <div className="theme-builder-preview-armor-info"><small>Utility</small><strong>{builder.equipment.utility || "Unassigned"}</strong></div>
          </div>
          <div className="theme-builder-preview-consumable-row">
            <div className="theme-builder-preview-armor-badge">{enrichmentItem?.icon ? <img src={enrichmentItem.icon} alt="" /> : <Sparkles className="h-4 w-4" />}</div>
            <div className="theme-builder-preview-armor-info"><small>Enrichment</small><strong>{enrichmentItem?.name ?? (builder.equipment.enrichment || "Unassigned")}</strong></div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function AxiForgeLabView() {
  const [workspace, setWorkspace] = useState<BuilderWorkspace>(() => loadBuilderWorkspace());
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("build");
  const [builderViewMode, setBuilderViewMode] = useState<"edit" | "preview">("edit");
  const [editingBuildId, setEditingBuildId] = useState<string | null>(null);
  const [professions, setProfessions] = useState<Gw2Profession[]>([]);
  const [itemStats, setItemStats] = useState<Gw2ItemStat[]>([]);
  const [legends, setLegends] = useState<Gw2Legend[]>([]);
  const [pets, setPets] = useState<Gw2Pet[]>([]);
  const [catalogSource, setCatalogSource] = useState<BuilderCatalogSource | null>(null);
  const [professionSpecs, setProfessionSpecs] = useState<Gw2Specialization[]>([]);
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
  const [equipmentItems, setEquipmentItems] = useState<Record<number, Gw2Item>>({});

  const builder = workspace.draft;
  const updateBuilder = (updater: EntropyBuilderState | ((current: EntropyBuilderState) => EntropyBuilderState)) => {
    setWorkspace((current) => ({ ...current, draft: typeof updater === "function" ? updater(current.draft) : updater }));
  };

  useEffect(() => saveBuilderWorkspace(workspace), [workspace]);

  useEffect(() => {
    const sharedCode = parseAxiForgeShareQuery(window.location.search);
    if (!sharedCode) return;
    const result = decodeAxiForgeCode(sharedCode);
    if (result.ok && result.value && result.kind === "comp") {
    hydrateSharedComposition(result.value);
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
  const attributeTotals = useMemo(() => computeAttributeTotals(builder, selectedProfession), [builder, selectedProfession]);
  const specsById = useMemo(() => new Map(professionSpecs.map((spec) => [spec.id, spec])), [professionSpecs]);
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
  const statOptions = useMemo(() => {
    const liveNames = [...new Set(itemStats.map((stat) => stat.name).filter(Boolean))];
    return liveNames.length ? ["", ...liveNames] : [...STAT_OPTIONS];
  }, [itemStats]);
  const equipmentIds = useMemo(() => {
    const ids = equipmentItemIds(builder.equipment);
    const relicId = BUILDER_RELIC_IDS[builder.equipment.relic];
    return relicId ? [...ids, relicId] : ids;
  }, [builder.equipment]);
  const equipmentIdsKey = equipmentIds.join(",");
  const runeValues = useMemo(() => [...new Set(Object.values(builder.equipment.runes).filter(Boolean))], [builder.equipment.runes]);
  const hasMixedRunes = runeValues.length > 1;
  const issues = useMemo(() => {
    const next = [...validateBuilder(builder), ...validateBuilderEquipmentAgainstCatalog(builder, selectedProfession)];
    if (!choiceIsCodecSupported(builder.equipment.relic, BUILDER_RELIC_CHOICES)) next.push("Relic is not supported by the installed AxiCode format.");
    if (!choiceIsCodecSupported(builder.equipment.food, BUILDER_FOOD_LABELS)) next.push("Food is not supported by the installed AxiCode format.");
    if (!choiceIsCodecSupported(builder.equipment.utility, BUILDER_UTILITY_LABELS)) next.push("Utility is not supported by the installed AxiCode format.");
    return next;
  }, [builder, selectedProfession]);
  const detectedKind = useMemo(() => detectAxiForgeCodeKind(importCode), [importCode]);
  const gw2SkillsInput = useMemo(() => isGw2SkillsInput(importCode), [importCode]);
  const activeComposition = workspace.compositions.find((composition) => composition.id === workspace.activeCompositionId) ?? null;

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
    Promise.all([fetchGw2Specializations(selectedProfession.specializations), fetchGw2Skills(selectedProfession.skills.map((skill) => skill.id))])
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
  }, [selectedProfession?.id]);

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
      .map((id) => workspace.builds.find((build) => build.id === id))
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
  }, [activeComposition, workspace.builds, boonCache]);

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
    updateBuilder((current) => {
      const specializationIds = [...current.specializationIds] as EntropyBuilderState["specializationIds"];
      const traitChoices = current.traitChoices.map((row) => [...row]) as EntropyBuilderState["traitChoices"];
      specializationIds[trackIndex] = id;
      traitChoices[trackIndex] = [0, 0, 0];
      return { ...current, specializationIds, traitChoices };
    });
    const spec = id ? specsById.get(id) : null;
    if (spec) setSelectedSummary({ kind: "specialization", item: spec });
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
    try {
      const shareCode = createCurrentCode();
      const existing = workspace.builds.find((build) => build.id === editingBuildId);
      const saved = createSavedBuild(cloneBuilder(builder), shareCode, existing?.id);
      if (existing) saved.createdAt = existing.createdAt;
      setWorkspace((current) => ({ ...current, builds: existing ? current.builds.map((build) => build.id === existing.id ? saved : build) : [saved, ...current.builds] }));
      setEditingBuildId(saved.id);
      setExportCode(shareCode);
      setNotice({ tone: issues.length ? "warning" : "success", message: issues.length ? `Saved with ${issues.length} readiness item${issues.length === 1 ? "" : "s"}.` : "Build saved to the local library." });
    } catch {
      setNotice({ tone: "error", message: "This build could not be encoded. Check specialization and equipment selections." });
    }
  }

  async function exportCurrentBuild() {
    try {
      const code = createCurrentCode();
      setExportCode(code);
      await copyText(code, "Build AxiCode copied.");
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

  async function hydrateImportedBuild(value: unknown, name?: string): Promise<SavedBuilderBuild> {
    const state = builderFromAxiBuild(value, { name: name ?? "Imported Build" });
    const specIds = state.specializationIds.filter((id): id is number => Boolean(id));
    const specs = await fetchGw2Specializations(specIds);
    const traits = await fetchGw2Traits(specs.flatMap((spec) => spec.major_traits));
    const specMap = new Map(specs.map((spec) => [spec.id, spec]));
    const traitMap = new Map<number, Gw2Trait[]>();
    traits.forEach((trait) => traitMap.set(trait.specialization, [...(traitMap.get(trait.specialization) ?? []), trait]));
    const code = encodeAxiForgeBuildCode(buildAxiShape(state, specMap, traitMap, new Map()));
    return createSavedBuild(state, code);
  }

  async function hydrateSharedComposition(value: unknown) {
    const decoded = value as { name?: string; gameMode?: string; builds?: unknown[]; partyLines?: Array<{ capacity?: number; slots?: unknown[] }>; failedBuildCount?: number };
    const importedBuilds = await Promise.all((decoded.builds ?? []).map((entry, index) => hydrateImportedBuild(entry, `Imported ${index + 1}`)));
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
      setNotice({ tone: "error", message: result.error ?? "Unsupported AxiCode." });
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
    const importedBuilds = await Promise.all((decoded.builds ?? []).map((value, index) => hydrateImportedBuild(value, `Imported ${index + 1}`)));
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

  function duplicateBuild(build: SavedBuilderBuild) {
    const state = cloneBuilder(build.state);
    state.name = `${state.name} Copy`;
    const duplicate = createSavedBuild(state, build.shareCode);
    setWorkspace((current) => ({ ...current, builds: [duplicate, ...current.builds] }));
  }

  function removeBuild(id: string) {
    setWorkspace((current) => ({
      ...current,
      builds: current.builds.filter((build) => build.id !== id),
      compositions: current.compositions.map((composition) => ({ ...composition, parties: composition.parties.map((party) => ({ ...party, slots: party.slots.map((slot) => slot === id ? null : slot) })) })),
    }));
    if (editingBuildId === id) setEditingBuildId(null);
  }

  function createSquad() {
    const composition = createComposition();
    setWorkspace((current) => ({ ...current, compositions: [composition, ...current.compositions], activeCompositionId: composition.id }));
  }

  function updateComposition(composition: BuilderComposition) {
    setWorkspace((current) => ({ ...current, compositions: current.compositions.map((item) => item.id === composition.id ? composition : item) }));
  }

  async function exportSquad() {
    if (!activeComposition) return;
    const referencedIds = new Set(activeComposition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id)));
    const decodedBuilds: Record<string, unknown> = {};
    for (const id of referencedIds) {
      const saved = workspace.builds.find((build) => build.id === id);
      const result = saved ? decodeAxiForgeCode(saved.shareCode) : null;
      if (!result?.ok || !result.value) {
        setNotice({ tone: "error", message: "One assigned build has no valid saved AxiCode. Open and save that build first." });
        return;
      }
      const state = builderFromAxiBuild(result.value, saved?.state);
      const specIds = state.specializationIds.filter((value): value is number => Boolean(value));
      const specs = await fetchGw2Specializations(specIds);
      const traits = await fetchGw2Traits(specs.flatMap((spec) => spec.major_traits));
      const bySpec = new Map<number, Gw2Trait[]>();
      traits.forEach((trait) => bySpec.set(trait.specialization, [...(bySpec.get(trait.specialization) ?? []), trait]));
      decodedBuilds[id] = buildAxiShape(state, new Map(specs.map((spec) => [spec.id, spec])), bySpec, new Map());
    }
    const code = encodeAxiForgeCompCode({ name: activeComposition.name, gameMode: activeComposition.gameMode, partyLines: activeComposition.parties.map((party) => ({ capacity: party.slots.length, slots: party.slots.filter((id): id is string => Boolean(id)) })) }, decodedBuilds);
    if (!code) {
      setNotice({ tone: "error", message: "Squad code could not be created." });
      return;
    }
    setExportCode(code);
    await copyText(code, "Squad AxiCode copied.");
  }

  async function shareSquad() {
    if (!activeComposition) return;
    const referencedIds = new Set(activeComposition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id)));
    const decodedBuilds: Record<string, unknown> = {};
    for (const id of referencedIds) {
    const saved = workspace.builds.find((build) => build.id === id);
    const result = saved ? decodeAxiForgeCode(saved.shareCode) : null;
    if (!result?.ok || !result.value) {
    setNotice({ tone: "error", message: "One assigned build has no valid saved AxiCode. Open and save that build first." });
    return;
    }
    const state = builderFromAxiBuild(result.value, saved?.state);
    const specIds = state.specializationIds.filter((value): value is number => Boolean(value));
    const specs = await fetchGw2Specializations(specIds);
    const traits = await fetchGw2Traits(specs.flatMap((spec) => spec.major_traits));
    const bySpec = new Map<number, Gw2Trait[]>();
    traits.forEach((trait) => bySpec.set(trait.specialization, [...(bySpec.get(trait.specialization) ?? []), trait]));
    decodedBuilds[id] = buildAxiShape(state, new Map(specs.map((spec) => [spec.id, spec])), bySpec, new Map());
    }
    const code = encodeAxiForgeCompCode({ name: activeComposition.name, gameMode: activeComposition.gameMode, partyLines: activeComposition.parties.map((party) => ({ capacity: party.slots.length, slots: party.slots.filter((id): id is string => Boolean(id)) })) }, decodedBuilds);
    if (!code) {
    setNotice({ tone: "error", message: "Squad code could not be created." });
    return;
    }
    setExportCode(code);
    const url = buildAxiForgeShareUrl(code);
    if (url.length > 7500) {
    setNotice({ tone: "warning", message: 'This squad is too large for a share link. Use "Copy squad code" and share the AxiCode text instead.' });
    return;
    }
    await copyText(url, "Squad share link copied.");
    }
    
    const skillGroups = useMemo(() => ({ Heal: professionSkills.filter((skill) => skill.slot === "Heal"), Utility: professionSkills.filter((skill) => skill.slot === "Utility"), Elite: professionSkills.filter((skill) => skill.slot === "Elite") }), [professionSkills]);
  const engineerKitOptions = useMemo(
    () => professionSkills.filter((skill) => skill.name.toLowerCase().includes("kit")),
    [professionSkills],
  );
  const thiefArtifactOptions = useMemo(
    () => professionSkills.filter((skill) => skill.slot === "Profession"),
    [professionSkills],
  );

  return (
    <div className="theme-builder-root">
      <header className="theme-builder-command-deck">
        <div className="theme-builder-title-block">
          <div className="theme-builder-mark"><Wrench className="h-6 w-6" /></div>
          <div><div className="theme-builder-kicker">Neon systems loadout workshop</div><h2>Entropy Builder</h2><p>Construct, verify, archive, and organize Guild Wars 2 squad doctrine. {catalogSource === "cache" ? "Cached catalog ready." : catalogSource === "live" ? "Live catalog connected." : ""}</p></div>
        </div>
        <div className="theme-builder-command-actions">
          <button type="button" onClick={() => setImportOpen((open) => !open)} className="theme-command-button"><Download className="h-4 w-4" /> Import</button>
          <button type="button" onClick={exportCurrentBuild} className="theme-command-button"><FileCode2 className="h-4 w-4" /> Copy code</button>
          <button type="button" onClick={exportChatCode} className="theme-command-button"><Clipboard className="h-4 w-4" /> Copy Chat Code</button>
          <button type="button" onClick={shareCurrentBuild} className="theme-command-button"><Link2 className="h-4 w-4" /> Share link</button>
          <button type="button" onClick={saveCurrentBuild} className="theme-command-button is-primary"><Save className="h-4 w-4" /> {editingBuildId ? "Update" : "Save"}</button>
        </div>
      </header>

      <nav className="theme-builder-tabs" aria-label="Builder workspaces">
        {([
          { id: "build", label: "Build", icon: Swords, count: issues.length },
          { id: "library", label: "Library", icon: Archive, count: workspace.builds.length },
          { id: "squad", label: "Squad", icon: Users, count: activeComposition?.parties.reduce((total, party) => total + party.slots.filter(Boolean).length, 0) ?? 0 },
        ] as const).map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}>
            <tab.icon className="h-4 w-4" /><span>{tab.label}</span><strong>{tab.count}</strong>
          </button>
        ))}
        <div className="theme-builder-mode-switch">
          {GAME_MODES.map((mode) => <button key={mode.id} type="button" className={builder.gameMode === mode.id ? "is-active" : ""} onClick={() => updateBuilder((current) => ({ ...current, gameMode: mode.id }))}>{mode.label}</button>)}
        </div>
      </nav>

      {importOpen && (
        <section className="theme-builder-import-rack">
          <div><FieldLabel>Paste an Entropy code or gw2skills.net build URL</FieldLabel><textarea value={importCode} onChange={(event) => setImportCode(event.target.value)} placeholder="<AxiForge:...> or https://en.gw2skills.net/editor/?..." spellCheck={false} /></div>
          <div className="theme-builder-import-actions"><span className={detectedKind === "unknown" && !gw2SkillsInput ? "" : "is-ready"}>{gw2SkillsInput ? "gw2skills build detected" : kindLabel(detectedKind)}</span><button type="button" onClick={() => { setImportCode(""); setImportOpen(false); }}><Eraser className="h-4 w-4" /> Clear</button><button type="button" onClick={importBuildInput} disabled={importBusy || (detectedKind === "unknown" && !gw2SkillsInput)}>{importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Import</button></div>
        </section>
      )}

      {(loading || catalogError || notice) && (
        <div className={`theme-builder-notice ${catalogError || notice?.tone === "error" ? "is-error" : notice?.tone === "warning" ? "is-warning" : "is-success"}`}>
          {loading && !catalogError ? <Loader2 className="h-4 w-4 animate-spin" /> : catalogError || notice?.tone === "error" ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          <span>{catalogError ?? notice?.message ?? "Loading live Guild Wars 2 catalog..."}</span>
          {notice && <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-4 w-4" /></button>}
        </div>
      )}

      {activeTab === "library" && <BuildLibrary builds={workspace.builds} onLoad={loadBuild} onDuplicate={duplicateBuild} onDelete={removeBuild} onCopy={(code) => copyText(code, "Build AxiCode copied.")} onShare={(code) => copyText(buildAxiForgeShareUrl(code), "Share link copied.")} />}
      {activeTab === "squad" && <SquadWorkspace composition={activeComposition} builds={workspace.builds} boonCache={boonCache} boonComputing={boonComputing} onCreate={createSquad} onChange={updateComposition} onCopyCode={exportSquad} onShareCode={shareSquad} />}

      {activeTab === "build" && (
        <div className="theme-builder-layout">
          <main className="space-y-5">
          <div className="theme-builder-mode-toggle" role="tablist" aria-label="Builder view mode">
            <button type="button" className={builderViewMode === "edit" ? "is-active" : ""} onClick={() => setBuilderViewMode("edit")}>Edit</button>
            <button type="button" className={builderViewMode === "preview" ? "is-active" : ""} onClick={() => setBuilderViewMode("preview")}>Preview</button>
          </div>
          <div key={builderViewMode} className="theme-builder-mode-content">
          {builderViewMode === "edit" ? (
            <>
            <section className="theme-panel theme-builder-panel theme-builder-identity">
              <div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Loadout identity</div><h3>{editingBuildId ? "Editing saved build" : "Unsaved field draft"}</h3></div><button type="button" className="theme-quiet-button" onClick={() => { updateBuilder(createEmptyBuilder(builder.professionId)); setEditingBuildId(null); setExportCode(""); }}><RotateCcw className="h-4 w-4" /> Reset</button></div>
              <div className="grid gap-3 md:grid-cols-[minmax(16rem,1.5fr)_minmax(10rem,.7fr)_minmax(14rem,1fr)]">
                <label><FieldLabel>Build name</FieldLabel><TextField value={builder.name} onChange={(event) => updateBuilder((current) => ({ ...current, name: event.target.value }))} /></label>
                <label><FieldLabel>Role</FieldLabel><SelectField value={builder.role} onChange={(event) => updateBuilder((current) => ({ ...current, role: event.target.value }))}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role || "Choose role"}</option>)}</SelectField></label>
                <label><FieldLabel>Tags, comma separated</FieldLabel><TextField value={builder.tags.join(", ")} onChange={(event) => updateBuilder((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} placeholder="zerg, cleanse, guild" /></label>
              </div>
            </section>

            <section className="theme-panel theme-builder-panel">
              <div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Step 01</div><h3>Profession chassis</h3></div><Shield className="h-5 w-5 text-theme-accent" /></div>
              <div className="theme-builder-professions">
                {professions.map((profession) => (
                  <button key={profession.id} type="button" className={builder.professionId === profession.id ? "is-active" : ""} onClick={() => chooseProfession(profession)} onFocus={() => setSelectedSummary({ kind: "profession", item: profession })} onMouseEnter={() => setSelectedSummary({ kind: "profession", item: profession })}>
                    <span><ClassIcon name={profession.name} size="lg" /></span><strong>{profession.name}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="theme-panel theme-builder-panel">
              <div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Step 02</div><h3>Specializations and traits</h3></div><Layers3 className="h-5 w-5 text-theme-warning" /></div>
              <div className="theme-builder-spec-stack">
                {[0, 1, 2].map((trackIndex) => {
                  const selectedSpecId = builder.specializationIds[trackIndex];
                  const selectedSpec = selectedSpecId ? specsById.get(selectedSpecId) : null;
                  return (
                    <div key={trackIndex} className="theme-builder-spec-line">
                      <div className="theme-builder-spec-selector"><span>{String(trackIndex + 1).padStart(2, "0")}</span><SelectField value={selectedSpecId ?? ""} onChange={(event) => chooseSpec(trackIndex, event.target.value ? Number(event.target.value) : null)}><option value="">Choose specialization</option>{professionSpecs.map((spec) => <option key={spec.id} value={spec.id} disabled={builder.specializationIds.some((id, index) => index !== trackIndex && id === spec.id)}>{spec.name}{spec.elite ? " · Elite" : ""}</option>)}</SelectField>{selectedSpec?.icon && <button type="button" onClick={() => setSelectedSummary({ kind: "specialization", item: selectedSpec })}><img src={selectedSpec.icon} alt="" /></button>}</div>
                      <div className="theme-builder-trait-grid">
                        {[1, 2, 3].map((tier) => {
                          const traits = (selectedSpecId ? traitsBySpecId.get(selectedSpecId) ?? [] : []).filter((trait) => trait.slot === "Major" && trait.tier === tier).sort((a, b) => a.order - b.order);
                          return <div key={tier} className="theme-builder-trait-tier"><FieldLabel>Tier {tier}</FieldLabel><div>{traits.map((trait, position) => <button key={trait.id} type="button" className={builder.traitChoices[trackIndex][tier - 1] === position + 1 ? "is-active" : ""} onClick={() => chooseTrait(trackIndex, tier, position + 1, trait)} onFocus={() => setSelectedSummary({ kind: "trait", item: trait })} onMouseEnter={() => setSelectedSummary({ kind: "trait", item: trait })} title={trait.name}>{trait.icon ? <img src={trait.icon} alt="" /> : position + 1}</button>)}</div></div>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="theme-panel theme-builder-panel">
              <div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Step 03</div><h3>Land skill bar</h3></div><Swords className="h-5 w-5 text-theme-danger" /></div>
              <div className="theme-builder-skill-bar">
                <SkillPicker label="Heal" slot="Heal" selectedId={builder.healSkillId} skills={skillGroups.Heal} usedIds={[]} onChange={(id) => chooseSkill("Heal", id)} onInspect={(skill) => setSelectedSummary({ kind: "skill", item: skill })} />
                {[0, 1, 2].map((index) => <SkillPicker key={index} label={`Utility ${index + 1}`} slot="Utility" selectedId={builder.utilitySkillIds[index]} skills={skillGroups.Utility} usedIds={builder.utilitySkillIds} onChange={(id) => chooseSkill("Utility", id, index)} onInspect={(skill) => setSelectedSummary({ kind: "skill", item: skill })} />)}
                <SkillPicker label="Elite" slot="Elite" selectedId={builder.eliteSkillId} skills={skillGroups.Elite} usedIds={[]} onChange={(id) => chooseSkill("Elite", id)} onInspect={(skill) => setSelectedSummary({ kind: "skill", item: skill })} />
              </div>
            </section>

            <section className="theme-panel theme-builder-panel">
              <div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Step 04</div><h3>Equipment doctrine</h3></div><Wrench className="h-5 w-5 text-theme-info" /></div>
              <EquipmentLoadoutSheet builder={builder} items={equipmentItems} />
              <div className="theme-builder-equipment-grid">
                <div className="theme-builder-equipment-group">
                  <h4>Weapons and stats</h4>
                  <label>
                    <FieldLabel>Stat package</FieldLabel>
                    <SelectField value={builder.equipment.statPackage} onChange={(event) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, statPackage: event.target.value } }))}>
                      {statOptions.map((stat) => <option key={stat} value={stat}>{stat || "Choose stats"}</option>)}
                    </SelectField>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["mainhand1", "offhand1", "mainhand2", "offhand2"] as const).map((slot) => {
                      const currentWeapon = builder.equipment.weapons[slot];
                      const validWeapons = availableWeapons.filter(([, weapon]) => weaponFitsBuilderSlot(weapon, slot));
                      const currentIsValid = !currentWeapon || validWeapons.some(([name]) => name.toLowerCase() === currentWeapon.toLowerCase());
                      const setNumber = slot.endsWith("1") ? "I" : "II";
                      const mainhand = builder.equipment.weapons[`mainhand${slot.endsWith("1") ? "1" : "2"}`];
                      const offhandDisabled = slot.startsWith("offhand") && isTwoHandedWeapon(selectedProfession, mainhand);
                      return (
                        <label key={slot}>
                          <FieldLabel>{slot.startsWith("mainhand") ? `Main hand ${setNumber}` : `Off hand ${setNumber}`}</FieldLabel>
                          <SelectField
                            value={currentWeapon}
                            disabled={offhandDisabled}
                            onChange={(event) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, weapons: { ...current.equipment.weapons, [slot]: event.target.value } } }))}
                          >
                            <option value="">{offhandDisabled ? "Two-handed weapon equipped" : "Empty"}</option>
                            {!currentIsValid && <option value={currentWeapon}>Unavailable · {currentWeapon}</option>}
                            {validWeapons.map(([name]) => <option key={name} value={name.toLowerCase()}>{name}</option>)}
                          </SelectField>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="theme-builder-equipment-group">
                  <div className="theme-builder-equipment-group">
  <h4>Trinkets</h4>
  <div className="grid grid-cols-2 gap-2">
    {["amulet", "ring1", "ring2", "accessory1", "accessory2", "backpack"].map((trinketSlot) => {
      const current = builder.equipment.slots[trinketSlot] || "";
      return (
        <label key={trinketSlot}>
          <FieldLabel>{trinketSlot}</FieldLabel>
          <TextField
            value={current}
            onChange={(event) => updateBuilder((next) => ({ ...next, equipment: { ...next.equipment, slots: { ...next.equipment.slots, [trinketSlot]: event.target.value } } }))}
            placeholder="Empty"
          />
          {!current && <span className="theme-builder-choice-note">Unassigned</span>}
        </label>
      );
    })}
  </div>
</div>
<div className="theme-builder-equipment-group">
  <h4>Weapon skills</h4>
  <div className="grid grid-cols-2 gap-2">
    {(["mainhand1", "offhand1", "mainhand2", "offhand2"] as const).map((weaponSlot) => {
      const weaponName = builder.equipment.weapons[weaponSlot];
      const weaponEntry = weaponName ? availableWeapons.find(([name]) => name.toLowerCase() === weaponName.toLowerCase()) : null;
      const weaponSkills = weaponEntry ? (weaponEntry[1].skills ?? []) : [];
      return (
        <div key={weaponSlot} className="theme-builder-weapon-skills">
          <FieldLabel>{weaponSlot}</FieldLabel>
          {!weaponName ? (
            <span className="theme-builder-choice-note">Empty</span>
          ) : weaponSkills.length ? (
            <ul>
              {weaponSkills.map((skillRef) => {
                const skill = skillsById.get(skillRef.id);
                return (
                  <li key={`${skillRef.id}-${skillRef.slot}`}>
                    {skill?.icon ? <img src={skill.icon} alt="" /> : <FileCode2 className="h-4 w-4" aria-hidden="true" />}
                    <span>{skill?.name ?? `Skill ${skillRef.id}`}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="theme-builder-choice-note">No skill data available</span>
          )}
        </div>
      );
    })}
  </div>
</div>
<h4>Runes and sigils</h4>
                  {hasMixedRunes ? (
                    <div className="theme-builder-split-runes">
                      <span className="theme-builder-choice-note"><Layers3 className="h-3.5 w-3.5" /> Mixed imported rune set — each armor slot remains editable.</span>
                      {ARMOR_SLOTS.map((slot) => <SearchableItemChoiceField key={slot} id={`builder-rune-${slot}`} label={`${slot} rune`} valueId={builder.equipment.runes[slot]} choices={BUILDER_RUNE_CHOICES} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, runes: { ...current.equipment.runes, [slot]: value } } }))} placeholder="Search supported runes" />)}
                    </div>
                  ) : (
                    <SearchableItemChoiceField id="builder-rune-all" label="Armor rune" valueId={builder.equipment.runes.head} choices={BUILDER_RUNE_CHOICES} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, runes: Object.fromEntries(ARMOR_SLOTS.map((slot) => [slot, value])) as EntropyBuilderState["equipment"]["runes"] } }))} placeholder="Applied to all armor" />
                  )}
                  <EquipmentItemSummary values={Object.values(builder.equipment.runes)} items={equipmentItems} />
                  {(["mainhand1", "mainhand2"] as const).map((slot) => { const current = builder.equipment.sigils[slot]; return (
  <div key={slot} className="theme-builder-sigil-pair">
    <FieldLabel>{slot === "mainhand1" ? "Weapon set I sigils" : "Weapon set II sigils"}</FieldLabel>
    <div className="grid grid-cols-2 gap-2">
      {[0, 1].map((sigilIndex) => (
        <SearchableItemChoiceField
          key={sigilIndex}
          id={`builder-sigil-${slot}-${sigilIndex}`}
          label={`Sigil ${sigilIndex + 1}`}
          valueId={current[sigilIndex] ?? ""}
          choices={BUILDER_SIGIL_CHOICES}
          onChange={(value) => updateBuilder((next) => {
            const nextValues = [...next.equipment.sigils[slot]];
            if (value) nextValues[sigilIndex] = value; else nextValues.splice(sigilIndex, 1);
            return { ...next, equipment: { ...next.equipment, sigils: { ...next.equipment.sigils, [slot]: nextValues.filter(Boolean) } } };
          })}
          placeholder="Search supported sigils"
        />
      ))}
    </div>
    <EquipmentItemSummary values={current} items={equipmentItems} />
  </div>
); })}
                </div>
                <div className="theme-builder-equipment-group">
                  <h4>Relic and consumables</h4>
                  <SearchableChoiceField id="builder-relics" label="Relic" value={builder.equipment.relic} choices={BUILDER_RELIC_CHOICES} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, relic: value } }))} placeholder="Search supported relics" />
<EquipmentItemSummary values={[String(BUILDER_RELIC_IDS[builder.equipment.relic] ?? "")]} items={equipmentItems} />
                  <SearchableChoiceField id="builder-foods" label="Food" value={builder.equipment.food} choices={BUILDER_FOOD_LABELS} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, food: value } }))} placeholder="Search supported food" />
                  <SearchableChoiceField id="builder-utilities" label="Utility" value={builder.equipment.utility} choices={BUILDER_UTILITY_LABELS} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, utility: value } }))} placeholder="Search supported utilities" />
                  <SearchableItemChoiceField id="builder-enrichment" label="Enrichment" valueId={builder.equipment.enrichment} choices={BUILDER_ENRICHMENT_CHOICES} onChange={(value) => updateBuilder((current) => ({ ...current, equipment: { ...current.equipment, enrichment: value } }))} placeholder="Search supported enrichments" /><EquipmentItemSummary values={[builder.equipment.enrichment]} items={equipmentItems} />
                  {Object.keys(builder.equipment.infusions).length > 0 && (
                    <div>
                      <FieldLabel>Imported infusions</FieldLabel>
                      <div className="theme-builder-item-summary">
                        {Object.entries(builder.equipment.infusions).map(([slot, value]) => {
                          const values = (Array.isArray(value) ? value : [value]).filter(Boolean);
                          return (
                            <div key={slot}>
                              <Sparkles className="h-4 w-4" aria-hidden="true" />
                              <span><strong>{slot}</strong><small>{values.join(" · ")}</small></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {(builder.professionId === "Revenant" || builder.professionId === "Ranger" || builder.professionId === "Elementalist" || builder.professionId === "Engineer" || builder.professionId === "Warrior" || builder.professionId === "Thief") && (
              <section className="theme-panel theme-builder-panel"><div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Profession system</div><h3>{builder.professionId} mechanics</h3></div><Sparkles className="h-5 w-5 text-theme-accent" /></div><div className="theme-builder-mechanics">
                {builder.professionId === "Revenant" && <>{[0, 1].map((index) => <label key={index}><FieldLabel>Legend {index + 1}</FieldLabel><SelectField value={builder.selectedLegends[index]} onChange={(event) => updateBuilder((current) => ({ ...current, selectedLegends: current.selectedLegends.map((value, itemIndex) => itemIndex === index ? event.target.value : value) as [string, string] }))}><option value="">None</option>{legends.map((legend) => <option key={legend.id} value={legend.id}>{legendLabel(legend.id)}</option>)}</SelectField></label>)}</>}
                {builder.professionId === "Ranger" && <>{(["terrestrial1", "terrestrial2"] as const).map((field, index) => <label key={field}><FieldLabel>Terrestrial pet {index + 1}</FieldLabel><SelectField value={builder.selectedPets[field] || ""} onChange={(event) => updateBuilder((current) => ({ ...current, selectedPets: { ...current.selectedPets, [field]: Number(event.target.value) || 0 } }))}><option value="">None</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</SelectField></label>)}</>}
                {builder.professionId === "Elementalist" && <>{(["activeAttunement", "activeAttunement2"] as const).map((field, index) => <label key={field}><FieldLabel>Attunement {index + 1}</FieldLabel><SelectField value={builder[field]} onChange={(event) => updateBuilder((current) => ({ ...current, [field]: event.target.value }))}>{["", "Fire", "Water", "Air", "Earth"].map((attunement) => <option key={attunement} value={attunement}>{attunement || "None"}</option>)}</SelectField></label>)}</>}
                {builder.professionId === "Engineer" && <label><FieldLabel>Active kit</FieldLabel><SelectField value={builder.activeKit || ""} onChange={(event) => updateBuilder((current) => ({ ...current, activeKit: Number(event.target.value) || 0 }))}><option value="">None</option>{builder.activeKit > 0 && !engineerKitOptions.some((skill) => skill.id === builder.activeKit) && <option value={builder.activeKit}>Unavailable skill · {builder.activeKit}</option>}{engineerKitOptions.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</SelectField></label>}
                {builder.professionId === "Warrior" && <label><FieldLabel>Active weapon set</FieldLabel><SelectField value={builder.activeWeaponSet} onChange={(event) => updateBuilder((current) => ({ ...current, activeWeaponSet: Number(event.target.value) }))}><option value={1}>Weapon set I</option><option value={2}>Weapon set II</option></SelectField></label>}
                {builder.professionId === "Thief" && <>{(["f2", "f3", "f4"] as const).map((field) => { const currentId = builder.antiquaryArtifacts[field]; return <label key={field}><FieldLabel>Antiquary {field.toUpperCase()}</FieldLabel><SelectField value={currentId || ""} onChange={(event) => updateBuilder((current) => ({ ...current, antiquaryArtifacts: { ...current.antiquaryArtifacts, [field]: Number(event.target.value) || 0 } }))}><option value="">None</option>{currentId > 0 && !thiefArtifactOptions.some((skill) => skill.id === currentId) && <option value={currentId}>Unavailable skill · {currentId}</option>}{thiefArtifactOptions.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</SelectField></label>; })}</>}
              </div></section>
            )}

            <section className="theme-panel theme-builder-panel"><div className="theme-builder-section-head"><div><div className="theme-builder-kicker">Field notes</div><h3>Usage and callouts</h3></div><BookOpen className="h-5 w-5 text-theme-muted" /></div><textarea className="theme-builder-notes" value={builder.notes} onChange={(event) => updateBuilder((current) => ({ ...current, notes: event.target.value }))} placeholder="Rotation priorities, weapon swaps, party role, situational substitutions..." /></section>
                    </>
                  ) : (
                    <>
                      <BuildPreview
                        builder={builder}
                        profession={selectedProfession}
                        specsById={specsById}
                        traitsBySpecId={traitsBySpecId}
                        skillsById={skillsById}
                        attributeTotals={attributeTotals}
                      />
                      <EquipmentPreview
                        builder={builder}
                        items={equipmentItems}
                        availableWeapons={availableWeapons}
                        skillsById={skillsById}
                      />
                    </>
                  )}
          </div>
          </main>

          <aside className="theme-builder-rail">
            <div className="theme-builder-readiness"><div className="theme-builder-kicker">Readiness</div><div className="theme-builder-readiness-score"><strong>{Math.max(0, 6 - issues.length)}</strong><span>/ 6</span></div><div className="theme-builder-progress"><i style={{ width: `${Math.max(0, (6 - issues.length) / 6 * 100)}%` }} /></div>{issues.length ? <ul>{issues.map((issue) => <li key={issue}><ChevronRight className="h-3.5 w-3.5" />{issue}</li>)}</ul> : <p className="is-ready"><Check className="h-4 w-4" /> Build is ready to archive.</p>}</div>
            <DetailPanel selected={selectedSummary} />
            {exportCode && <div className="theme-builder-code-output"><div className="flex items-center justify-between"><FieldLabel>Last exported code</FieldLabel><button type="button" title="Copy code" onClick={() => copyText(exportCode, "AxiCode copied.")}><Clipboard className="h-4 w-4" /></button></div><code>{exportCode}</code></div>}
          </aside>
        </div>
      )}
    </div>
  );
}
