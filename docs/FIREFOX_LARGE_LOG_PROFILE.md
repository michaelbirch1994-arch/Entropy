# Firefox large-log profiling plan

Date: 2026-08-19

## Why this remains open

Tess reported substantial lag in Firefox after loading the Saturday/15th combined logs while current Chrome remained responsive. That complaint should not be closed from static inspection or small synthetic fixtures.

## Required reproduction data

Use a representative combined raid matching the tester workload as closely as possible:

- multiple fights from the same session,
- mixed player attendance,
- profession/role swaps,
- enough fights/players to populate the heavy report views,
- raw dps.report/EI timeline data when available.

The current ChatGPT file library only contains three older Aug 6 `.zevtc` samples (about 0.9 MB, 2.2 MB, and 0.86 MB). They are useful functional fixtures but are not a substitute for the Saturday/15th combined raid, so they must not be used to declare the Firefox issue solved.

## Browser matrix

Profile the same loaded report in:

1. current Firefox,
2. current Chrome,
3. current Edge,
4. Safari when practical.

Use the same machine, display scaling, browser zoom, and report state where possible.

## Measurements

Record for each browser:

- time from report load completion to first responsive interaction,
- sidebar/tab-switch latency,
- sort/filter latency on large tables,
- main-thread long tasks,
- scripting vs rendering vs painting time,
- DOM node count in the heaviest views,
- React rerender counts for report and shared-context changes,
- memory before load / after load / after several tab changes,
- chart interaction latency.

## Views to exercise

At minimum:

- Overview,
- Offensive,
- Defensive / Support / Healing,
- Squad Stats,
- Buffs,
- Buff Generation,
- Party Boons,
- Top Skills,
- DPS Graph,
- Fight Replay,
- Death Recap,
- Fight Breakdown.

## Suspects to verify, not assume

Check these only after reproducing the slowdown:

- repeated derived-array construction or sorting during render,
- broad ReportContext/shared-context rerenders,
- Recharts animation or SVG point count,
- blur/backdrop-filter and large shadow costs,
- large non-virtualized tables,
- unstable callback/object identities,
- replay/timeline calculations kept mounted when the view is inactive.

Do not disable visual effects, virtualize tables, or rewrite shared state merely because they are plausible suspects. Measure first.

## Acceptance criteria

The Firefox item can be marked complete only when:

- the representative combined raid is tested in Firefox and Chrome,
- the measured bottleneck is documented,
- the smallest compatible fix is applied,
- Firefox remains responsive after load and during the same interactions that previously lagged,
- Chrome does not regress,
- typecheck/build/tests remain green,
- any new performance-specific regression test or benchmark is documented.

## Current status

Static inspection and earlier cleanup have already removed one known expensive behavior: page-level exit/slide animation that temporarily mounted two heavy report views during navigation. The remaining Firefox complaint is still **unverified** until a representative combined raid is available and profiled.
