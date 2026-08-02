import { useState } from "react";
import { useReport } from "../store/ReportContext";
import { fmtCompact, fmtNum } from "../utils/format";
import type { TopSkill, TopHealingSource } from "../types/report";
import { Zap, ArrowDownLeft, Flame, Trophy, HeartPulse } from "lucide-react";

type SortKey = "damage" | "downContribution" | "hits";
type Tab = "outgoing" | "incoming" | "healing";

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
    const maxHeal = Math.max(...sortedHealing.map((x) => x.healing), 1);

    return (
      <div className="space-y-5 animate-view pb-12">
        <TabRow tab={tab} setTab={setTab} />

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedHealing.slice(0, 20).map((hs, i) => (
              <div
                key={`${hs.isTrait ? "b" : "s"}${hs.id}`}
                className="bg-[#0a101f]/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {hs.icon ? (
                      <img src={hs.icon} alt="" className="w-9 h-9 rounded-lg border border-slate-700/50" loading="lazy" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-[10px] font-bold text-slate-400 font-mono">
                        {i + 1}
                      </div>
                    )}
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
                    <span className="text-slate-500">Healing</span>
                    <span className="text-emerald-400 font-bold">{fmtCompact(hs.healing)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${(hs.healing / maxHeal) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const skills: TopSkill[] = tab === "outgoing" ? s.topSkills : s.topIncomingSkills;
  const sorted = [...skills].sort((a, b) => b[sort] - a[sort]);
  const maxDmg = Math.max(...sorted.map((x) => x.damage), 1);
  const maxDc = Math.max(...sorted.map((x) => x.downContribution), 1);

  return (
    <div className="space-y-5 animate-view pb-12">
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

      {/* Skills grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.slice(0, 20).map((sk, i) => (
          <div
            key={sk.name}
            className="bg-[#0a101f]/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-[10px] font-bold text-slate-400 font-mono">
                  {sk.icon || i + 1}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100">{sk.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{fmtNum(sk.hits)} hits</div>
                </div>
              </div>
              <span className={`text-xs font-black font-mono ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>
                #{i + 1}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-slate-500">Damage</span>
                  <span className="text-orange-400 font-bold">{fmtCompact(sk.damage)}</span>
                </div>
                <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500"
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
