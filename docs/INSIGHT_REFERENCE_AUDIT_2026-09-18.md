# Insight reference audit - 2026-09-18

This audit records the source hierarchy used by Insight so the app does not mix baseline API values with WvW balance splits or treat optional parser output as complete evidence.

## Source hierarchy

1. ArenaNet `/v2/skills` identifies the skill, icon, description, structured facts, baseline recharge, range, radius and related skill records.
2. Guild Wars 2 Wiki mode-split infobox data overrides baseline recharge or behavior for WvW. The API currently returns baseline values and does not expose competitive-mode splits.
3. ArcDPS EVTC defines recorded combat result values. Entropy follows the current `cbtresult` enumeration rather than inferring numeric meanings.
4. Elite Insights defines dps.report JSON semantics. Timeline `States` are transition pairs of `[time, stack count]` and are emitted only when `RawTimelineArrays` is enabled.
5. A missing timeline, cast, position, trait, sigil, resource or recipient remains missing evidence. It must not be converted into a negative event or a certain missed opportunity.

## Reviewed WvW response references

| Skill | API ID | WvW recharge used | Reach model |
| --- | ---: | ---: | --- |
| Signet of Mercy | 9163 | 90s | 900 range + 180 radius = 1080 outer reference boundary |
| Battle Standard | 14419 | 120s | 600 range + 360 revival radius = 960 outer reference boundary |
| Eye of the Storm! | 30047 | 30s | 600 radius |
| Purging Flames | 9187 | 28s | 900 range + 180 radius = 1080 outer reference boundary |
| Null Field | 10203 | 45s | 900 range + 240 radius = 1140 outer reference boundary |
| Stand Your Ground! | 9153 | 24s | 600 radius; allied Stability is preventive and the stunbreak is self-only |
| Mantra of Liberation | 43357 | not modeled as a single cooldown | Prepared charges, activation skill, cone facing and remaining ammunition must be resolved separately |
| Spirit of Nature | 12569 | 120s | 600 range + 360 radius = 960 outer reference boundary |

The summed range and radius figures are permissive two-dimensional outer boundaries, not proof that a cast could reach. Line of sight, elevation, facing, placement, target eligibility, animation state and actual recipients remain unresolved unless separately recorded.

## Correctness changes from this audit

- Stability fact descriptions are no longer parsed as offensive control effects. ArenaNet's Stability description lists the control types it prevents, which previously could make a support skill look like an incoming crowd-control skill.
- Battle Standard now has a documented 960-unit outer reference boundary instead of an unknown reach.
- Purging Flames remains 28 seconds in WvW. The API's 20-second value is the PvE baseline and must not override the WvW split.
- Regression tests pin the reviewed WvW values and the Stability-description exclusion.

## Implemented hardening

- The reviewed skills now live in one versioned WvW reference catalog instead of being scattered through analysis modules.
- Every newly built report records the catalog revision, GW2 build, Elite Insights version and ArcDPS EVTC version used by its source logs.
- Archived reports without a stamp use a clearly labelled legacy fallback. Reports pinned to a catalog unavailable in the running app are left unassessed rather than silently reinterpreted.
- `npm run audit:references` compares every structured ArenaNet fact used by the catalog and fails loudly on drift while keeping WvW overrides separate from API baseline values.
- A weekly and manually runnable repository workflow performs the same live parity check without making the normal application build depend on external API availability.
- Insight assessments now retain a typed evidence chain that distinguishes recorded events, parser-derived state, ArenaNet API facts, reviewed WvW overrides, bounded inference and explicit user assumptions.
- The shared provenance ledger is visible in combat moments, utility effectiveness, player skill palettes and event investigations without changing the underlying parser or metric calculations.
- Newly built reports stamp player-level `buffUptimes.states` coverage as available, partial or unavailable. Legacy reports remain usable but are labelled as unstamped instead of being silently presented as complete.
- Cooldown and utility surfaces expose the RawTimelineArrays coverage separately from observed effect tracks; missing arrays remain unknown and do not become zero uptime.

## Primary references

- ArenaNet skill API: https://api.guildwars2.com/v2/skills
- Guild Wars 2 Wiki API: https://wiki.guildwars2.com/api.php
- ArcDPS EVTC format: https://www.deltaconnected.com/arcdps/evtc/README.txt
- Elite Insights parser and JSON models: https://github.com/baaron4/GW2-Elite-Insights-Parser

## Next hardening steps

- Retain each superseded catalog revision in the registry so old pinned reports remain reproducible after balance updates.
- Add a reviewed-patch workflow that creates a new catalog revision instead of editing an already-published revision in place.
- Extend the shared evidence provenance ledger to any remaining legacy assessment that still presents a conclusion without a typed source chain.
- Extend the real-fixture matrix as additional current Elite Insights exports become available, retaining paired coverage assertions for reports with and without `RawTimelineArrays`.
