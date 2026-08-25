from pathlib import Path

path = Path('src/lib/playerProfileStore.ts')
text = path.read_text(encoding='utf-8')

import_anchor = 'import type { WvWReport } from "../types/report";\n'
import_line = 'import { aggregateReportPlayersForProfiles } from "./profileReportAggregation";\n'
if import_line not in text:
    if text.count(import_anchor) != 1:
        raise SystemExit('playerProfileStore import anchor mismatch')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

start_marker = '  const byAccount = new Map<string, {\n'
end_marker = '  if (byAccount.size === 0) return;\n'
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit(f'profile aggregation block markers missing: start={start}, end={end}')
if text.find(start_marker, start + 1) != -1:
    raise SystemExit('multiple profile aggregation starts found')
replacement = '  const byAccount = aggregateReportPlayersForProfiles(s);\n\n'
text = text[:start] + replacement + text[end:]

path.write_text(text, encoding='utf-8')
