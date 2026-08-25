from pathlib import Path
path = Path('src/lib/__tests__/topPlayersNormalization.test.ts')
text = path.read_text(encoding='utf-8')
old = '  } as ReportStats;\n'
new = '  } as unknown as ReportStats;\n'
if text.count(old) != 1:
    raise SystemExit(f'expected one ReportStats fixture cast, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
