import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import { fmtNum } from "../utils/format";
import { LineChart as LineChartIcon, Swords, MousePointerClick } from "lucide-react";

const PLAYER_COLORS = ["#f59e0b", "#38bdf8", "#f43f5e", "#34d399", "#a78bfa", "#fb923c", "#22d3ee", "#e879f9"];

function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

// How far either side of a clicked point (in seconds) to pull skill casts
// from - wide enough to catch a burst rotation's several skills landing
// within the same second or two of each other, narrow enough that it stays
// "what happened at this spike" rather than "what happened all fight".
const SPIKE_WINDOW_SEC = 3;

// Skill icons come straight from EI as absolute CDN urls. Two things bit us
// here: some come through protocol-relative or as plain http, which a page
// served over https refuses to load as mixed content (the symptom being an
// icon that only appears if you explicitly ask the browser to load it), and
// a CDN hiccup on any one icon should not leave a broken-image glyph in the
// grid. Normalise the scheme, and degrade to a neutral placeholder on error.
function SpikeSkillIcon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  const normalised = src
    ? src.startsWith("//")
      ? `https:${src}`
      : src.replace(/^http:\/\//i, "https://")
    : undefined;
  if (!normalised || failed) {
    return <div className="w-6 h-6 rounded bg-slate-800 flex-shrink-0" />;
  }
  return (
    <img
      src={normalised}
      alt=""
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => setFailed(true)}
      className="w-6 h-6 rounded flex-shrink-0"
    />
  );
}

export default function DpsGraphView() {
  const { report } = useReport();
  const data = report?.stats.dpsGraph;
  const [fightIdx, setFightIdx] = useState(0);
  const [compareAccounts, setCompareAccounts] = useState<string[]>([]);
  const [selectedT, setSelectedT] = useState<number | null>(null);

  const fight = data?.fights[fightIdx];

  // Underlying data is cumulative damage per second (a running total), which
  // only ever goes up and to the right - not useful for spotting when DPS
  // actually spiked or dropped. Convert to instantaneous DPS via a rolling
  // window diff instead: rate at second i = damage gained over the last
  // WINDOW_SEC seconds, divided by however much of that window has elapsed.
  const WINDOW_SEC = 5;
  const toDpsSeries = (points: number[]): number[] =>
    points.map((_, i) => {
      const start = Math.max(0, i - WINDOW_SEC);
      const span = i - start;
      if (span <= 0) return 0;
      return (points[i] - points[start]) / span;
    });

  const chartData = useMemo(() => {
    if (!fight) return [];
    const len = fight.squad.length;
    const compared = fight.players.filter((p) => compareAccounts.includes(p.account));
    const squadDps = toDpsSeries(fight.squad);
    const comparedDps = compared.map((p) => ({ account: p.account, dps: toDpsSeries(p.points) }));
    const rows: Record<string, number>[] = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, number> = { t: i, squad: squadDps[i] ?? 0 };
      comparedDps.forEach(({ account, dps }) => { row[account] = i < dps.length ? dps[i] : dps[dps.length - 1] ?? 0; });
      rows.push(row);
    }
    return rows;
  }, [fight, compareAccounts]);

  // Skills cast within SPIKE_WINDOW_SEC of the clicked point, across the
  // whole squad, tallied by skill and sorted by how often it went off - the
  // "what actually happened here" answer to a spike on the graph. Rotation
  // cast timestamps are the real per-skill timing data available (EI doesn't
  // timestamp individual damage ticks), so this shows *what was cast* during
  // the spike rather than claiming an exact damage-per-skill split.
  const rotationFight = report?.stats.rotations?.fights.find((rf) => rf.fightId === fight?.fightId);
  const skillMeta = report?.stats.rotations?.skillMeta ?? {};
  // EI does not timestamp individual damage ticks, so there is no way to know
  // exactly what each skill dealt inside a 3s window. What we do have is each
  // skill's total damage and hit count across the whole report, which gives an
  // average damage per hit; multiplied by casts in the window that ranks the
  // heavy hitters above the merely spammed. It is an estimate and is labelled
  // as one - not measured damage.
  const avgDamagePerHit = useMemo(() => {
    const m: Record<number, number> = {};
    for (const s of report?.stats.topSkills ?? []) {
      if (s.hits > 0) m[s.id] = s.damage / s.hits;
    }
    return m;
  }, [report]);
  const spikeBreakdown = useMemo(() => {
    if (selectedT == null || !rotationFight) return null;
    const windowMs = SPIKE_WINDOW_SEC * 1000;
    const centerMs = selectedT * 1000;
    // Only skills that actually dealt damage in this fight belong in a
// "what caused this spike" list - a cast timeline also records weapon
// swaps, dodges, resurrects and pure heals, which were crowding out the
// skills that produced the damage. Reports built before this data
// existed have no set, in which case nothing is filtered out.
const damaging = rotationFight.damagingSkillIds;
const damagingSet = damaging && damaging.length > 0 ? new Set(damaging) : null;
const tally = new Map<number, { count: number; players: Set<string> }>();
    rotationFight.players.forEach((p) => {
      (p.casts ?? []).forEach((c) => {
        if (Math.abs(c.castTime - centerMs) <= windowMs) {
          const entry = tally.get(c.skillId) ?? { count: 0, players: new Set<string>() };
          entry.count++;
          entry.players.add(p.account);
          tally.set(c.skillId, entry);
        }
      });
    });
    const all = Array.from(tally.entries())
      .map(([id, v]) => ({
        id,
        name: skillMeta[id]?.name ?? `Skill ${id}`,
        icon: skillMeta[id]?.icon,
        count: v.count,
        playerCount: v.players.size,
        estDamage: v.count * (avgDamagePerHit[id] ?? 0),
      }))
      .sort((a, b) => b.estDamage - a.estDamage || b.count - a.count);

    // Prefer damage-dealing skills, but never return an empty panel: if the
    // filter would wipe everything out (a fight with no damage distribution,
    // or cast ids that do not line up with damage ids), show the raw casts
    // rather than claiming nothing happened.
    const damagingOnly = damagingSet ? all.filter((s) => damagingSet.has(s.id)) : all;
    return (damagingOnly.length > 0 ? damagingOnly : all).slice(0, 10);
  }, [selectedT, rotationFight, skillMeta, avgDamagePerHit]);

  if (!report) return null;

  if (!data || data.fights.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="DPS Graph"
          icon={<LineChartIcon className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No damage-over-time data available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports.
              </p>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  function toggleCompare(account: string) {
    setCompareAccounts((prev) =>
      prev.includes(account) ? prev.filter((a) => a !== account) : prev.length >= PLAYER_COLORS.length ? prev : [...prev, account],
    );
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-wrap items-center gap-3">
        {data.fights.length > 1 && (
          <select
            value={fightIdx}
            onChange={(e) => { setFightIdx(Number(e.target.value)); setCompareAccounts([]); setSelectedT(null); }}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:border-theme-focus focus:outline-none"
          >
            {data.fights.map((f, i) => (
              <option key={f.fightId} value={i}>#{i + 1} · {f.fightName}</option>
            ))}
          </select>
        )}
      </div>

      {fight && (
        <Panel
          title="DPS Over Time"
          subtitle={`Squad DPS across the fight (${WINDOW_SEC}s rolling window) - click a point on the graph to see what skills the squad was casting right then`}
          icon={<LineChartIcon className="w-3.5 h-3.5" />}
          action={`peak ${fmtNum(Math.max(0, ...chartData.map((r) => r.squad ?? 0)))} dps`}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                onClick={(e) => { if (e && e.activeLabel != null) setSelectedT(Number(e.activeLabel)); }}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="t" tickFormatter={fmtClock} stroke="#475569" fontSize={10} />
                <YAxis tickFormatter={(v) => fmtNum(v)} stroke="#475569" fontSize={10} width={56} />
                <Tooltip
                  labelFormatter={(v) => `t=${fmtClock(Number(v))}`}
                  formatter={(v, name) => [fmtNum(Number(v)), name === "squad" ? "Squad" : String(name)]}
                  contentStyle={{ background: "#0a0e1f", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 11 }}
                />
                {compareAccounts.length > 0 && <Legend wrapperStyle={{ fontSize: 10 }} />}
                {selectedT != null && <ReferenceLine x={selectedT} stroke="var(--theme-accentStrong)" strokeDasharray="4 4" />}
                <Line type="monotone" dataKey="squad" name="Squad" stroke="#f59e0b" strokeWidth={2} dot={false} />
                {compareAccounts.map((acc, i) => (
                  <Line
                    key={acc}
                    type="monotone"
                    dataKey={acc}
                    name={acc}
                    stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-4">
            {fight.players
              .slice()
              .sort((a, b) => (b.points[b.points.length - 1] ?? 0) - (a.points[a.points.length - 1] ?? 0))
              .map((p) => {
                const active = compareAccounts.includes(p.account);
                const colorIndex = compareAccounts.indexOf(p.account);
                return (
                  <button
                    key={p.account}
                    onClick={() => toggleCompare(p.account)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                      active
                        ? "border-theme-focus bg-theme-accentDim text-theme-accentStrong"
                        : "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-theme-border"
                    }`}
                  >
                    {active && (
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ background: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length] }}
                      />
                    )}
                    <ProfessionIcon profession={p.profession} className="w-3.5 h-3.5 shrink-0" />
                    {p.account}
                  </button>
                );
              })}
          </div>
        </Panel>
      )}

      {fight && (
        <Panel
          title="Spike Breakdown"
          subtitle={
            selectedT != null
              ? `Skills cast squad-wide within ${SPIKE_WINDOW_SEC}s of t=${fmtClock(selectedT)}, ordered by estimated damage (casts x that skill\u2019s average damage per hit \u2014 EI does not timestamp damage ticks, so this is an estimate)`
              : "Click any point on the DPS graph above to see what the squad was casting at that moment"
          }
          icon={<Swords className="w-3.5 h-3.5" />}
        >
          {!rotationFight ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No rotation/cast-timeline data available for this fight to break spikes down by skill.
            </div>
          ) : selectedT == null ? (
            <div className="py-6 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-slate-600" />
              Click a point on the graph above.
            </div>
          ) : !spikeBreakdown || spikeBreakdown.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">No skill casts recorded in that window.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {spikeBreakdown.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  {s.icon ? (
                    <SpikeSkillIcon src={s.icon} />
                  ) : (
                    <div className="w-6 h-6 rounded bg-slate-800 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-200 truncate">{s.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {s.count}x - {s.playerCount} player{s.playerCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
