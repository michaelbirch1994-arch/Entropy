# Entropy

Guild Wars 2 WvW log parser and raid report viewer. Upload ArcDPS `.zevtc` / `.evtc` logs (or paste [dps.report](https://dps.report) permalinks) to build squad-level fight analytics in the browser.

## Features

- Import raw ArcDPS combat logs via drag-and-drop, file picker, or connected log folder (Chromium File System Access API)
- Upload to dps.report for Elite Insights parsing, then aggregate multi-fight sessions
- Overview, KDR, fight breakdown, top players/skills, buffs, composition, rotations, DPS graphs, replay, and more
- Export HTML snapshots and optional Discord webhook sharing
- Local report archive and player profile cache (IndexedDB / localStorage)

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Recharts + Framer Motion

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy (Vercel)

This repo is set up as a static Vite app. On Vercel:

1. Import the GitHub repo
2. Framework preset: Vite (or leave defaults — `vercel.json` sets build/output)
3. Deploy

Optional env:

| Variable | Purpose |
| --- | --- |
| `VITE_ENTROPY_SHARE_VIEWER_URL` | Canonical public URL used when sharing reports (defaults to the current origin) |

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Local Vite dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run Vitest unit tests |
| `npm run lint` | Oxlint |

## License

GPL-3.0 — see `LICENSE-GPL-3.0.txt` and `THIRD_PARTY_NOTICES.md`.
