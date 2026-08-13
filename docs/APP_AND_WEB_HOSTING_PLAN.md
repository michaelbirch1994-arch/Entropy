# Entropy Desktop + Web Hosting Plan

Entropy should keep two clear jobs:

- Desktop app: trusted local forge for raw `.zevtc` ingestion, dps.report fetching, heavy report generation, private review, updater-managed releases.
- Hosted web viewer: lightweight public/private report viewer for links, Discord sharing, and team review when someone does not have the app installed.

This split keeps the web app fast and shareable without forcing browser/Vercel runtimes to parse every raw combat log.

## Current foundation

- The desktop header export no longer creates huge `data:text/html` clipboard links.
- If a report has dps.report permalinks, Export copies a short viewer URL using the configured viewer base.
- If no short viewer link can be created, Export downloads a portable `.entropy-report.json` artifact.
- The app can now import both raw `report.json` and wrapped `.entropy-report.json` artifacts.
- The artifact schema is versioned as `entropy.report-artifact.v1`.

## Recommended hosting shape

```text
Entropy Desktop
  parses .zevtc / fetches dps.report JSON
  builds Entropy report JSON
  exports .entropy-report.json
  later uploads artifact to storage

Vercel Entropy Viewer
  loads /report?id=...
  fetches artifact from storage
  renders report-only UI
  powers Discord links

Storage
  stores compressed report artifacts
  returns short report ids
```

## Storage recommendation

Best first production path:

1. Vercel Blob for report artifacts.
2. Keep reports unlisted by default.
3. Use random ids or content hashes for URLs.
4. Add expiry/delete controls before making this broadly public.

Best long-term platform path:

1. Supabase for accounts, teams, permissions, report indexes, and search.
2. Blob/object storage for large report payloads.
3. Postgres rows only store metadata and pointers.

## Risks to design around

- WvW report payloads can be very large. Do not put full reports in URLs.
- Raw `.zevtc` parsing belongs in desktop first; browser parsing can come later as an experiment.
- Shared reports may expose player account names, guild tags, timestamps, and combat behavior. Add a clear local/private/public step before upload.
- Old reports may lack newer fields. The viewer must handle missing optional metrics gracefully.
- Discord embeds have strict field and size limits. Keep webhook payloads compact and link out for detail.
- Hosted viewer bundles should lazy-load heavy views like replay, intelligence, builder, and large charts.

## Next implementation slices

1. Add a Vercel viewer route that can load a local `.entropy-report.json` file.
2. Add hosted artifact upload behind a feature flag.
3. Add a `Share to Web` button that uploads and returns a short URL.
4. Make Discord webhook include the short hosted report URL.
5. Add privacy toggles before upload: full names, account names, guild tags, enemy names.
6. Add cleanup controls for hosted reports.
