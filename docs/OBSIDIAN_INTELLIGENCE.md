# Obsidian Intelligence

## Boundary

This migration changes presentation and navigation only. Do not edit metric
definitions, parsing, aggregation, scoring, interpretation, thresholds, or data
inclusion. Do not rebuild or replace the user's report to make the UI look better.
Analytics issues belong in a separate project.

## Visual Direction

The user's September 8 clarification takes precedence over earlier minimalist
language: Entropy should be extravagant and crafted, not reduced to bare metrics.
Use existing architectural artwork, prominent profession identities, dimensional
surfaces and deliberate gold detailing. Preserve readable evidence, stable layout,
fast navigation and the full analytical depth. Richness does not require continuous
animation, oversized empty regions or a decorative frame around every label.

## Audit: 2026-09-08

Baseline: `dac7952`, 618 passing tests across 106 files. The loaded browser report
contains eight fights, dated September 1. Overview reports 69 allied downs, 56
allied deaths, 89 enemy downs, 29 enemy deaths. Offensive (All damage / Totals)
reports 8.92m damage, 1.73m down contribution, 1,078 strips, 220 crowd control.
These are regression checkpoints, not new definitions or reference calculations.

### Architecture

- React 19, TypeScript, Vite, Tailwind, Lucide, Recharts, Framer Motion, Tauri.
- 234 source files, 32 view files, 30 routes, 29 navigation entries. Highlights is
  an existing compatibility route. No new analytical routes are needed.
- ReportContext owns ingestion/report persistence. ViewContext already supports
  account/fight/time-targeted navigation and a return trail. Reuse both untouched.
- Shared primitives already include Panel, StatCard, SegmentedControl,
  SortableHeader, BoundedDataRegion, TopbarActionMenu and profession identity.
- Eighteen CSS imports include five competing black/gold finishing passes.
  Global.css and BuilderVisualFoundation.css retain significant domain layout.
- The surface inventory finds 26 tables, 42 inputs, 249 buttons, 226 native title
  tooltips, 58 motion references, 778 hardcoded colors, 284 large-radius classes.
  Counts include semantic chart/profession colors; those are not cleanup targets.

### What Works

- Rich, evidence-backed reporting with explicit unavailable/partial data states.
- Exact account/fight/timestamp drill-down and existing return navigation.
- Replay's reserved map/inspector dimensions and independent playback clock.
- Builder's image-backed equipment, trait selection, library/squad workflow and
  scrollable source breakdown. Preserve these interactions and dimensions.
- Existing sortable tables, sample reliability context and profession colors.
- A strong Entropy mark and cinematic intake assets already exist.

### Problems and Migration Map

| Surface | Present friction | Presentation work |
| --- | --- | --- |
| Shell / sidebar | Accordion nesting collapses into tiny indented icons; hidden links remain keyboard reachable; Ctrl K only focuses a narrow search input | Stable icon rail, real disclosure semantics, global command dialog, clear current location |
| Header | Report title is secondary to the view; duplicate share actions and technical version occupy prime space; global-looking scope switches are view-specific | Persistent session line, route hierarchy, keep genuine scope controls local, move appearance controls to a dialog |
| Overview | Long recap precedes outcomes; two oversized glowing MVP panels; repeated boxed labels | Outcomes first, readable recap/evidence columns, compact ranked identities, neutral summary rows |
| Fight Breakdown / KDR / maps / classes | Inconsistent chart chrome, table controls and selection | Shared panel/table/chart system; retain outcome filtering and compare actions |
| Offensive / Defensive / squad / buffs / conditions | Excessive card height, cramped numeric headers, independent table implementations | Stable numeric alignment, sticky readable headers, keyboard scrolling and optional compact density |
| Top Players / profiles / comparison | Repeated ornamental identity cards, long names, too many equal-weight surfaces | Dossier hierarchy, aligned comparison columns, preserve metric deltas and sample caveats |
| Intelligence | Huge warning masthead, nested cards and dense evidence pills compete with findings | Neutral section bands, severity only at evidence, restrained selection; preserve every caveat and evidence link |
| Replay / mechanics / death recap / rotations | Controls and evidence compete with canvas; nested scrolling and layout movement risk | Shared toolbar/inspector chrome, stable playback area; never change map coordinates or clock |
| Builder | Conflicting amber/teal chrome, small text, sensitive fixed-format grids | Shared neutral tokens; preserve class, skill and item art, fixed dimensions and source-dialog scrolling |
| Archive / report comparison | Separate styling for search/selection/empty states | Shared controls and table hierarchy; preserve storage/import behavior |
| Intake / loading / errors | Many decorative layers, weak progress hierarchy | Retain bitmap identity; simplify presentation, meaningful loading status and actionable errors |
| Settings | No central appearance settings; Discord setup is separate | Small presentation-only control center, keep existing integration settings/actions |

### Accessibility and Performance

- Collapsed nav contents currently remain in the accessibility tree and tab order.
- Native table header click handlers are not consistently keyboard operable.
- There is no complete global command palette, although the route registry and
  navigation-target interface make one straightforward.
- Repeated backdrop blur, neon shadows, continuous recap rotation and staggered
  card transforms are unnecessary in an analytical workspace.
- Separate local fight filters must not be presented as a single global filter.
  A fight search result navigates to Fight Breakdown; it does not rescope totals.
- Keep data tables opaque. Blur is limited to small menus/overlays. Never animate
  layout widths when charts resize. Honor both OS and explicit reduced motion.

## Design System

- Canvas: #0B0C0E. Navigation: #111214. Workspace: #141619.
- Elevated: #1C1E22. Inset: #0E1012. Neutral hairline borders.
- Text: #F1F2F4 / #C3C6CC / #9B9FA7. Gold: #CDB783 for identity, fine
  architectural edges and selection. Teal distinguishes defensive leadership.
- Preserve all existing semantic, profession, boon and chart-series colors.
- Body/display: IBM Plex Sans, Inter/system fallbacks; tabular JetBrains Mono
  for numeric data. No condensed all-caps body text or negative letter spacing.
- Space: 4, 8, 12, 16, 24, 32. Radius: 4 for controls, 8 for framed tools/overlays.
- Elevation: canvas, nav, workspace, repeated items, selected state, overlay.
- Motion: short content reveals, sliding active tabs and local menu/disclosure
  transitions. Never animate chart container widths or literal metric values.
  Honor OS and explicit reduced motion; no constant pulses.

## Implementation Order

1. Audit and baseline (complete).
2. Consolidate tokens and visual ownership; retire competing finish imports.
3. Rebuild sidebar, session context, command search and appearance dialog.
4. Strengthen shared panels, tables, sort controls, chart tooltips and states.
5. Recompose Overview; then inspect all major routes under the shared system.
6. Validate navigation, dialogs, filters, resizing, reduced motion and scrolling.
7. Compare metric checkpoints, run full tests and `tsc -b` production build.

## Verification Ledger

Baseline tests: 618 / 618. Baseline browser: Chromium, loaded eight-fight report.

### Completed September 8, 2026

- Consolidated the application finish into ObsidianGold.css; removed four
  competing finish imports, retaining domain layout sheets and semantic colors.
- Added the stable sidebar, persistent session header, accessible search dialog
  and appearance preferences (density, contrast, reduced motion, sidebar).
- Rebuilt Overview hierarchy with outcomes first and compact ranked leaders.
- Simplified shared panels, table chrome, sort indicators and chart tooltips.
- Neutralized builder command/canvas surfaces and fixed profession-name wrapping;
  kept trait art, equipment dimensions, saved library and squad assignments.
- Search opens an exact fight dossier or focuses its matching roster account.
  Account search uses the report roster, not the top-12 leaderboard subset.
  It does not filter report data or change a metric's scope.

### Verified

- 620 tests passed across 107 files, including two new preference tests.
- TypeScript project build and Vite production build passed. Existing zlib
  browser externalization, Tauri import and large-chunk warnings remain.
- Offensive rendered text matches the original baseline ignoring CSS case:
  same 4,381 characters, values and row order. Overview outcome checkpoint remains
  69 allied downs / 56 allied deaths / 89 enemy downs / 29 enemy deaths.
- View search and keyboard Enter work. Fight 2 opens/focuses Fight 2 dossier.
  Aeru.4280 search focuses the matching roster row; all 33 rows remain present.
- Search empty state stays inside a 390px viewport. Escape closes it and returns
  focus to its triggering search button.
- Appearance controls update immediately. Compact table rows reduce from 60.84
  to 52.84px. Contrast and reduced-motion controls were exercised and restored.
- Screenshots inspected at normal desktop, 1440x900, 1024x768 and 390x844.
  Overview and builder had no page-wide horizontal overflow; all six Overview
  leader rows fit the mobile content width. Temporary viewport overrides reset.
- Builder Build/Squad navigation, saved six-build library, 16 assigned slots and
  vertical trait presentation remained visible. No saved build/report replaced.
- No browser errors observed during these checks. Git diff whitespace check passed.

### Expressive Overview and Intelligence Pass

- Added image-led Entropy and Intelligence mastheads using the existing command
  sanctum artwork, with direct Intelligence and replay actions on Overview.
- Featured the first offensive/defensive player with larger profession emblems,
  account identities and unchanged scores; retained both runners-up and facts.
- Moved the critical event/evidence workspace ahead of the detailed readout.
  Added section anchors and a fight selector with previous/next controls.
  Every fight remains selectable, including beyond the former 11-fight preview.
- Kept complete event summaries, confidence, context, source caveats, narrative,
  related episodes and deep evidence. No analytical implementation was changed.
- Evidence adapts to its available panel width, with readable wrapping and
  keyboard scrolling. Mobile event selection focuses its evidence panel; a
  return link goes back to the feed. Related-episode event selection also brings
  the matching evidence into view on desktop.
- Route changes reset the old page's scroll position before exact fight/account
  targets receive their existing destination focus.

Verification:

- 623 tests passed across 108 files. Three new presentation tests cover full
  fight options, empty-scope controls and untruncated event summaries.
- TypeScript project build and production build passed; existing dependency and
  bundle-size warnings remain.
- Overview remains 69 / 56 / 89 / 29. Intelligence Fight 2 remains 100/100
  pressure, two findings and 24 / 20 downs/deaths, with 64 critical events.
  The original 4,379-character scoping/aggregation block is unchanged.
- All-fight scope remains 92 / 59 Intelligence downs/deaths and eight findings.
  Scope stepping clears the selection; mass-down filtering shows exactly three
  events in Fight 2. Deep evidence still exposes the linked window and findings.
- Fight 2 search still focuses its exact dossier. Aeru.4280 search still focuses
  the matching roster row with all 33 rows present.
- Inspected Overview at 1874, 1440, 1280, 1024, 768 and 390px; featured rows and
  page width fit. Inspected Intelligence at desktop and 390px; no horizontal
  evidence overflow. Keyboard End reaches the final evidence caveat.
- Restored normal viewport dimensions and left the live Overview at the top.
- No browser errors or broken Overview images observed in the final check.

### Player, Metric and Performance Pass

- Added profession-led player cards, ranked emblems, literal values and
  source-backed comparison bars. Sample reliability and evidence remain visible.
- Overview MVP scores have a dedicated high-contrast column; full supporting
  values appear in a separate band and stack as readable rows on phones.
- Replaced the offensive top-five bar presentation with full account/profession
  rankings, exact values and direct Top Players navigation. Kept the existing
  top-five selection, totals, ordering and table calculations unchanged.
- Added semantic, keyboard-operable offensive sort headers and shared panel
  headings. Redesigned defensive metric grouping, healing identities, skill
  imagery, selected tabs, squad context bands and shared chart presentation.
- Full suite: 628 tests across 109 files passed. TypeScript and production build
  passed. Existing dependency/bundle warnings remain. Overview 69/56/89/29,
  MVP 3.8/5.1 and offense 8.92m/1.73m/1,078/220 remain unchanged.
- Inspected player cards at 2600px and 390px; Overview MVP scores and full
  supporting values at 1440px and 390px fit without numeric clipping.
- Deployment requested to the existing entropy-um58 Vercel project. The direct
  connector cannot accept the full artwork/source payload; use the normal
  Git-connected deployment and dashboard promotion instead.

### Production and Squad Follow-up

- Published commit 28c58de through the existing Vercel project, with a production
  rebuild and the entropy-um58.vercel.app alias. Deployment
  dpl_EWvf6QE7ozgLJe3VVMJQ2LkyZxYA reached Ready; the public page returns HTTP 200.
- The subsequent local squad pass keeps the same top-ten DPS selection and
  rounded values, with complete account names, profession artwork and keyboard
  navigation to the corresponding DPS player view.
- Squad source rows now show larger artwork, full wrapping names, and separate
  primary/secondary evidence. No evidence rows or calculation inputs changed.
- Corrected summary grid density so numbers remain on one line. Verified 1280px
  and 390px layouts with no page or source-row horizontal overflow. Verified
  keyboard activation opens Hazken.8769 in the DPS view.
- All 634 tests across 111 files pass; TypeScript and production build pass.
  The squad follow-up is local and has not yet been deployed.

### Roster Identity Follow-up

- Replaced nested party/player boxes with unframed party blocks, larger
  profession artwork, full account/character names and prominent uptime.
- Party members are keyboard-operable buttons that select and focus the matching
  roster table row, including repeat activation of the same account.
- Preserved party membership, player ordering, summary calculations and uptime
  rounding. Decorative meters retain the previous bounds.
- Verified all 33 entries at 390px with no row or page overflow. Selecting
  Deadly Gargoyle.8342 focuses the correct table row. No browser errors observed.
- TypeScript and 14 focused presentation tests pass, including three new roster
  cases. This follow-up remains local rather than part of the public deployment.

### Arrival and Intake Follow-up

- Added a centered Entropy arrival and a unified intake surface with Files,
  Report Link and Watch Folder modes. Existing queue, retry, combination and
  folder permission behavior remains intact. Raw-upload disclosure stays visible.
- Nested drag targets now use a depth counter so the drop highlight does not
  flicker between child elements. The active drop state changes its label.
- Created public/images/entropy-arrival-hall-v2.png using the built-in image
  generator, retaining the old sanctuary artwork. Prompt: a wide, elegant
  obsidian architectural hall with brushed champagne-gold inlays, verdigris
  accents, ivory daylight, crisp structural detail at the edges and a calm dark
  central 55 percent for title and uploader; no people, text, UI, particles,
  floating orbs, throne or altar. High-end dark-fantasy architectural artwork.
- Verified mobile intake at 390px with no page overflow, mode selection,
  folder controls and visible failed-link retry state. No combat files uploaded.
- These arrival and artwork changes remain local, not publicly deployed.

### Remaining Migration

- Further route-specific refinement of replay, player dossiers, archive, intake
  and loading/error presentation, plus deeper Intelligence evidence surfaces.
- Full keyboard and screen-reader audit beyond the verified shell/dialog flows.
- Firefox, huge-session and empty-report coverage have not been exercised.
- No version-number release performed in this pass.

## Analytics Observations (Not Changed)

No analytical changes are authorized by this migration. Differences between
Intelligence-window totals and report-wide totals are not reconciled in the UI.
Their existing scope descriptions must remain visible.
