from pathlib import Path

path = Path("src/lib/exportReportHtml.ts")
text = path.read_text(encoding="utf-8")

import_anchor = 'import type { WvWReport } from "../types/report";\n'
import_line = 'import { aggregateReportPlayersForProfiles } from "./profileReportAggregation";\n'
if text.count(import_anchor) != 1:
    raise SystemExit(f"expected one WvWReport import, found {text.count(import_anchor)}")
if import_line not in text:
    text = text.replace(import_anchor, import_anchor + import_line, 1)

start = text.index('  const totalsByAccount = new Map<')
end_marker = '  const playerRows = Array.from(totalsByAccount.entries())\n'
end = text.index(end_marker, start)
replacement = '  const totalsByAccount = aggregateReportPlayersForProfiles(s);\n\n'
text = text[:start] + replacement + text[end:]

old_cell = '<td class="num">${e.fights}</td>'
new_cell = '<td class="num">${e.logsJoined}</td>'
if text.count(old_cell) != 1:
    raise SystemExit(f"expected one exported fight-count cell, found {text.count(old_cell)}")
text = text.replace(old_cell, new_cell, 1)

path.write_text(text, encoding="utf-8")
