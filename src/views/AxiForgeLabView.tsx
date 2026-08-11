import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Clipboard,
  ClipboardPaste,
  Code2,
  Eraser,
  ExternalLink,
  Loader2,
  Save,
  Shield,
  Sparkles,
  Swords,
  Wand2,
} from "lucide-react";
import {
  decodeAxiForgeCode,
  detectAxiForgeCodeKind,
  encodeAxiForgeBuildCode,
  type AxiForgeDecodeResult,
} from "../lib/axiforge/axiForgeAdapter";
import {
  fetchGw2Professions,
  fetchGw2Skills,
  fetchGw2Specializations,
  fetchGw2Traits,
  wikiSearchUrl,
} from "../lib/gw2/gw2Api";
import type {
  BuilderSummaryItem,
  EntropyBuilderState,
  Gw2ApiFact,
  Gw2Profession,
  Gw2Skill,
  Gw2SkillSlot,
  Gw2Specialization,
  Gw2Trait,
} from "../types/buildEditor";

const EMPTY_STATE: EntropyBuilderState = {
  professionId: "Guardian",
  gameMode: "wvw",
  specializationIds: [null, null, null],
  traitChoices: {},
  healSkillId: null,
  utilitySkillIds: [null, null, null],
  eliteSkillId: null,
};

const GAME_MODES = [
  { id: "wvw", label: "WvW" },
  { id: "pve", label: "PvE" },
  { id: "pvp", label: "PvP" },
] as const;

function traitKey(trackIndex: number, tier: number): string {
  return `${trackIndex}:${tier}`;
}

function kindLabel(kind: AxiForgeDecodeResult["kind"]): string {
  if (kind === "build") return "Build code";
  if (kind === "comp") return "Squad code";
  return "Unknown format";
}

function factLabel(fact: Gw2ApiFact): string {
  const parts = [fact.text, fact.status, fact.description].filter(Boolean);
  const value = fact.value ?? fact.percent ?? fact.apply_count ?? fact.duration;
  if (value !== undefined) parts.push(String(value));
  return parts.join(" · ");
}

function skillSlotLabel(slot: Gw2SkillSlot, index?: number): string {
  if (slot === "Utility" && index !== undefined) return `Utility ${index + 1}`;
  return slot;
}

function asDecodedBuild(value: unknown): Partial<{
  profession: string;
  gameMode: EntropyBuilderState["gameMode"];
  specializations: { id?: number; traitChoices?: number[] }[];
  skills: { healId?: number; utilityIds?: number[]; eliteId?: number };
}> | null {
  if (!value || typeof value !== "object") return null;
  return value as Partial<{
    profession: string;
    gameMode: EntropyBuilderState["gameMode"];
    specializations: { id?: number; traitChoices?: number[] }[];
    skills: { healId?: number; utilityIds?: number[]; eliteId?: number };
  }>;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Decoded data cannot be displayed as JSON.";
  }
}

function buildEncodeShape(
  builder: EntropyBuilderState,
  specsById: Map<number, Gw2Specialization>,
  traitsBySpecId: Map<number, Gw2Trait[]>,
  skillsById: Map<number, Gw2Skill>,
) {
  return {
    profession: builder.professionId,
    gameMode: builder.gameMode,
    specializations: builder.specializationIds.map((specId, trackIndex) => {
      if (!specId) return { id: 0 };
      const spec = specsById.get(specId);
      const majorTraitsByTier: Record<number, { id: number }[]> = {};
      const majorChoices: Record<number, number | null> = {};
      for (const tier of [1, 2, 3]) {
        majorTraitsByTier[tier] = (traitsBySpecId.get(specId) ?? [])
          .filter((trait) => trait.slot === "Major" && trait.tier === tier)
          .sort((a, b) => a.order - b.order)
          .map((trait) => ({ id: trait.id }));
        majorChoices[tier] = builder.traitChoices[traitKey(trackIndex, tier)] ?? null;
      }
      return {
        id: specId,
        name: spec?.name ?? `Specialization ${specId}`,
        elite: spec?.elite ?? false,
        majorTraitsByTier,
        majorChoices,
      };
    }),
    skills: {
      heal: builder.healSkillId ? { id: builder.healSkillId, name: skillsById.get(builder.healSkillId)?.name } : null,
      utility: builder.utilitySkillIds.map((id) => (id ? { id, name: skillsById.get(id)?.name } : null)),
      elite: builder.eliteSkillId ? { id: builder.eliteSkillId, name: skillsById.get(builder.eliteSkillId)?.name } : null,
    },
    underwaterSkills: { heal: null, utility: [null, null, null], elite: null },
    equipment: {
      statPackage: "",
      slots: {},
      weapons: { mainhand1: "", offhand1: "", mainhand2: "", offhand2: "", aquatic1: "", aquatic2: "" },
      runes: { head: "0", shoulders: "0", chest: "0", hands: "0", legs: "0", feet: "0" },
      sigils: { mainhand1: ["0"], offhand1: [], mainhand2: [], offhand2: [], aquatic1: [], aquatic2: [] },
      infusions: {},
      relic: "",
      food: "",
      utility: "",
      enrichment: "",
    },
  };
}

function IconTile({
  icon,
  name,
  active,
  disabled,
  onClick,
  onInspect,
}: {
  icon?: string;
  name: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onInspect?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onInspect}
      onFocus={onInspect}
      className={`group flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition ${
        active
          ? "border-amber-300/45 bg-amber-400/10 text-amber-100 shadow-[0_0_28px_-18px_rgba(251,191,36,0.95)]"
          : "border-white/[0.07] bg-black/30 text-slate-300 hover:border-sky-300/30 hover:bg-sky-500/[0.06]"
      } ${disabled ? "cursor-not-allowed opacity-35" : ""}`}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
        {icon ? <img src={icon} alt="" className="h-8 w-8 object-contain" /> : <Sparkles className="h-5 w-5 text-slate-500" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{name}</span>
        <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-slate-500 group-hover:text-sky-300/80">
          Click to select
        </span>
      </span>
    </button>
  );
}

function WikiSummaryPanel({ selected }: { selected: BuilderSummaryItem | null }) {
  if (!selected) {
    return (
      <aside className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-200">
          <Braces className="h-4 w-4 text-sky-300" />
          Wiki Summary
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Hover or click a profession, specialization, trait, or skill to inspect what it brings.
        </p>
      </aside>
    );
  }

  const item = selected.item;
  const facts = "facts" in item ? item.facts ?? [] : [];
  const description = "description" in item ? item.description : "";
  const icon =
    selected.kind === "profession"
      ? selected.item.icon_big ?? selected.item.icon
      : "icon" in item
        ? item.icon
        : undefined;

  return (
    <aside className="sticky top-6 rounded-[2rem] border border-sky-300/10 bg-black/45 p-5 shadow-[0_18px_60px_-28px_rgba(56,189,248,0.75)]">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {icon ? <img src={icon} alt="" className="h-12 w-12 object-contain" /> : <Sparkles className="h-6 w-6 text-sky-300" />}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">{selected.kind}</div>
          <h3 className="mt-1 truncate text-lg font-black text-slate-100">{item.name}</h3>
        </div>
      </div>

      {description && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-300">{description}</p>}

      {facts.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Effects</div>
          {facts.slice(0, 7).map((fact, index) => (
            <div key={`${fact.type ?? "fact"}-${index}`} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
              {fact.icon && <img src={fact.icon} alt="" className="mr-2 inline h-4 w-4 align-text-bottom" />}
              {factLabel(fact) || fact.type || "Effect"}
            </div>
          ))}
        </div>
      )}

      <a
        href={wikiSearchUrl(item.name)}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-500/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-wider text-sky-200 transition hover:bg-sky-500/[0.12]"
      >
        Open wiki <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </aside>
  );
}

export default function AxiForgeLabView() {
  const [builder, setBuilder] = useState<EntropyBuilderState>(EMPTY_STATE);
  const [professions, setProfessions] = useState<Gw2Profession[]>([]);
  const [professionSpecs, setProfessionSpecs] = useState<Gw2Specialization[]>([]);
  const [selectedSpecTraits, setSelectedSpecTraits] = useState<Gw2Trait[]>([]);
  const [professionSkills, setProfessionSkills] = useState<Gw2Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [decodeResult, setDecodeResult] = useState<AxiForgeDecodeResult | null>(null);
  const [encodedCode, setEncodedCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<BuilderSummaryItem | null>(null);

  const detectedKind = useMemo(() => detectAxiForgeCodeKind(code), [code]);
  const selectedProfession = useMemo(
    () => professions.find((profession) => profession.id === builder.professionId) ?? null,
    [builder.professionId, professions],
  );
  const specsById = useMemo(() => new Map(professionSpecs.map((spec) => [spec.id, spec])), [professionSpecs]);
  const traitsBySpecId = useMemo(() => {
    const map = new Map<number, Gw2Trait[]>();
    for (const trait of selectedSpecTraits) {
      const current = map.get(trait.specialization) ?? [];
      current.push(trait);
      map.set(trait.specialization, current);
    }
    return map;
  }, [selectedSpecTraits]);
  const skillsById = useMemo(() => new Map(professionSkills.map((skill) => [skill.id, skill])), [professionSkills]);
  const selectedSpecObjects = useMemo(
    () => builder.specializationIds.map((id) => (id ? specsById.get(id) ?? null : null)),
    [builder.specializationIds, specsById],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGw2Professions()
      .then((items) => {
        if (cancelled) return;
        setProfessions(items);
        if (!items.some((item) => item.id === builder.professionId) && items[0]) {
          setBuilder((current) => ({ ...current, professionId: items[0].id }));
        }
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(error instanceof Error ? error.message : "Unable to load GW2 build data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProfession) return;
    let cancelled = false;
    setCatalogError(null);
    Promise.all([
      fetchGw2Specializations(selectedProfession.specializations),
      fetchGw2Skills(selectedProfession.skills.map((skill) => skill.id)),
    ])
      .then(([specs, skills]) => {
        if (cancelled) return;
        setProfessionSpecs(specs);
        setProfessionSkills(skills);
        setBuilder((current) => ({
          ...current,
          specializationIds: current.specializationIds.map((id) => (id && specs.some((spec) => spec.id === id) ? id : null)) as [
            number | null,
            number | null,
            number | null,
          ],
          healSkillId: current.healSkillId && skills.some((skill) => skill.id === current.healSkillId) ? current.healSkillId : null,
          utilitySkillIds: current.utilitySkillIds.map((id) => (id && skills.some((skill) => skill.id === id) ? id : null)) as [
            number | null,
            number | null,
            number | null,
          ],
          eliteSkillId: current.eliteSkillId && skills.some((skill) => skill.id === current.eliteSkillId) ? current.eliteSkillId : null,
        }));
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(error instanceof Error ? error.message : "Unable to load profession data.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProfession?.id]);

  useEffect(() => {
    const traitIds = selectedSpecObjects.flatMap((spec) => spec?.major_traits ?? []);
    let cancelled = false;
    fetchGw2Traits(traitIds)
      .then((traits) => {
        if (!cancelled) setSelectedSpecTraits(traits);
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(error instanceof Error ? error.message : "Unable to load traits.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSpecObjects.map((spec) => spec?.id ?? 0).join(":")]);

  function chooseProfession(profession: Gw2Profession) {
    setBuilder({
      ...EMPTY_STATE,
      professionId: profession.id,
      gameMode: builder.gameMode,
    });
    setSelectedSummary({ kind: "profession", item: profession });
    setEncodedCode("");
    setDecodeResult(null);
  }

  function chooseSpec(trackIndex: number, spec: Gw2Specialization) {
    setBuilder((current) => {
      const specializationIds = [...current.specializationIds] as EntropyBuilderState["specializationIds"];
      specializationIds[trackIndex] = spec.id;
      const traitChoices = { ...current.traitChoices };
      for (const tier of [1, 2, 3]) traitChoices[traitKey(trackIndex, tier)] = null;
      return { ...current, specializationIds, traitChoices };
    });
    setSelectedSummary({ kind: "specialization", item: spec });
    setEncodedCode("");
  }

  function chooseTrait(trackIndex: number, trait: Gw2Trait) {
    setBuilder((current) => ({
      ...current,
      traitChoices: { ...current.traitChoices, [traitKey(trackIndex, trait.tier)]: trait.id },
    }));
    setSelectedSummary({ kind: "trait", item: trait });
    setEncodedCode("");
  }

  function chooseSkill(slot: Gw2SkillSlot, id: number | null, utilityIndex?: number) {
    setBuilder((current) => {
      if (slot === "Heal") return { ...current, healSkillId: id };
      if (slot === "Elite") return { ...current, eliteSkillId: id };
      if (slot === "Utility" && utilityIndex !== undefined) {
        const utilitySkillIds = [...current.utilitySkillIds] as EntropyBuilderState["utilitySkillIds"];
        utilitySkillIds[utilityIndex] = id;
        return { ...current, utilitySkillIds };
      }
      return current;
    });
    const skill = id ? skillsById.get(id) : null;
    if (skill) setSelectedSummary({ kind: "skill", item: skill });
    setEncodedCode("");
  }

  function handleDecode() {
    const result = decodeAxiForgeCode(code);
    setDecodeResult(result);
    setEncodedCode("");
    if (!result.ok) return;

    const decoded = asDecodedBuild(result.value);
    if (!decoded?.profession) return;
    const utilityIds = decoded.skills?.utilityIds ?? [];
    setBuilder((current) => ({
      ...current,
      professionId: decoded.profession ?? current.professionId,
      gameMode: decoded.gameMode ?? current.gameMode,
      specializationIds: [0, 1, 2].map((index) => decoded.specializations?.[index]?.id || null) as [
        number | null,
        number | null,
        number | null,
      ],
      traitChoices: {},
      healSkillId: decoded.skills?.healId || null,
      utilitySkillIds: [utilityIds[0] || null, utilityIds[1] || null, utilityIds[2] || null],
      eliteSkillId: decoded.skills?.eliteId || null,
    }));
    setStatus("Imported build code into the editor. Trait rows are ready for review.");
  }

  function handleClear() {
    setCode("");
    setDecodeResult(null);
    setEncodedCode("");
    setStatus(null);
  }

  async function handleEncode() {
    try {
      const shape = buildEncodeShape(builder, specsById, traitsBySpecId, skillsById);
      const output = encodeAxiForgeBuildCode(shape);
      setEncodedCode(output);
      await navigator.clipboard?.writeText(output);
      setStatus("Build code copied to clipboard.");
    } catch {
      setStatus("Build code could not be created yet. Choose a profession, specializations, and skills first.");
    }
  }

  const skillGroups = useMemo(
    () => ({
      Heal: professionSkills.filter((skill) => skill.slot === "Heal"),
      Utility: professionSkills.filter((skill) => skill.slot === "Utility"),
      Elite: professionSkills.filter((skill) => skill.slot === "Elite"),
    }),
    [professionSkills],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/[0.06] bg-black/45 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex flex-col gap-5 border-b border-white/[0.06] p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-3 text-sky-300">
              <Wand2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-widest text-slate-100">Entropy Builder</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                Build a profession template, inspect traits and skills from live GW2 data, and export a compact build code for the squad workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {GAME_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setBuilder((current) => ({ ...current, gameMode: mode.id }))}
                className={`rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  builder.gameMode === mode.id
                    ? "border-amber-300/40 bg-amber-400/10 text-amber-200"
                    : "border-white/10 bg-black/30 text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {(loading || catalogError) && (
          <div className={`m-5 flex items-center gap-3 rounded-2xl border p-4 text-sm ${
            catalogError ? "border-rose-400/20 bg-rose-500/[0.08] text-rose-200" : "border-sky-300/15 bg-sky-500/[0.06] text-sky-200"
          }`}>
            {catalogError ? <AlertCircle className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            {catalogError ?? "Loading live GW2 build data..."}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-200">
              <Shield className="h-4 w-4 text-amber-300" />
              Profession
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {professions.map((profession) => (
                <IconTile
                  key={profession.id}
                  icon={profession.icon_big ?? profession.icon}
                  name={profession.name}
                  active={builder.professionId === profession.id}
                  onClick={() => chooseProfession(profession)}
                  onInspect={() => setSelectedSummary({ kind: "profession", item: profession })}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-200">
              <Sparkles className="h-4 w-4 text-sky-300" />
              Specializations & Traits
            </div>
            <div className="space-y-5">
              {[0, 1, 2].map((trackIndex) => {
                const selectedSpec = selectedSpecObjects[trackIndex];
                return (
                  <div key={trackIndex} className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Track {trackIndex + 1}</div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {professionSpecs.map((spec) => {
                        const usedElsewhere = builder.specializationIds.some((id, index) => index !== trackIndex && id === spec.id);
                        return (
                          <IconTile
                            key={spec.id}
                            icon={spec.icon}
                            name={spec.name}
                            active={builder.specializationIds[trackIndex] === spec.id}
                            disabled={usedElsewhere}
                            onClick={() => chooseSpec(trackIndex, spec)}
                            onInspect={() => setSelectedSummary({ kind: "specialization", item: spec })}
                          />
                        );
                      })}
                    </div>

                    {selectedSpec && (
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {[1, 2, 3].map((tier) => {
                          const tierTraits = (traitsBySpecId.get(selectedSpec.id) ?? []).filter((trait) => trait.slot === "Major" && trait.tier === tier);
                          return (
                            <div key={tier} className="rounded-2xl border border-white/[0.06] bg-black/25 p-3">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tier {tier}</div>
                              <div className="space-y-2">
                                {tierTraits.map((trait) => (
                                  <IconTile
                                    key={trait.id}
                                    icon={trait.icon}
                                    name={trait.name}
                                    active={builder.traitChoices[traitKey(trackIndex, tier)] === trait.id}
                                    onClick={() => chooseTrait(trackIndex, trait)}
                                    onInspect={() => setSelectedSummary({ kind: "trait", item: trait })}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-200">
              <Swords className="h-4 w-4 text-rose-300" />
              Skill Bar
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
              {(["Heal", "Utility", "Utility", "Utility", "Elite"] as const).map((slot, index) => {
                const utilityIndex = slot === "Utility" ? index - 1 : undefined;
                const selectedId = slot === "Heal" ? builder.healSkillId : slot === "Elite" ? builder.eliteSkillId : builder.utilitySkillIds[utilityIndex ?? 0];
                const options = skillGroups[slot].filter((skill) => slot !== "Utility" || !builder.utilitySkillIds.includes(skill.id) || selectedId === skill.id);
                return (
                  <div key={`${slot}-${index}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {skillSlotLabel(slot, utilityIndex)}
                    </label>
                    <select
                      value={selectedId ?? ""}
                      onChange={(event) => chooseSkill(slot, event.target.value ? Number(event.target.value) : null, utilityIndex)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-300/40"
                    >
                      <option value="">Choose skill</option>
                      {options.map((skill) => (
                        <option key={skill.id} value={skill.id}>{skill.name}</option>
                      ))}
                    </select>
                    {selectedId && skillsById.get(selectedId) && (
                      <button
                        type="button"
                        onClick={() => setSelectedSummary({ kind: "skill", item: skillsById.get(selectedId)! })}
                        className="mt-3 flex w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-black/25 p-2 text-left text-xs text-slate-300 hover:border-sky-300/25"
                      >
                        {skillsById.get(selectedId)?.icon && <img src={skillsById.get(selectedId)?.icon} alt="" className="h-8 w-8 rounded-lg" />}
                        <span className="line-clamp-2">{skillsById.get(selectedId)?.name}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-200">
                <ClipboardPaste className="h-4 w-4 text-sky-300" />
                Import Code
              </div>
              <textarea
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setDecodeResult(null);
                }}
                placeholder="Paste a compact build or squad code here..."
                spellCheck={false}
                className="min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-black/45 p-4 font-mono text-xs text-slate-200 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
                  detectedKind === "unknown" ? "border-white/10 bg-white/[0.03] text-slate-400" : "border-sky-400/20 bg-sky-500/10 text-sky-300"
                }`}>
                  {code.trim() ? kindLabel(detectedKind) : "Waiting for code"}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:border-white/20 hover:text-slate-200"
                  >
                    <Eraser className="h-4 w-4" /> Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleDecode}
                    disabled={!code.trim()}
                    className="flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ClipboardPaste className="h-4 w-4" /> Decode
                  </button>
                </div>
              </div>

              {decodeResult && !decodeResult.ok && (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] p-4 text-sm text-rose-200">
                  This code could not be decoded. Check that the whole code was pasted, then try again.
                </div>
              )}

              {decodeResult?.ok && (
                <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-emerald-300/10 bg-black/45 p-4 font-mono text-xs leading-6 text-slate-300">
                  {safeJson(decodeResult.value)}
                </pre>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-200">
                <Code2 className="h-4 w-4 text-amber-300" />
                Export Build
              </div>
              <p className="text-sm leading-6 text-slate-400">
                Export copies the current build shell as a compact code. Equipment and squad publishing will layer onto this same model next.
              </p>
              <button
                type="button"
                onClick={handleEncode}
                className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-400/20"
              >
                <Save className="h-4 w-4" /> Copy build code
              </button>
              {encodedCode && (
                <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/45 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                  </div>
                  <code className="block break-all font-mono text-xs text-slate-300">{encodedCode}</code>
                </div>
              )}
              {status && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-sm text-slate-300">
                  <Clipboard className="mt-0.5 h-4 w-4 text-sky-300" />
                  {status}
                </div>
              )}
            </div>
          </section>
        </div>

        <WikiSummaryPanel selected={selectedSummary} />
      </div>
    </div>
  );
}
