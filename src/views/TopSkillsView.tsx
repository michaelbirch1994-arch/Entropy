import { useState } from "react";
import { useReport } from "../store/ReportContext";
import { fmtCompact, fmtNum } from "../utils/format";
import type { TopSkill, TopHealingSource } from "../types/report";
import { Zap, ArrowDownLeft, Flame, Trophy, HeartPulse } from "lucide-react";

type SortKey = "damage" | "downContribution" | "hits";
type Tab = "outgoing" | "incoming" | "healing";

const SORT_LABEL: Record<SortKey, string> = {
  damage: "Damage",
  downContribution: "Down Contribution",
  hits: "Hits",
};

const TAB_ACCENT: Record<"outgoing" | "incoming", { border: string; bg: string; text: string; from: string; to: string }> = {
    outgoing: { border: "border-orange-500/15", bg: "bg-orange-500/[0.05]", text: "text-orange-300", from: "from-orange-600", to: "to-orange-400" },
    incoming: { border: "border-rose-500/15", bg: "bg-rose-500/[0.05]", text: "text-rose-300", from: "from-rose-600", to: "to-rose-400" },
};

function metricValueForSkill(skill: TopSkill, sort: SortKey) {
  return skill[sort];
}

function metricValueForHealing(source: TopHealingSource, sort: SortKey) {
  return sort === "hits" ? source.hits : source.healing;
}

// Wraps the skill/buff icon with a graceful fallback. A plain <img> is used
// (not a fetch()-then-blob-URL indirection) because img-src already permits
// any https:// source in every place this app actually runs - the web build
// ships with no CSP at all, and the packaged Tauri app's img-src explicitly
// allows "https:". A fetch()-based approach is governed by the stricter
// connect-src instead, which only allowlists a handful of API hosts, so it
// silently failed for every single icon in the desktop app.
function SkillIcon({ src, index }: { src?: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-9 h-9 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-[10px] font-bold text-slate-400 font-mono">
        {index + 1}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-9 h-9 rounded-lg border border-slate-700/50"
      loading="lazy"
    />
  );
}

function TabRow({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setTab("outgoing")}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
          tab === "outgoing"
            ? "bg-orange-500/15 text-orange-400 border-orange-500/40"
            : "bg-[#0a101f] text-slate-500 border-slate-800 hover:text-slate-300"
        }`}
      >
        <Zap className="w-3.5 h-3.5" /> Outgoing
      </button>
      <button
        onClick={() => setTab("incoming")}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
          tab === "incoming"
            ? "bg-rose-500/15 text-rose-400 border-rose-500/40"
            : "bg-[#0a101f] text-slate-500 border-slate-800 hover:text-slate-300"
        }`}
      >
        <ArrowDownLeft className="w-3.5 h-3.5" /> Incoming
      </button>
      <button
        onClick={() => setTab("healing")}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
          tab === "healing"
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
            : "bg-[#0a101f] text-slate-500 border-slate-800 hover:text-slate-300"
        }`}
      >
        <HeartPulse className="w-3.5 h-3.5" /> Healing
      </button>
    </div>
  );
}

function buildHealingById(healingSources: TopHealingSource[]) {
  const byId = new Map<number, TopHealingSource>();

  for (const source of healingSources) {
    const existing = byId.get(source.id);
    if (!existing) {
      byId.set(source.id, { ...source });
      continue;
    }

    existing.healing += source.healing;
    existing.hits += source.hits;
    existing.isTrait = existing.isTrait || source.isTrait;
    if (!existing.icon && source.icon) existing.icon = source.icon;
    if (/^(Skill|Trait) \d+$/.test(existing.name) && !/^(Skill|Trait) \d+$/.test(source.name)) {
      existing.name = source.name;
    }
  }

  return byId;
}

function LifeStealSpotlight({
  healingSources,
  topSkills,
  onOpenHealing,
}: {
  healingSources: TopHealingSource[];
  topSkills: TopSkill[];
  onOpenHealing: () => void;
}) {
  if (healingSources.length === 0) return null;

  const damageById = new Map(topSkills.map((skill) => [skill.id, skill]));
  const topSources = [...healingSources]
    .filter((source) => source.healing > 0)
    .sort((a, b) => b.healing - a.healing)
    .slice(0, 4);
  const maxHealing = Math.max(...topSources.map((source) => source.healing), 1);

  if (topSources.length === 0) return null;

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-emerald-300">
            <HeartPulse className="w-4 h-4" /> Life-steal and conversion healing detected
          </div>
          <p className="text-[11px] text-slate-400 mt-1 max-w-3xl">
            These are healing sources produced by skills or trait-triggered siphons. When the same id also dealt outgoing damage,
            the card below shows both sides of the trade: damage dealt and healing returned.
          </p>
        </div>
        <button
          onClick={onOpenHealing}
          className="self-start rounded-lg border border-emerald-500/30 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/10 transition-all"
        >
          Open full healing breakdown
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {topSources.map((source, i) => {
          const matchingDamage = damageById.get(source.id);
          return (
            <div key={`lifesteal:${source.isTrait ? "trait" : "skill"}:${source.id}:${source.healing}:${source.hits}`} className="rounded-xl border border-slate-800/70 bg-[#080d19]/80 p-3">
              <div className="flex items-start gap-3 mb-3">
                <SkillIcon src={source.icon || matchingDamage?.icon} index={i} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-100">{source.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {source.isTrait ? "Trait-triggered" : "Skill"} · {fmtNum(source.hits)} healing hits
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-500">Healing returned</span>
                    <span className="text-emerald-300 font-bold">{fmtCompact(source.healing)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-700 to-emerald-300 rounded-full"
                      style={{ width: `${(source.healing / maxHealing) * 100}%` }}
                    />
                  </div>
                </div>
                {matchingDamage ? (
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Matched damage</span>
                    <span className="text-orange-300 font-bold">{fmtCompact(matchingDamage.damage)}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">
                    Healing-only source or below the outgoing top-damage cutoff.
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

export default function TopSkillsView() {
  const { report } = useReport();
  const [tab, setTab] = useState<"outgoing" | "incoming" | "healing">("outgoing");
  const [sort, setSort] = useState<SortKey>("damage");
  if (!report) return null;
  const s = report.stats;

  if (tab === "healing") {
    const healingSources: TopHealingSource[] = s.topHealingSkills ?? [];
    const sortedHealing = [...healingSources].sort((a, b) =>
      sort === "hits" ? b.hits - a.hits : b.healing - a.healing
    );
    const maxHeal = Math.max(...sortedHealing.map((x) => metricValueForHealing(x, sort)), 1);

    // No `sort` in this key - it used to force a full remount (and replay
    // the animate-view entrance animation) on every "Sort by" click.
    return (
      <div className="space-y-5 animate-view pb-12">
        <TabRow tab={tab} setTab={setTab} />

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Sort by:</span>
          {([
            { k: "damage", l: "Healing", icon: HeartPulse },
            { k: "hits", l: "Hits", icon: Zap },
          ] as { k: SortKey; l: string; icon: typeof Flame }[]).map((opt) => {
            const Icon = opt.icon;
            const isActive = (sort === "downContribution" ? "damage" : sort) === opt.k;
            return (
              <button
                key={opt.k}
                onClick={() => setSort(opt.k)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  isActive ? "bg-sky-500/15 text-sky-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className="w-3 h-3" />
                {opt.l}
              </button>
            );
          })}
        </div>

        {sortedHealing.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No healing-source breakdown available for this report.
            <p className="text-[11px] text-slate-500 mt-1">
              Only populated when the raw log was recorded with arcdps's healing addon active - this is what
              lets a trait like Replenishing Despair (converts damage dealt into self-healing) or a skill
              like Life Siphon show up as its own quantified line instead of disappearing into the total.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" key={`healing-grid:${sort}:${sortedHealing.map((x) => `${x.id}:${metricValueForHealing(x, sort)}`).join("|")}`}>
            {sortedHealing.slice(0, 20).map((hs, i) => {
              const activeValue = metricValueForHealing(hs, sort);
              return (
                <div
                  key={`healing:${sort}:${hs.isTrait ? "trait" : "skill"}:${hs.id}:${hs.name}:${hs.healing}:${hs.hits}`}
                  className="bg-[#0a101f]/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <SkillIcon src={hs.icon} index={i} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-100">{hs.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              hs.isTrait ? "border-fuchsia-500/30 text-fuchsia-400" : "border-emerald-500/30 text-emerald-400"
                            }`}
                          >
                            {hs.isTrait ? "Trait" : "Skill"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{fmtNum(hs.hits)} hits</div>
                      </div>
                    </div>
                    <span className={`text-xs font-black font-mono ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>
                      #{i + 1}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-slate-500">Sorted by {sort === "hits" ? "Hits" : "Healing"}</span>
                      <span className="text-emerald-400 font-bold">{sort === "hits" ? fmtNum(activeValue) : fmtCompact(activeValue)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${(activeValue / maxHeal) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const skills: TopSkill[] = tab === "outgoing" ? s.topSkills : s.topIncomingSkills;
  const sorted = [...skills].sort((a, b) => b[sort] - a[sort]);
  const maxActive = Math.max(...sorted.map((x) => metricValueForSkill(x, sort)), 1);
  const maxDmg = Math.max(...sorted.map((x) => x.damage), 1);
  const maxDc = Math.max(...sorted.map((x) => x.downContribution), 1);
  const healingSources: TopHealingSource[] = s.topHealingSkills ?? [];
  const healingById = buildHealingById(healingSources);
  const visibleHealingMatches = tab === "outgoing"
    ? sorted.map((skill) => healingById.get(skill.id)).filter((source): source is TopHealingSource => !!source)
    : [];
  const maxMatchedHealing = Math.max(...visibleHealingMatches.map((source) => source.healing), 1);
  const accent = TAB_ACCENT[tab === "incoming" ? "incoming" : "outgoing"];

  return (
    // `tab` stays in the key (outgoing/incoming genuinely swap to different
    // content), but `sort` was dropped - it used to force a full remount
    // (and replay the entrance animation) on every "Sort by" click.
    <div className="space-y-5 animate-view pb-12" key={`${tab}-view`}>
      <TabRow tab={tab} setTab={setTab} />

      {/* Sort selector */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-slate-500 font-bold uppercase tracking-wider">Sort by:</span>
        {([
          { k: "damage", l: "Damage", icon: Flame },
          { k: "downContribution", l: "Down Contrib", icon: Trophy },
          { k: "hits", l: "Hits", icon: Zap },
        ] as { k: SortKey; l: string; icon: typeof Flame }[]).map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.k}
              onClick={() => setSort(opt.k)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                sort === opt.k ? "bg-sky-500/15 text-sky-400" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="w-3 h-3" />
              {opt.l}
            </button>
          );
        })}
      </div>

      {tab === "outgoing" && (
        <LifeStealSpotlight healingSources={healingSources} topSkills={s.topSkills} onOpenHealing={() => setTab("healing")} />
      )}

      {/* Skills grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" key={`${tab}:grid:${sort}:${sorted.map((x) => `${x.id}:${metricValueForSkill(x, sort)}`).join("|")}`}>
        {sorted.slice(0, 20).map((sk, i) => {
          const healingMatch = tab === "outgoing" ? healingById.get(sk.id) : undefined;
          const activeValue = metricValueForSkill(sk, sort);
          return (
            <div
              key={`${tab}:${sort}:${sk.id}:${sk.name}:${sk.damage}:${sk.downContribution}:${sk.hits}`}
              className="bg-[#0a101f]/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <SkillIcon src={sk.icon || healingMatch?.icon} index={i} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-100">{sk.name}</span>
                      {healingMatch && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-emerald-500/30 text-emerald-400">
                          Life steal
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">{fmtNum(sk.hits)} hits</div>
                  </div>
                </div>
                <span className={`text-xs font-black font-mono ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>
                  #{i + 1}
                </span>
              </div>

              <div className={`mb-3 rounded-xl border ${accent.border} ${accent.bg} p-3`}>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-slate-400">Sorted by {SORT_LABEL[sort]}</span>
                  <span className={`${accent.text} font-bold`}>{sort === "hits" ? fmtNum(activeValue) : fmtCompact(activeValue)}</span>
                </div>
                <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${accent.from} ${accent.to} rounded-full transition-all duration-500`}
                    style={{ width: `${(activeValue / maxActive) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-500">Damage</span>
                    <span className={`${accent.text} font-bold`}>{fmtCompact(sk.damage)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${accent.from} ${accent.to} rounded-full transition-all duration-500`}
                      style={{ width: `${(sk.damage / maxDmg) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-500">Down Contrib</span>
                    <span className="text-sky-400 font-bold">{fmtCompact(sk.downContribution)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-500"
                      style={{ width: `${(sk.downContribution / maxDc) * 100}%` }}
                    />
                  </div>
                </div>
                {healingMatch && (
                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-slate-500">Life-steal healing</span>
                      <span className="text-emerald-400 font-bold">{fmtCompact(healingMatch.healing)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-700 to-emerald-300 rounded-full transition-all duration-500"
                        style={{ width: `${(healingMatch.healing / maxMatchedHealing) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
