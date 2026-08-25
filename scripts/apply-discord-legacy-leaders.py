from pathlib import Path

path = Path("src/utils/discordWebhook.ts")
text = path.read_text(encoding="utf-8")

import_anchor = 'import { fmtCompact, fmtFixed, fmtNum } from "./format";\n'
import_line = 'import { resolveDiscordReportLeaders } from "../lib/discordLeaderNormalization";\n'
if text.count(import_anchor) != 1:
    raise SystemExit(f"expected one format import, found {text.count(import_anchor)}")
if import_line not in text:
    text = text.replace(import_anchor, import_anchor + import_line, 1)

old = '''  const leaderboards = stats.leaderboards ?? {};\n  const offenseLeader = leaderboards.damage?.[0] ?? leaderboards.damageAll?.[0];\n  const downLeader =\n    leaderboards.downContrib?.[0] ??\n    leaderboards.downContribution?.[0] ??\n    stats.maxDownContrib ??\n    stats.offensePlayers\n      ?.map((player) => ({\n        account: player.account,\n        profession: player.profession,\n        value: player.offenseTotals?.downContribution ?? 0,\n      }))\n      .sort((a, b) => b.value - a.value)[0];\n  const healingLeader = leaderboards.healing?.[0];\n  const stripLeader =\n    leaderboards.strips?.[0] ??\n    leaderboards.boonStrips?.[0] ??\n    stats.maxStrips ??\n    stats.supportPlayers\n      ?.map((player) => ({\n        account: player.account,\n        profession: player.profession,\n        value: player.supportTotals?.boonStrips ?? 0,\n      }))\n      .sort((a, b) => b.value - a.value)[0];\n'''
new = '''  const leaderboards = stats.leaderboards ?? {};\n  const normalizedLeaders = resolveDiscordReportLeaders(stats);\n  const offenseLeader = normalizedLeaders.damage ?? leaderboards.damage?.[0] ?? leaderboards.damageAll?.[0];\n  const downLeader =\n    normalizedLeaders.downContrib ??\n    leaderboards.downContrib?.[0] ??\n    leaderboards.downContribution?.[0] ??\n    stats.maxDownContrib ??\n    stats.offensePlayers\n      ?.map((player) => ({\n        account: player.account,\n        profession: player.profession,\n        value: player.offenseTotals?.downContribution ?? 0,\n      }))\n      .sort((a, b) => b.value - a.value)[0];\n  const healingLeader = normalizedLeaders.healing ?? leaderboards.healing?.[0];\n  const stripLeader =\n    normalizedLeaders.strips ??\n    leaderboards.strips?.[0] ??\n    leaderboards.boonStrips?.[0] ??\n    stats.maxStrips ??\n    stats.supportPlayers\n      ?.map((player) => ({\n        account: player.account,\n        profession: player.profession,\n        value: player.supportTotals?.boonStrips ?? 0,\n      }))\n      .sort((a, b) => b.value - a.value)[0];\n'''
if text.count(old) != 1:
    raise SystemExit(f"expected one Discord leader block, found {text.count(old)}")
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
