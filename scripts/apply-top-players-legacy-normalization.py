from pathlib import Path

path = Path('src/views/TopPlayersView.tsx')
text = path.read_text(encoding='utf-8')

import_anchor = 'import { getSampleReliability, sampleReliabilityClasses } from "../lib/sampleReliability";\n'
import_line = 'import { buildNormalizedTopPlayerSources, mergePlayerSkillBreakdownsForAccount, normalizeTopPlayersLeaderboard } from "../lib/topPlayersNormalization";\n'
if import_line not in text:
    if text.count(import_anchor) != 1:
        raise SystemExit('Top Players import anchor mismatch')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

old_find = '''function findPlayerSkillBreakdown(reportBreakdowns: Record<string, PlayerSkillBreakdown> | undefined, entry: LeaderboardEntry) {\n  if (!reportBreakdowns) return undefined;\n  return reportBreakdowns[`${entry.account}::${entry.profession}`] ?? reportBreakdowns[entry.account];\n}\n\n'''
if text.count(old_find) != 1:
    raise SystemExit(f'Expected one legacy skill breakdown finder, found {text.count(old_find)}')
text = text.replace(old_find, '', 1)

old_entries = '''  const lb = report.stats.leaderboards;\n  const entries: LeaderboardEntry[] = lb[metric] ?? [];\n  const active = METRICS.find((m) => m.key === metric)!;\n  const maxValue = entries.length ? entries[0].value : 1;\n  const snapshotKey = leaderboardSnapshotKey(metric, entries);\n  const sampleByAccount = new Map(report.stats.generalPlayers.map((player) => [player.account, player]));\n  const totalFights = report.stats.total;\n'''
new_entries = '''  const lb = report.stats.leaderboards;\n  const normalizedSources = buildNormalizedTopPlayerSources(report.stats);\n  const entries: LeaderboardEntry[] = normalizeTopPlayersLeaderboard(report.stats, metric, normalizedSources);\n  const active = METRICS.find((m) => m.key === metric)!;\n  const maxValue = entries.length ? entries[0].value : 1;\n  const snapshotKey = leaderboardSnapshotKey(metric, entries);\n  const totalFights = report.stats.total;\n'''
if text.count(old_entries) != 1:
    raise SystemExit(f'Expected one leaderboard setup block, found {text.count(old_entries)}')
text = text.replace(old_entries, new_entries, 1)

old_sample = '''                sample={{\n                  fights: sampleByAccount.get(entry.account)?.logsJoined ?? entry.count,\n                  totalFights,\n                  combatTimeMs: sampleByAccount.get(entry.account)?.squadActiveMs\n                    ?? sampleByAccount.get(entry.account)?.totalFightMs\n                    ?? 0,\n                }}\n'''
new_sample = '''                sample={{\n                  fights: normalizedSources.get(entry.account)?.general?.logsJoined ?? entry.count,\n                  totalFights,\n                  combatTimeMs: normalizedSources.get(entry.account)?.general?.squadActiveMs\n                    ?? normalizedSources.get(entry.account)?.general?.totalFightMs\n                    ?? 0,\n                }}\n'''
if text.count(old_sample) != 1:
    raise SystemExit(f'Expected one sample block, found {text.count(old_sample)}')
text = text.replace(old_sample, new_sample, 1)

old_breakdown = '''                breakdown={buildPlayerSourceBreakdown({\n                  account: entry.account,\n                  offense: report.stats.offensePlayers.find((player) => player.account === entry.account),\n                  healing: report.stats.healingPlayers.find((player) => player.account === entry.account),\n                  support: report.stats.supportPlayers.find((player) => player.account === entry.account),\n                  defense: report.stats.defensePlayers.find((player) => player.account === entry.account),\n                  leaderboards: lb,\n                  damageScope,\n                  allyScope,\n                  skillBreakdown: findPlayerSkillBreakdown(report.stats.playerSkillBreakdowns, entry),\n                })}\n'''
new_breakdown = '''                breakdown={buildPlayerSourceBreakdown({\n                  account: entry.account,\n                  offense: normalizedSources.get(entry.account)?.offense,\n                  healing: normalizedSources.get(entry.account)?.healing,\n                  support: normalizedSources.get(entry.account)?.support,\n                  defense: normalizedSources.get(entry.account)?.defense,\n                  leaderboards: lb,\n                  damageScope,\n                  allyScope,\n                  skillBreakdown: mergePlayerSkillBreakdownsForAccount(\n                    report.stats.playerSkillBreakdowns,\n                    entry.account,\n                    entry.profession,\n                    entry.professionList,\n                  ),\n                })}\n'''
if text.count(old_breakdown) != 1:
    raise SystemExit(f'Expected one source breakdown block, found {text.count(old_breakdown)}')
text = text.replace(old_breakdown, new_breakdown, 1)

path.write_text(text, encoding='utf-8')
