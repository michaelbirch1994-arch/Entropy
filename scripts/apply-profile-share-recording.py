from pathlib import Path

path = Path('src/store/ReportContext.tsx')
text = path.read_text(encoding='utf-8')


def add_record_call(source: str, start_marker: str, end_marker: str) -> str:
    start = source.find(start_marker)
    end = source.find(end_marker, start)
    if start < 0 or end < 0:
        raise SystemExit(f'branch markers missing for {start_marker!r}: start={start}, end={end}')
    segment = source[start:end]
    if 'recordReportIntoProfiles(data)' in segment:
        raise SystemExit(f'branch already records profiles: {start_marker!r}')
    target = '          });\n          return;\n'
    if segment.count(target) != 1:
        raise SystemExit(f'expected one cache-return anchor in {start_marker!r}, found {segment.count(target)}')
    segment = segment.replace(target, '          });\n          void recordReportIntoProfiles(data);\n          return;\n', 1)
    return source[:start] + segment + source[end:]

text = add_record_call(text, '        if (permalinks.length > 0) {\n', '        if (artifactUrl) {\n')
text = add_record_call(text, '        if (id) {\n', '        // No URL param: restore the last-viewed report from cache (if any).\n')

path.write_text(text, encoding='utf-8')
