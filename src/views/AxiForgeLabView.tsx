import { useMemo, useState } from "react";
import {
  Braces,
  CheckCircle2,
  ClipboardPaste,
  Eraser,
  ExternalLink,
  FlaskConical,
  HeartPulse,
  Plus,
  Shield,
  Sparkles,
  Swords,
  TriangleAlert,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { decodeAxiForgeCode, detectAxiForgeCodeKind, type AxiForgeDecodeResult } from "../lib/axiforge/axiForgeAdapter";
import ProfessionIcon from "../components/ui/ProfessionIcon";

function kindLabel(kind: AxiForgeDecodeResult["kind"]): string {
  if (kind === "build") return "Build code";
  if (kind === "comp") return "Comp code";
  return "Unknown format";
}

const PROFESSIONS = [
  "Guardian",
  "Dragonhunter",
  "Firebrand",
  "Willbender",
  "Warrior",
  "Berserker",
  "Spellbreaker",
  "Bladesworn",
  "Revenant",
  "Herald",
  "Renegade",
  "Vindicator",
  "Engineer",
  "Scrapper",
  "Holosmith",
  "Mechanist",
  "Ranger",
  "Druid",
  "Soulbeast",
  "Untamed",
  "Thief",
  "Daredevil",
  "Deadeye",
  "Specter",
  "Elementalist",
  "Tempest",
  "Weaver",
  "Catalyst",
  "Necromancer",
  "Reaper",
  "Scourge",
  "Harbinger",
  "Mesmer",
  "Chronomancer",
  "Mirage",
  "Virtuoso",
];

const SQUAD_TAGS = [
  { id: "stability", label: "Stability", tone: "amber" },
  { id: "aegis", label: "Aegis", tone: "amber" },
  { id: "protection", label: "Protection", tone: "sky" },
  { id: "resistance", label: "Resistance", tone: "sky" },
  { id: "resolution", label: "Resolution", tone: "sky" },
  { id: "might", label: "Might", tone: "orange" },
  { id: "fury", label: "Fury", tone: "orange" },
  { id: "quickness", label: "Quickness", tone: "violet" },
  { id: "alacrity", label: "Alacrity", tone: "violet" },
  { id: "healing", label: "Healing", tone: "emerald" },
  { id: "barrier", label: "Barrier", tone: "emerald" },
  { id: "cleanse", label: "Cleanse", tone: "emerald" },
  { id: "rez", label: "Rez", tone: "emerald" },
  { id: "stunbreak", label: "Stunbreak", tone: "rose" },
  { id: "cc", label: "CC", tone: "rose" },
  { id: "strips", label: "Strips", tone: "rose" },
  { id: "damage", label: "Damage", tone: "red" },
  { id: "range", label: "Range", tone: "slate" },
] as const;

type SquadTagId = (typeof SQUAD_TAGS)[number]["id"];

type SquadRole = "Support" | "DPS" | "Hybrid" | "Utility";

interface SquadBuildSlot {
  id: string;
  party: number;
  name: string;
  profession: string;
  role: SquadRole;
  buildLink: string;
  tags: SquadTagId[];
  notes: string;
}

const SAMPLE_BUILD_LINK = "https://gw2skills.net/editor/?POwEYKyoutssC2CLhhwIxyVyrVWir3D-DWJYjRN/hEkCoaRQMTBfddoEBYP8WafzCA-w";

const INITIAL_SQUAD: SquadBuildSlot[] = [
  {
    id: "slot-1",
    party: 1,
    name: "GW2Skills build",
    profession: "Revenant",
    role: "Hybrid",
    buildLink: SAMPLE_BUILD_LINK,
    tags: ["damage", "strips", "cc", "rez"],
    notes: "External GW2Skills link preserved. Adjust class/boon tags after confirming the exact build.",
  },
  {
    id: "slot-2",
    party: 1,
    name: "Firebrand support",
    profession: "Firebrand",
    role: "Support",
    buildLink: "",
    tags: ["stability", "aegis", "protection", "cleanse", "healing", "rez"],
    notes: "Core party support shell; replace with real AxiForge/GW2Skills build link.",
  },
  {
    id: "slot-3",
    party: 1,
    name: "Scrapper support",
    profession: "Scrapper",
    role: "Support",
    buildLink: "",
    tags: ["quickness", "superspeed" as SquadTagId, "cleanse", "healing", "barrier", "rez"].filter((tag): tag is SquadTagId => SQUAD_TAGS.some((item) => item.id === tag)),
    notes: "Cleanse/sustain slot. Tags are editable; this is a planning placeholder.",
  },
];

function tagClass(tone: string, active = true): string {
  if (!active) return "border-white/10 bg-white/[0.03] text-slate-500";
  if (tone === "amber") return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  if (tone === "sky") return "border-sky-400/25 bg-sky-500/10 text-sky-200";
  if (tone === "orange") return "border-orange-400/25 bg-orange-500/10 text-orange-200";
  if (tone === "violet") return "border-violet-400/25 bg-violet-500/10 text-violet-200";
  if (tone === "emerald") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (tone === "rose") return "border-rose-400/25 bg-rose-500/10 text-rose-200";
  if (tone === "red") return "border-red-400/25 bg-red-500/10 text-red-200";
  return "border-slate-400/20 bg-slate-500/10 text-slate-300";
}

function isExternalBuildLink(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function emptySlot(id: string, party: number): SquadBuildSlot {
  return {
    id,
    party,
    name: "New build",
    profession: "Guardian",
    role: "Support",
    buildLink: "",
    tags: [],
    notes: "",
  };
}

function squadCoverage(slots: SquadBuildSlot[]) {
  return SQUAD_TAGS.map((tag) => ({
    ...tag,
    count: slots.filter((slot) => slot.tags.includes(tag.id)).length,
  }));
}

function partyLabel(party: number): string {
  return `Party ${party}`;
}

function SquadBuilder() {
  const [slots, setSlots] = useState<SquadBuildSlot[]>(INITIAL_SQUAD);
  const coverage = useMemo(() => squadCoverage(slots), [slots]);
  const parties = [1, 2, 3, 4, 5];

  function updateSlot(id: string, patch: Partial<SquadBuildSlot>) {
    setSlots((current) => current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  }

  function toggleTag(slot: SquadBuildSlot, tag: SquadTagId) {
    const nextTags = slot.tags.includes(tag)
      ? slot.tags.filter((item) => item !== tag)
      : [...slot.tags, tag];
    updateSlot(slot.id, { tags: nextTags });
  }

  function addSlot(party: number) {
    setSlots((current) => [...current, emptySlot(`slot-${Date.now()}`, party)]);
  }

  function removeSlot(id: string) {
    setSlots((current) => current.filter((slot) => slot.id !== id));
  }

  return (
    <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-100">
            <Users className="h-5 w-5 text-sky-300" /> Squad builder
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Draft parties, attach AxiForge or GW2Skills links, and mark what each build contributes. This is planner data only;
            it does not alter reports or Intelligence output.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-200">
            {slots.length} builds
          </span>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-200">
            {coverage.filter((item) => item.count > 0).length}/{coverage.length} covered
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-white/[0.06] bg-black/25 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          <Sparkles className="h-4 w-4 text-emerald-300" /> Squad coverage
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {coverage.map((item) => (
            <div key={item.id} className="grid grid-cols-[92px_1fr_36px] items-center gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{item.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full ${item.count > 0 ? "bg-emerald-300" : "bg-slate-700"}`}
                  style={{ width: `${Math.min(100, Math.max(item.count > 0 ? 18 : 8, item.count * 25))}%` }}
                />
              </div>
              <span className="text-right font-mono text-[11px] font-bold text-slate-400">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {parties.map((party) => {
          const partySlots = slots.filter((slot) => slot.party === party);
          return (
            <div key={party} className="rounded-2xl border border-white/[0.06] bg-[#070b16]/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">{partyLabel(party)}</h3>
                  <p className="text-xs text-slate-500">{partySlots.length}/5 planned slots</p>Entropy BuilderEntropy BuilderEntPaste an Entropy Builder build/comp code here. GW2Skills links belong in the squad builder below.ropy Builder/GW2Skills build link.Entropy Builder code or https://gw2skills.net/editor/...Entropy Builder or GW2Skills links codes
                </div>
                <button
                  type="button"
                  onClick={() => addSlot(party)}
                  disabled={partySlots.length >= 5}
                  className="flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Add build
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {partySlots.map((slot) => (
                  <div key={slot.id} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                    <div className="grid gap-3 xl:grid-cols-[1.1fr_0.8fr]">
                      <div className="grid gap-3 md:grid-cols-[1fr_190px_130px]">
                        <label className="grid gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Build name</span>
                          <input
                            value={slot.name}
                            onChange={(event) => updateSlot(slot.id, { name: event.target.value })}
                            className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-400/40"
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Class</span>
                          <div className="relative">
                            <select
                              value={slot.profession}
                              onChange={(event) => updateSlot(slot.id, { profession: event.target.value })}
                              className="w-full appearance-none rounded-xl border border-white/10 bg-black/45 px-3 py-2 pr-9 text-sm text-slate-200 outline-none focus:border-sky-400/40"
                            >
                              {PROFESSIONS.map((profession) => (
                                <option key={profession} value={profession}>{profession}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                              <ProfessionIcon profession={slot.profession} className="h-4 w-4" />
                            </div>
                          </div>
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Role</span>
                          <select
                            value={slot.role}
                            onChange={(event) => updateSlot(slot.id, { role: event.target.value as SquadRole })}
                            className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-400/40"
                          >
                            <option>Support</option>
                            <option>DPS</option>
                            <option>Hybrid</option>
                            <option>Utility</option>
                          </select>
                        </label>
                      </div>

                      <div className="flex items-start gap-3 xl:justify-end">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200">
                          <ProfessionIcon profession={slot.profession} className="h-7 w-7" />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSlot(slot.id)}
                          className="rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-2 text-rose-300 transition hover:bg-rose-500/10"
                          aria-label={`Remove ${slot.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Build link or code</span>
                        <input
                          value={slot.buildLink}
                          onChange={(event) => updateSlot(slot.id, { buildLink: event.target.value })}
                          placeholder="AxiForge code or https://gw2skills.net/editor/..."
                          className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-sky-400/40"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Notes</span>
                        <input
                          value={slot.notes}
                          onChange={(event) => updateSlot(slot.id, { notes: event.target.value })}
                          placeholder="What to check, party assignment, swap notes..."
                          className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-400/40"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {SQUAD_TAGS.map((tag) => {
                        const active = slot.tags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(slot, tag.id)}
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${tagClass(tag.tone, active)}`}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1.5">
                        {slot.role === "Support" ? <Shield className="h-3.5 w-3.5" /> : slot.role === "DPS" ? <Swords className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
                        {slot.profession} · {slot.role}
                      </span>
                      {isExternalBuildLink(slot.buildLink) && (
                        <a href={slot.buildLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sky-300 hover:text-sky-200">
                          Open build <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {partySlots.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-500">
                    No builds assigned to this party yet.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AxiForgeLabView() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<AxiForgeDecodeResult | null>(null);
  const detectedKind = useMemo(() => detectAxiForgeCodeKind(code), [code]);

  const preview = useMemo(() => {
    if (!result?.ok) return null;
    try {
      return JSON.stringify(result.value, null, 2);
    } catch {
      return null;
    }
  }, [result]);

  function handleDecode() {
    setResult(decodeAxiForgeCode(code));
  }

  function handleClear() {
    setCode("");
    setResult(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <section className="rounded-[2rem] border border-white/[0.06] bg-black/45 p-6 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-3 text-sky-300">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-100">AxiForge Lab</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Decode AxiForge codes, preserve external build links, and draft squad compositions before connecting them to reports.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/[0.06] bg-black/35 p-6">
        <label htmlFor="axiforge-code" className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Build or comp code
        </label>
        <textarea
          id="axiforge-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setResult(null);
          }}
          placeholder="Paste an AxiForge build/comp code here. GW2Skills links belong in the squad builder below."
          spellCheck={false}
          className="mt-3 min-h-36 w-full resize-y rounded-2xl border border-white/10 bg-black/45 p-4 font-mono text-sm text-slate-200 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
            detectedKind === "unknown"
              ? "border-white/10 bg-white/[0.03] text-slate-400"
              : "border-sky-400/20 bg-sky-500/10 text-sky-300"
          }`}>
            {code.trim() ? kindLabel(detectedKind) : "Waiting for code"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={!code && !result}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:border-white/20 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
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
      </section>

      {result && !result.ok && (
        <section role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] p-4 text-rose-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold">This code could not be decoded.</div>
            <p className="mt-1 text-sm text-rose-200/75">Check that the complete AxiForge build or comp code was pasted, then try again.</p>
          </div>
        </section>
      )}

      {result?.ok && (
        <section className="overflow-hidden rounded-[2rem] border border-emerald-400/15 bg-black/35">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Decoded {kindLabel(result.kind).toLowerCase()}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Braces className="h-4 w-4" /> JSON preview
            </div>
          </div>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-slate-300">
            {preview ?? "Decoded data cannot be displayed as JSON."}
          </pre>
        </section>
      )}

      <SquadBuilder />
    </div>
  );
}
