from pathlib import Path

path = Path("src/views/ConditionsView.tsx")
text = path.read_text(encoding="utf-8")

import_anchor = 'import { resolvePlayerSampleContext } from "../lib/playerSampleContext";\n'
import_line = 'import { normalizeConditionPlayers } from "../lib/conditionPlayerNormalization";\n'
if text.count(import_anchor) != 1:
    raise SystemExit(f"expected one playerSampleContext import, found {text.count(import_anchor)}")
if import_line not in text:
    text = text.replace(import_anchor, import_anchor + import_line, 1)

old = '  const conditionPlayers: ConditionPlayer[] = report?.stats.conditionPlayers ?? [];\n'
new = '  const conditionPlayers: ConditionPlayer[] = useMemo(\n    () => normalizeConditionPlayers(report?.stats.conditionPlayers, report?.stats.total ?? 0),\n    [report],\n  );\n'
if text.count(old) != 1:
    raise SystemExit(f"expected one conditionPlayers source line, found {text.count(old)}")
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
