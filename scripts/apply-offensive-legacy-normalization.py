from pathlib import Path

path = Path("src/views/OffensiveView.tsx")
text = path.read_text(encoding="utf-8")

import_anchor = 'import { hasNonPlayerObjectiveDamage, nonPlayerObjectiveDamage } from "../lib/offenseColumns";\n'
import_line = 'import { normalizeOffensePlayers } from "../lib/offensivePlayerNormalization";\n'
if text.count(import_anchor) != 1:
    raise SystemExit(f"expected one offenseColumns import, found {text.count(import_anchor)}")
if import_line not in text:
    text = text.replace(import_anchor, import_anchor + import_line, 1)

old_block = '''    // Dedupe by account before mapping - offensePlayers can contain duplicate\n    // entries for the same account (e.g. a build swap mid-report), which is\n    // easy to miss in the default damage-sorted order but becomes obvious once\n    // sorting by another column scatters the duplicates apart. Mirrors the\n    // same account-dedupe fix applied in BuffsView.\n    const players = Array.from(new Map(report.stats.offensePlayers.map((pl) => [pl.account, pl])).values());\n'''
new_block = '''    // Modern reports already contain one offense row per account. Archived\n    // reports can still contain profession-split slices after a build swap;\n    // recombine those slices so totals and hit-rate denominators stay complete.\n    const players = normalizeOffensePlayers(report.stats.offensePlayers);\n'''
if text.count(old_block) != 1:
    raise SystemExit(f"expected one legacy offense dedupe block, found {text.count(old_block)}")
text = text.replace(old_block, new_block, 1)

path.write_text(text, encoding="utf-8")
