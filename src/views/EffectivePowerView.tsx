import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  CircleGauge,
  Database,
  Download,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { importGw2SkillsForEffectivePower } from "../lib/effectivePower/importBuild";
import { effectivePowerGameMode } from "../lib/effectivePower/normalizedBuild";
import {
  calculateEffectivePower,
  compareEffectivePower,
  EFFECTIVE_POWER_RULESET,
  type EffectivePowerGameMode,
  type EffectivePowerInput,
  type EffectivePowerMarginal,
} from "../lib/effectivePower/effectivePower";
import "../Styles/EffectivePower.css";

interface SharedAssumptions {
  gameMode: EffectivePowerGameMode;
  furyUptimePercent: number;
  mightStacks: number;
  mightUptimePercent: number;
  vulnerabilityStacks: number;
}

interface BuildDraft {
  id: string;
  name: string;
  power: number;
  precision: number;
  ferocity: number;
  bonusCriticalChancePercent: number;
  bonusCriticalDamagePercent: number;
  strikeDamageModifierPercent: number;
  source?: {
    kind: "gw2skills" | "entropy-builder";
    label: string;
    url?: string;
    professionId: string;
    statPackage: string;
    importedAt: string;
    warnings: string[];
    edited: boolean;
  };
}

interface EffectivePowerWorkspaceState {
  assumptions: SharedAssumptions;
  builds: BuildDraft[];
}

const STORAGE_KEY = "entropy:effective-power:v1";

const DEFAULT_STATE: EffectivePowerWorkspaceState = {
  assumptions: {
    gameMode: "wvw",
    furyUptimePercent: 100,
    mightStacks: 25,
    mightUptimePercent: 100,
    vulnerabilityStacks: 25,
  },
  builds: [
    {
      id: "build-a",
      name: "Power baseline",
      power: 3000,
      precision: 2995,
      ferocity: 1050,
      bonusCriticalChancePercent: 0,
      bonusCriticalDamagePercent: 0,
      strikeDamageModifierPercent: 0,
    },
    {
      id: "build-b",
      name: "Ferocity tradeoff",
      power: 3200,
      precision: 2575,
      ferocity: 1350,
      bonusCriticalChancePercent: 0,
      bonusCriticalDamagePercent: 0,
      strikeDamageModifierPercent: 0,
    },
  ],
};

const SOURCE_LABELS: Record<string, string> = {
  "https://wiki.guildwars2.com/wiki/Precision": "Precision and critical chance",
  "https://wiki.guildwars2.com/wiki/Ferocity": "Ferocity and critical damage",
  "https://wiki.guildwars2.com/wiki/Fury": "Fury by game mode",
  "https://wiki.guildwars2.com/wiki/Might": "Might at level 80",
  "https://wiki.guildwars2.com/wiki/Vulnerability": "Vulnerability",
  "https://wiki.guildwars2.com/wiki/Damage_calculation": "Strike damage formula",
};

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function loadWorkspaceState(): EffectivePowerWorkspaceState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    const parsed = JSON.parse(stored) as Partial<EffectivePowerWorkspaceState>;
    if (!parsed.assumptions || !Array.isArray(parsed.builds) || parsed.builds.length < 2) return DEFAULT_STATE;
    return {
      assumptions: { ...DEFAULT_STATE.assumptions, ...parsed.assumptions },
      builds: parsed.builds.slice(0, 3).map((build, index) => ({
        ...DEFAULT_STATE.builds[Math.min(index, DEFAULT_STATE.builds.length - 1)],
        ...build,
        id: build.id || `build-${index + 1}`,
      })),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function toInput(build: BuildDraft, assumptions: SharedAssumptions): EffectivePowerInput {
  return {
    power: build.power,
    precision: build.precision,
    ferocity: build.ferocity,
    gameMode: assumptions.gameMode,
    furyUptimePercent: assumptions.furyUptimePercent,
    mightStacks: assumptions.mightStacks,
    mightUptimePercent: assumptions.mightUptimePercent,
    vulnerabilityStacks: assumptions.vulnerabilityStacks,
    bonusCriticalChancePercent: build.bonusCriticalChancePercent,
    bonusCriticalDamagePercent: build.bonusCriticalDamagePercent,
    strikeDamageModifierPercent: build.strikeDamageModifierPercent,
  };
}

function NumericField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  minimum = 0,
  maximum,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  step?: number;
  minimum?: number;
  maximum?: number;
}) {
  return (
    <label className="ep-field">
      <span>{label}</span>
      <span className="ep-number-input">
        <input
          type="number"
          min={minimum}
          max={maximum}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <b>{suffix}</b>}
      </span>
    </label>
  );
}

function UptimeControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="ep-uptime-control">
      <span>{label}</span>
      <div>
        <input type="range" min={0} max={100} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <span className="ep-uptime-value"><strong>{decimalFormatter.format(value)}</strong>%</span>
      </div>
    </label>
  );
}

function marginalLabel(stat: EffectivePowerMarginal["stat"]) {
  return stat === "power" ? "Power" : stat === "precision" ? "Precision" : "Ferocity";
}

function breakpointLabel(precisionToCap: number, excessPrecision: number) {
  if (precisionToCap > 0) return `${numberFormatter.format(precisionToCap)} Precision to cap`;
  if (excessPrecision > 0) return `${numberFormatter.format(excessPrecision)} excess Precision`;
  return "Critical chance capped";
}

export default function EffectivePowerView() {
  const [workspace, setWorkspace] = useState<EffectivePowerWorkspaceState>(loadWorkspaceState);
  const [importUrl, setImportUrl] = useState("");
  const [importTargetId, setImportTargetId] = useState(() => workspace.builds[0]?.id ?? "build-a");
  const [importState, setImportState] = useState<{ status: "idle" | "loading" | "success" | "error"; message: string; warnings: string[] }>({
    status: "idle",
    message: "",
    warnings: [],
  });
  const { assumptions, builds } = workspace;
  const results = useMemo(() => builds.map((build) => calculateEffectivePower(toInput(build, assumptions))), [assumptions, builds]);
  const comparison = useMemo(() => compareEffectivePower(results[0], results[1]), [results]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  function updateAssumption<K extends keyof SharedAssumptions>(key: K, value: SharedAssumptions[K]) {
    setWorkspace((current) => ({ ...current, assumptions: { ...current.assumptions, [key]: value } }));
  }

  function updateBuild<K extends keyof BuildDraft>(id: string, key: K, value: BuildDraft[K]) {
    const changesImportedAttributes = key === "power" || key === "precision" || key === "ferocity";
    setWorkspace((current) => ({
      ...current,
      builds: current.builds.map((build) => build.id === id ? {
        ...build,
        [key]: value,
        source: build.source && changesImportedAttributes ? { ...build.source, edited: true } : build.source,
      } : build),
    }));
  }

  async function importBuild() {
    if (!importUrl.trim()) {
      setImportState({ status: "error", message: "Paste a complete gw2skills.net editor URL first.", warnings: [] });
      return;
    }
    setImportState({ status: "loading", message: "Reading the build and resolving official item records...", warnings: [] });
    try {
      const normalized = await importGw2SkillsForEffectivePower(importUrl);
      const statPackage = normalized.equipment.statPackage || "Mixed gear";
      const importedName = `${normalized.professionId} · ${statPackage}`;
      setWorkspace((current) => ({
        assumptions: { ...current.assumptions, gameMode: effectivePowerGameMode(normalized.gameMode) },
        builds: current.builds.map((build) => build.id === importTargetId ? {
          ...build,
          name: importedName,
          power: normalized.attributes.power,
          precision: normalized.attributes.precision,
          ferocity: normalized.attributes.ferocity,
          bonusCriticalChancePercent: normalized.modifiers.bonusCriticalChancePercent,
          bonusCriticalDamagePercent: normalized.modifiers.bonusCriticalDamagePercent,
          strikeDamageModifierPercent: normalized.modifiers.strikeDamageModifierPercent,
          source: {
            kind: "gw2skills",
            label: normalized.source.label,
            url: normalized.source.url,
            professionId: normalized.professionId,
            statPackage,
            importedAt: normalized.source.importedAt,
            warnings: normalized.source.warnings,
            edited: false,
          },
        } : build),
      }));
      setImportState({
        status: "success",
        message: `${normalized.professionId} attributes imported into ${builds.find((build) => build.id === importTargetId)?.name ?? "the selected build"}.`,
        warnings: normalized.source.warnings,
      });
    } catch (error) {
      setImportState({
        status: "error",
        message: error instanceof Error ? error.message : "The build could not be imported.",
        warnings: [],
      });
    }
  }

  function addBuild() {
    setWorkspace((current) => {
      if (current.builds.length >= 3) return current;
      const source = current.builds[current.builds.length - 1];
      return {
        ...current,
        builds: [...current.builds, { ...source, id: `build-${Date.now()}`, name: "Alternative build" }],
      };
    });
  }

  function removeBuild(id: string) {
    setWorkspace((current) => ({ ...current, builds: current.builds.filter((build) => build.id !== id) }));
  }

  return (
    <div className="effective-power-workspace animate-view">
      <header className="ep-hero">
        <div className="ep-hero-mark" aria-hidden="true"><Calculator /></div>
        <div className="ep-hero-copy">
          <span className="ep-eyebrow">Entropy theorycraft</span>
          <h2>Effective Power</h2>
          <p>Compare expected strike potential, find crit breakpoints, and see which stat adds the most value at the build's current state.</p>
        </div>
        <div className="ep-hero-actions">
          <span className="ep-ruleset"><ShieldCheck /> Level 80 rules verified</span>
          <button type="button" className="ep-button ep-button-quiet" onClick={() => setWorkspace(DEFAULT_STATE)}>
            <RefreshCcw /> Reset
          </button>
          <button type="button" className="ep-button" onClick={addBuild} disabled={builds.length >= 3}>
            <Plus /> Add build
          </button>
        </div>
      </header>

      <section className="ep-import-rack" aria-labelledby="ep-import-title">
        <div className="ep-import-intro">
          <div className="ep-section-heading">
            <div><Link2 /><span><small>Build ingestion</small><strong id="ep-import-title">Import from gw2skills</strong></span></div>
          </div>
          <p>Entropy translates the build, resolves structured records through the official GW2 API, then calculates equipment attributes with its wiki-backed level-80 model.</p>
        </div>
        <label className="ep-import-url">
          <span>Complete editor URL</span>
          <div><Link2 /><input type="url" value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://en.gw2skills.net/editor/?..." /></div>
        </label>
        <label className="ep-import-target">
          <span>Import into</span>
          <select value={importTargetId} onChange={(event) => setImportTargetId(event.target.value)}>
            {builds.map((build, index) => <option value={build.id} key={build.id}>Build {index + 1} · {build.name}</option>)}
          </select>
        </label>
        <button type="button" className="ep-button ep-import-button" onClick={importBuild} disabled={importState.status === "loading"}>
          {importState.status === "loading" ? <Loader2 className="ep-spinner" /> : <Download />}
          {importState.status === "loading" ? "Importing" : "Import build"}
        </button>
        {importState.status !== "idle" && (
          <div className="ep-import-status" data-status={importState.status} role="status">
            {importState.status === "success" ? <CheckCircle2 /> : importState.status === "error" ? <AlertTriangle /> : <Loader2 className="ep-spinner" />}
            <span><strong>{importState.message}</strong><small>Imported attributes never silently include trait or conditional modifiers.</small></span>
            {importState.warnings.length > 0 && (
              <details>
                <summary>{importState.warnings.length} model {importState.warnings.length === 1 ? "notice" : "notices"}</summary>
                <ul>{importState.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="ep-assumptions" aria-labelledby="ep-assumptions-title">
        <div className="ep-section-heading">
          <div><Sparkles /><span><small>Shared combat state</small><strong id="ep-assumptions-title">Assumptions applied to every build</strong></span></div>
          <p>Might and Fury uptime are evaluated as combat states, so critical chance is capped before the states are averaged.</p>
        </div>
        <div className="ep-assumption-grid">
          <fieldset className="ep-mode-control">
            <legend>Game mode</legend>
            <div>
              {(["wvw", "pve"] as const).map((mode) => (
                <button key={mode} type="button" data-active={assumptions.gameMode === mode} onClick={() => updateAssumption("gameMode", mode)}>
                  {mode === "wvw" ? "WvW" : "PvE"}
                </button>
              ))}
            </div>
          </fieldset>
          <UptimeControl label={`Fury uptime · +${EFFECTIVE_POWER_RULESET.furyCriticalChancePercent[assumptions.gameMode]}% crit`} value={assumptions.furyUptimePercent} onChange={(value) => updateAssumption("furyUptimePercent", value)} />
          <NumericField label="Might stacks" value={assumptions.mightStacks} maximum={25} onChange={(value) => updateAssumption("mightStacks", value)} />
          <UptimeControl label="Might uptime" value={assumptions.mightUptimePercent} onChange={(value) => updateAssumption("mightUptimePercent", value)} />
          <NumericField label="Vulnerability stacks" value={assumptions.vulnerabilityStacks} maximum={25} onChange={(value) => updateAssumption("vulnerabilityStacks", value)} />
        </div>
      </section>

      <section className="ep-comparison-strip" aria-label="Build comparison">
        <div className="ep-comparison-build">
          <span>{builds[0].name}</span>
          <strong>{numberFormatter.format(results[0].adjustedEffectivePower)}</strong>
        </div>
        <div className="ep-versus" data-winner={comparison.stronger}>
          <ArrowRight />
          <span>{comparison.stronger === "equal" ? "Equal" : `${decimalFormatter.format(Math.abs(comparison.differencePercent))}% stronger`}</span>
        </div>
        <div className="ep-comparison-build is-right">
          <span>{builds[1].name}</span>
          <strong>{numberFormatter.format(results[1].adjustedEffectivePower)}</strong>
        </div>
        <p>Combat-adjusted EP compares the first two builds under the same shared assumptions.</p>
      </section>

      <section className="ep-build-grid" data-count={builds.length} aria-label="Build inputs and results">
        {builds.map((build, index) => {
          const result = results[index];
          return (
            <article className="ep-build-card" key={build.id} data-best={comparison.stronger === (index === 0 ? "left" : index === 1 ? "right" : "none")}>
              <header className="ep-build-header">
                <div className="ep-build-index">{String(index + 1).padStart(2, "0")}</div>
                <label>
                  <span>Build name</span>
                  <input value={build.name} onChange={(event) => updateBuild(build.id, "name", event.target.value)} />
                </label>
                {builds.length > 2 && (
                  <button type="button" className="ep-icon-button" onClick={() => removeBuild(build.id)} aria-label={`Remove ${build.name}`} title="Remove build">
                    <Trash2 />
                  </button>
                )}
              </header>

              {build.source && (
                <div className="ep-build-source">
                  <Database />
                  <span>
                    <strong>{build.source.professionId} · {build.source.statPackage}</strong>
                    <small>{build.source.label} · {new Date(build.source.importedAt).toLocaleString()}{build.source.edited ? " · attributes edited" : ""}</small>
                  </span>
                  {build.source.url && <a href={build.source.url} target="_blank" rel="noreferrer" aria-label={`Open source for ${build.name}`} title="Open imported build"><ExternalLink /></a>}
                </div>
              )}

              <div className="ep-primary-result">
                <span>Combat-adjusted EP</span>
                <strong>{numberFormatter.format(result.adjustedEffectivePower)}</strong>
                <small>Normalized EP {numberFormatter.format(result.effectivePower)} · Base EP {numberFormatter.format(result.unbuffedEffectivePower)}</small>
              </div>

              <div className="ep-result-facts">
                <div><span>Average power</span><strong>{numberFormatter.format(result.averagePower)}</strong></div>
                <div><span>Average crit</span><strong>{decimalFormatter.format(result.averageCriticalChancePercent)}%</strong></div>
                <div><span>Crit damage</span><strong>{decimalFormatter.format(result.criticalDamagePercent)}%</strong></div>
              </div>

              <div className="ep-input-section">
                <div className="ep-subheading"><CircleGauge /><span>Build attributes</span></div>
                <div className="ep-build-inputs">
                  <NumericField label="Power" value={build.power} onChange={(value) => updateBuild(build.id, "power", value)} />
                  <NumericField label="Precision" value={build.precision} onChange={(value) => updateBuild(build.id, "precision", value)} />
                  <NumericField label="Ferocity" value={build.ferocity} onChange={(value) => updateBuild(build.id, "ferocity", value)} />
                  <NumericField label="Bonus crit chance" value={build.bonusCriticalChancePercent} suffix="%" step={0.1} minimum={-100} onChange={(value) => updateBuild(build.id, "bonusCriticalChancePercent", value)} />
                  <NumericField label="Bonus crit damage" value={build.bonusCriticalDamagePercent} suffix="%" step={0.1} onChange={(value) => updateBuild(build.id, "bonusCriticalDamagePercent", value)} />
                  <NumericField label="Strike modifier" value={build.strikeDamageModifierPercent} suffix="%" step={0.1} minimum={-100} onChange={(value) => updateBuild(build.id, "strikeDamageModifierPercent", value)} />
                </div>
              </div>

              <div className="ep-marginal-section">
                <div className="ep-subheading"><TrendingUp /><span>Next 100 stats</span><small>Current-state value</small></div>
                <div className="ep-marginal-list">
                  {result.marginals.map((marginal) => (
                    <div key={marginal.stat} data-best={result.bestNext100 === marginal.stat}>
                      <span>{marginalLabel(marginal.stat)}{result.bestNext100 === marginal.stat && <b>Best</b>}</span>
                      <strong>+{numberFormatter.format(marginal.gain)} EP</strong>
                      <small>+{decimalFormatter.format(marginal.gainPercent)}% · {decimalFormatter.format(marginal.relativeToPower)}x Power</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ep-breakpoint-section">
                <div className="ep-subheading"><Target /><span>Critical breakpoints</span></div>
                <div className="ep-breakpoint-row">
                  <span>Without Fury</span>
                  <strong>{breakpointLabel(result.breakpoints.withoutFury.precisionToCap, result.breakpoints.withoutFury.excessPrecision)}</strong>
                </div>
                <div className="ep-breakpoint-row">
                  <span>With Fury</span>
                  <strong>{breakpointLabel(result.breakpoints.withFury.precisionToCap, result.breakpoints.withFury.excessPrecision)}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="ep-methodology" aria-labelledby="ep-methodology-title">
        <div className="ep-methodology-lead">
          <Info />
          <div>
            <span>Methodology</span>
            <h3 id="ep-methodology-title">One metric, clearly bounded</h3>
            <p>Effective Power estimates expected direct-strike output from attributes and selected combat assumptions. It is not skill damage or DPS because weapon strength, skill coefficients, target armor, hit count, and rotations are deliberately outside this layer.</p>
          </div>
        </div>
        <div className="ep-formula">
          <span>Core model</span>
          <code>Power × [1 + Crit Chance × (Crit Damage - 1)]</code>
          <small>Then apply selected vulnerability and strike-damage modifiers.</small>
        </div>
        <div className="ep-sources">
          <div className="ep-source-heading"><BarChart3 /><span><strong>Verified sources</strong><small>Ruleset {EFFECTIVE_POWER_RULESET.id}</small></span></div>
          <a href="https://api.guildwars2.com/v2" target="_blank" rel="noreferrer">Official GW2 API · structured records <ExternalLink /></a>
          {EFFECTIVE_POWER_RULESET.sources.map((source) => (
            <a href={source} target="_blank" rel="noreferrer" key={source}>{SOURCE_LABELS[source] ?? "Guild Wars 2 Wiki"} <ExternalLink /></a>
          ))}
          <p>The API is used for structured skills, items, icons, and identifiers when imported. The wiki supplies combat formulas and mechanic rules that the API does not publish.</p>
        </div>
      </section>
    </div>
  );
}
