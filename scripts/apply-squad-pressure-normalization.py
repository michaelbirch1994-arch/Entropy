from pathlib import Path

path = Path("src/views/SquadStatsView.tsx")
text = path.read_text(encoding="utf-8")

text = text.replace(
    'import { buildSquadOverviewRows } from "../lib/squadOverviewAggregation";\n',
    'import { buildSquadOverviewRows, type SquadOverviewRow } from "../lib/squadOverviewAggregation";\n',
    1,
)

old_fn = '''function buildPressureRows(players: OffensePlayer[], scope: ReturnType<typeof useDamageScope>["scope"]) {
  const base = players.map((p) => {
    const damage = pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll);
    const downContribution = p.offenseTotals.downContribution ?? 0;
    const enemyDowns = p.offenseTotals.downed ?? 0;
    const kills = p.offenseTotals.killed ?? 0;
    const dps = safeDiv(damage, p.totalFightMs / 1000);
    // Kill Pressure is intentionally not "total damage." It rewards damage
    // that helps force downs/kills, with a smaller baseline for sustained
    // player-vs-player pressure so finishers do not erase the setup work.
    const pressureRaw = downContribution + enemyDowns * 50000 + kills * 80000 + damage * 0.05;
    return { account: p.account, profession: p.profession, damage, dps, downContribution, enemyDowns, kills, pressureRaw };
  }).sort((a, b) => b.pressureRaw - a.pressureRaw);
'''
new_fn = '''function buildPressureRows(players: Array<Pick<SquadOverviewRow, "account" | "profession" | "damage" | "dps" | "downContribution" | "enemyDowns" | "kills">>) {
  const base = players.map((p) => {
    const { account, profession, damage, dps, downContribution, enemyDowns, kills } = p;
    // Kill Pressure is intentionally not "total damage." It rewards damage
    // that helps force downs/kills, with a smaller baseline for sustained
    // player-vs-player pressure so finishers do not erase the setup work.
    const pressureRaw = downContribution + enemyDowns * 50000 + kills * 80000 + damage * 0.05;
    return { account, profession, damage, dps, downContribution, enemyDowns, kills, pressureRaw };
  }).sort((a, b) => b.pressureRaw - a.pressureRaw);
'''
if text.count(old_fn) != 1:
    raise SystemExit(f"Expected one buildPressureRows function, found {text.count(old_fn)}")
text = text.replace(old_fn, new_fn, 1)

old_top = '''  const topDps = [...s.offensePlayers]
    .map((p) => ({ account: p.account, profession: p.profession, dps: pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll) / (p.totalFightMs / 1000) }))
    .sort((a, b) => b.dps - a.dps)
    .slice(0, 10);

  const chartData = topDps.map((p) => ({ name: p.account.split(".")[0], DPS: Math.round(p.dps), profession: p.profession }));
  const pressureRows = buildPressureRows(s.offensePlayers, scope);
'''
new_top = '''  const squadAccountRows = buildSquadOverviewRows(s, scope, allyScope);
  const topDps = [...squadAccountRows]
    .map((p) => ({ account: p.account, profession: p.profession, dps: p.dps }))
    .sort((a, b) => b.dps - a.dps)
    .slice(0, 10);

  const chartData = topDps.map((p) => ({ name: p.account.split(".")[0], DPS: Math.round(p.dps), profession: p.profession }));
  const pressureRows = buildPressureRows(squadAccountRows);
'''
if text.count(old_top) != 1:
    raise SystemExit(f"Expected one Top DPS/pressure block, found {text.count(old_top)}")
text = text.replace(old_top, new_top, 1)

old_roster = '    const rows = buildSquadOverviewRows(s, scope, allyScope);\n'
new_roster = '    const rows = [...squadAccountRows];\n'
if text.count(old_roster) != 1:
    raise SystemExit(f"Expected one roster normalized rows call, found {text.count(old_roster)}")
text = text.replace(old_roster, new_roster, 1)

path.write_text(text, encoding="utf-8")
