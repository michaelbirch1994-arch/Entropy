from pathlib import Path

path = Path("src/views/TopPlayersView.tsx")
text = path.read_text(encoding="utf-8")

import_anchor = 'import { buildNormalizedTopPlayerSources, mergePlayerSkillBreakdownsForAccount, normalizeTopPlayersLeaderboard } from "../lib/topPlayersNormalization";\n'
import_line = 'import { buildNormalizedTopPlayerSourceLeaderboards } from "../lib/topPlayerSourceLeaderboards";\n'
if text.count(import_anchor) != 1:
    raise SystemExit(f"expected one topPlayersNormalization import, found {text.count(import_anchor)}")
if import_line not in text:
    text = text.replace(import_anchor, import_anchor + import_line, 1)

old = '''  const lb = report.stats.leaderboards;\n  const normalizedSources = buildNormalizedTopPlayerSources(report.stats);\n  const entries: LeaderboardEntry[] = normalizeTopPlayersLeaderboard(report.stats, metric, normalizedSources);\n'''
new = '''  const normalizedSources = buildNormalizedTopPlayerSources(report.stats);\n  const lb = buildNormalizedTopPlayerSourceLeaderboards(report.stats, normalizedSources);\n  const entries: LeaderboardEntry[] = normalizeTopPlayersLeaderboard(report.stats, metric, normalizedSources);\n'''
if text.count(old) != 1:
    raise SystemExit(f"expected one leaderboard/source initialization block, found {text.count(old)}")
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
