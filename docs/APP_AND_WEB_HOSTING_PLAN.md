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
- Hosted viewer URLs can now load `?permalinks=...` dps.report collections or `?artifact=...` / `?reportUrl=...` / `?url=...` externally hosted Entropy report artifacts.
- The artifact schema is versioned as `entropy.report-artifact.v1`.
- A public Vercel Blob store is connected to the canonical `entropy-um58` project for production and preview deployments.
- The first `Share to Web` slice is implemented with a server-side owner key, explicit public-sharing consent, random unlisted Blob URLs, and a 100 MB artifact limit.
- Hosted runtime acceptance passed on the free preview for pull request #218. A 2.59 MB six-fight artifact uploaded and reopened with exact `5 / 13 / 17 / 22` down/death totals; an invalid owner key returned `401`, and the deployment recorded no runtime errors.
- No paid Vercel capacity is part of the plan.

## Recommended hosting shape

```text
Entropy Desktop
  parses .zevtc / fetches dps.report JSON
  builds Entropy report JSON
  exports .entropy-report.json
  later uploads artifact to storage

Vercel Entropy Viewer
  loads ?permalinks=...
  loads ?artifact=...
  fetches artifact from storage
  renders report-only UI
  powers Discord links

Storage
  stores report artifact blobs
  returns random unlisted artifact URLs
```

## Storage recommendation

Best first production path:

1. Vercel Blob for report artifacts.
2. Keep reports unlisted by default.
3. Use random ids or content hashes for URLs.
4. Add expiry/delete controls before making this broadly public.

Current free-plan guardrails:

- The upload token endpoint rejects anonymous requests and accepts only Entropy report artifact paths.
- Upload tokens expire after 10 minutes and cannot overwrite an existing artifact.
- Vercel Blob Hobby stops at its free limits instead of creating an approved paid commitment. Current included limits are 1 GB stored, 2,000 uploads, 10,000 uncached reads, and 10 GB transfer.
- The owner key is a deployment secret. It is never bundled into the web or desktop application.

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

1. Make Discord webhook include the hosted report URL when one exists.
2. Add privacy controls before upload: full names, account names, guild tags, and enemy names.
3. Add expiry and delete controls for hosted reports.
4. Split the hosted viewer bundle so heavy desktop-only and Builder-only surfaces lazy-load.
