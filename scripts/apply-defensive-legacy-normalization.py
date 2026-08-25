from pathlib import Path

path = Path("src/views/DefensiveView.tsx")
text = path.read_text(encoding="utf-8")

import_anchor = 'import { resolvePlayerSampleContext } from "../lib/playerSampleContext";\n'
import_line = 'import { normalizeDefensivePlayerRows } from "../lib/defensivePlayerNormalization";\n'
if text.count(import_anchor) != 1:
    raise SystemExit(f"expected one playerSampleContext import, found {text.count(import_anchor)}")
if import_line not in text:
    text = text.replace(import_anchor, import_anchor + import_line, 1)

old_helper = '''// s.*Players arrays can contain duplicate entries for the same account (e.g.\n// a build swap mid-report), which is easy to miss in the default sort order\n// but becomes obvious once a column sort scatters the duplicates apart -\n// mirrors the same account-dedupe fix applied in BuffsView/OffensiveView.\nfunction dedupeByAccount<T extends { account: string }>(rows: T[]): T[] {\n  return Array.from(new Map(rows.map((r) => [r.account, r])).values());\n}\n\n'''
if text.count(old_helper) != 1:
    raise SystemExit(f"expected one legacy dedupe helper, found {text.count(old_helper)}")
text = text.replace(old_helper, "", 1)

old_rows = '''  // Deduped once here so every summary card, MVP list, and sortable table\n  // built from these derives from a single row per player instead of\n  // silently double-counting totals or rendering the same player twice.\n  const supportPlayers = useMemo(() => dedupeByAccount(s?.supportPlayers ?? []), [s]);\n  const healingPlayers = useMemo(() => dedupeByAccount(s?.healingPlayers ?? []), [s]);\n  const defensePlayers = useMemo(() => dedupeByAccount(s?.defensePlayers ?? []), [s]);\n  const damageMitigationPlayers = useMemo(() => dedupeByAccount(s?.damageMitigationPlayers ?? []), [s]);\n'''
new_rows = '''  // Normalize archived profession-split rows once so every summary, MVP, and\n  // sortable table uses the complete account contribution. Modern reports\n  // already contain one row per account and pass through unchanged.\n  const normalizedPlayers = useMemo(() => normalizeDefensivePlayerRows(s), [s]);\n  const { supportPlayers, healingPlayers, defensePlayers, damageMitigationPlayers } = normalizedPlayers;\n'''
if text.count(old_rows) != 1:
    raise SystemExit(f"expected one defensive player memo block, found {text.count(old_rows)}")
text = text.replace(old_rows, new_rows, 1)

path.write_text(text, encoding="utf-8")
