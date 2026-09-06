# Entropy Builder parity roadmap

## Product boundary

Entropy Builder is a dedicated build and squad workspace inside Entropy. It may share navigation, theme tokens, local persistence, and export infrastructure with the report viewer, but it must not alter combat-log parsing, normalization, scoring, or analytics methodology.

The Builder UI and exported artifacts use Entropy naming only. No author names or attribution text are shown in the product.

## Current baseline

The existing workspace already supports:

- profession, specialization, trait, and skill selection;
- equipment fields and profession-specific settings;
- AxiCode build and squad import/export;
- a persistent local build library;
- five-player subgroup composition editing;
- readiness validation and a contextual field manual.

## Target experience architecture

The AxiForge 0.12.0 reference is strongest because it gives each task a dedicated surface. Entropy should adopt that hierarchy while retaining its own black-gold visual language and existing Builder data model.

### 1. Squad overview

- Use a two-column command view: subgroup slots and collapsible party coverage on the left; a dense, searchable build roster on the right.
- Represent assigned builds with profession or elite-spec icons. A slot remains recognizable without requiring the full build card.
- Use one compact build-card pattern throughout Squad and Library: identity, role, specializations, weapon sets, doctrine stats, relic, and game mode.
- Selecting a party slot focuses its build in the roster. Activating a filled slot or build card opens the Build Viewer.
- Keep party coverage collapsed by default. Expanded coverage shows only facts derived from selected build data and labels estimates explicitly.

### 2. Build Viewer

- Open as a focused modal on desktop so the user keeps their Squad or Library context.
- Open as a full-screen sheet on narrow screens.
- Synchronize the selected build ID into the URL. Provide a familiar external-window button that opens the same stable viewer URL in a new browser tab.
- Use two primary tabs: `Build` and `Equipment`.
- The `Build` tab shows identity, game mode, copyable chat code, combat bar, specialization rows, and a compact contextual reference panel.
- The `Equipment` tab shows armor, weapon sets, weapon skills, trinkets, upgrades, consumables, and existing calculated attributes. It does not change attribute formulas.
- Include one clear `Edit build` command. Viewing and editing remain separate modes.
- Clicking or focusing a skill, trait, pet, legend, rune, sigil, or relic updates the compact reference panel; an expand command opens a detailed Inspector dialog.

### 3. Build Editor

- Keep the existing Overview, Traits & Skills, Equipment, Notes, and Preview workflow, but treat it as an editing destination rather than the universal display surface.
- Reuse the same combat bar, specialization strip, equipment slot, item tooltip, and build identity components as the Build Viewer.
- Keep Save visible, group secondary export actions, and preserve the optional Readiness/Inspector rail.
- Do not duplicate complete read-only summaries above editable controls. Each editing workspace shows only the context needed for its current task.

### 4. Library

- Make the compact build card the default scanning unit.
- Card-body activation opens the Build Viewer; a dedicated pencil command opens the editor.
- Add search and filters before folders or advanced organization. Profession, elite spec, role, game mode, and tags are the first useful filters.
- Preserve duplicate, copy, share, and delete as secondary card actions in a menu instead of displaying every command at equal weight.

### Viewer interaction contract

- Default activation: open the Build Viewer modal and update URL state without a page reload.
- `Escape` closes the viewer, focus is trapped while open, and focus returns to the originating card or slot.
- Browser Back closes the viewer before leaving Entropy.
- `Ctrl`/`Cmd` activation and the external-window icon open the stable viewer URL in a new tab.
- The modal uses a 140-180ms opacity and small-scale transition. Tab content uses a short opacity transition without animating height.
- `prefers-reduced-motion` removes scale and movement while preserving instant state feedback.

### Component plan

Extract the current monolithic `src/views/AxiForgeLabView.tsx` before the large visual rebuild:

- `src/components/builder/BuilderShell.tsx` - command header, Build/Library/Squad navigation, notices, and URL state.
- `src/components/builder/BuildSummaryCard.tsx` - shared compact card for Library, Squad roster, and assignments.
- `src/components/builder/BuildViewerDialog.tsx` - modal/sheet shell, focus management, Back behavior, and new-tab command.
- `src/components/builder/BuildViewer.tsx` - identity header plus Build/Equipment tabs.
- `src/components/builder/BuildCombatBar.tsx` - shared weapon, utility, profession mechanic, health, and weapon-swap presentation.
- `src/components/builder/SpecializationBoard.tsx` - shared specialization artwork and trait rows.
- `src/components/builder/EquipmentBoard.tsx` - shared armor, weapons, trinkets, upgrades, and consumables presentation.
- `src/components/builder/BuilderInspectorDialog.tsx` - expanded entity details and focus-safe dismissal.
- `src/components/builder/SquadComposer.tsx` - party grid, build roster, assignment interactions, and coverage accordions.

Existing state, catalogs, codecs, and calculations remain in `src/lib/axiforge` and `src/lib/gw2`. This refactor must not rewrite those contracts.

### Implementation sequence

#### Phase A - shared visual primitives

1. Extract the combat bar, specialization board, equipment board, and compact build card without changing behavior.
2. Add Storybook-like fixture states through existing tests or a dedicated local fixture route: complete, partial, invalid import, long names, missing icons, and empty equipment.
3. Freeze the current Builder state and codec interfaces with round-trip tests.

Acceptance: extracted components render the same selected values, all current Builder tests pass, and no report-analysis files change.

Progress: the shared combat bar and compact build summary card are extracted and covered by focused rendering tests. Specialization and equipment boards remain to be extracted as the Build Viewer is assembled.

#### Phase B - Build Viewer

1. Add URL-addressable viewer state using the existing Entropy query-state pattern.
2. Build the modal/full-screen sheet with `Build` and `Equipment` tabs.
3. Reuse the extracted visual components and add the compact-to-expanded Inspector flow.
4. Add explicit Edit, Copy code, Share, Close, and Open in new tab commands.

Acceptance: a saved build opens from a stable URL, Back/Escape/focus restoration work, refresh preserves the viewed build, and no draft is mutated by viewing.

Progress: the focused viewer is implemented for Library and Squad build activation. It provides URL-addressable desktop modal and mobile sheet behavior, Build and Equipment tabs, explicit Edit and new-tab actions, browser Back support, focus trapping and restoration, reduced-motion handling, recovery from stale saved-build links, grouped portable copy/share actions, and a compact catalog-backed Inspector for professions, specializations, traits, skills, pets, runes, sigils, relics, and enrichments. An optional expanded detail dialog remains for descriptions or combat facts that outgrow the compact panel.

#### Phase C - Squad command view

1. Replace the vertically stacked composer with the split party/roster layout.
2. Use profession icons for five-slot subgroup scanning and shared compact cards for the roster.
3. Open the Build Viewer from either side without leaving the composition.
4. Convert coverage sections into per-party accordions and preserve explicit estimate labels.

Acceptance: assignments, moves, removals, save/reopen, and build viewing work with mouse and keyboard; a 25-player squad remains scannable without horizontal overflow.

#### Phase D - Library hierarchy

1. Use the shared card and Build Viewer behavior.
2. Add profession, spec, role, mode, and tag filters.
3. Consolidate secondary actions into an accessible menu.
4. Defer folders, multi-select, and manual ordering until real library size demonstrates the need.

Acceptance: users can find, inspect, edit, duplicate, share, and delete builds without ambiguous card clicks or persistent visual clutter.

#### Phase E - final polish

1. Normalize spacing, icon sizes, border strength, typography, empty states, skeletons, and tooltips across all Builder surfaces.
2. Verify desktop, tablet, and phone layouts with complete and incomplete builds.
3. Audit focus order, visible focus, dialogs, tab semantics, reduced motion, contrast, truncation, and long localized names.
4. Profile modal opening, catalog hydration, image loading, and large squad rendering; memoize only where measured.

Acceptance: no layout shift when images load, no jerking height animations, every icon action has a tooltip and accessible name, and the full interaction suite passes at supported widths.

### Non-negotiable boundary

This overhaul may rearrange and restyle existing Builder values. It must not change report metrics, combat-log parsing, normalization, rankings, scoring, Builder attribute formulas, boon/condition estimation formulas, or AxiCode semantics. Any future calculation change requires a separate evidence-backed scope and review.

## Cut 1 — catalog-backed legal choices

Status: implemented and present in the `v0.2.98` baseline.

- One cache-backed GW2 catalog source for professions, stat packages, legends, and pets.
- Seven-day local cache with stale-cache fallback when the API is temporarily unavailable.
- Profession- and specialization-aware weapon choices.
- Main-hand, off-hand, and two-handed legality checks.
- Named selectors for Revenant legends, Ranger pets, Engineer kits, and Thief profession skills.
- Imported legacy values remain visible and are never silently discarded.
- AxiCode field shapes and round-trip behavior remain unchanged.

## Cut 2 — complete equipment editor

Status: in progress; the baseline below was verified against `v0.2.98`.

Implemented in the current slice:

- Searchable, codec-backed relic, food, and utility choices.
- Searchable curated rune, sigil, and enrichment choices.
- Official GW2 item-name and icon resolution for imported rune, sigil, and enrichment IDs.
- Official relic icon resolution for supported relics.
- Local item metadata cache with raw-value fallback when metadata is unavailable.
- Compact visual loadout summary for stats, weapon sets, runes, relic, and consumables.
- Visual armor, weapon-set, trinket, relic, consumable, and enrichment rows with explicit empty states.
- Equipment opens with a synchronized visual loadout summary that follows the active equipment workspace; editor columns reflow from the actual workspace width.
- Per-slot armor, weapon, and trinket stat overrides backed by the existing local builder state.
- Weapon-specific skill previews with a display-only weapon-set swap control.
- Mixed per-slot rune imports remain independently editable instead of being flattened.
- Unsupported future text values remain visible and are clearly marked as not encodable by the installed AxiCode format.
- Rune, sigil, and enrichment catalogs match the synced AxiForge 0.12.0 lists; all 195 IDs and names were verified against the official GW2 API.
- Relic, food, and utility choices match the exact vocabulary encodable by @axiapps/code 1.3.1. Newer relics remain lossless imported values until the codec supports them.

Remaining in Cut 2:

- Expand profession mechanic-slot presentation beyond the API-explicit core and elite buttons now shown in Preview. Derived mechanics still require dedicated resolvers for weapon bursts, toolbelt loadouts, pets, legends, and transformed bars.
- Add game-mode-aware filtering where the GW2 API exposes a reliable mode distinction.
- Keep raw IDs available only in the collapsed Advanced build data inspector for troubleshooting and lossless import.

Acceptance:

- A normal user can finish a legal equipment setup without typing an API ID.
- Unsupported imported values are labeled, preserved, and repairable.
- Saving and reopening a build produces the same encoded build data.

## Cut 3 — visual build sheet and derived summaries

Status: in progress.

Implemented in the current slice:

- Traits & Skills is presented as one cohesive loadout canvas with a compact profession header, combat bar, specialization matrix, and utility dock; responsive behavior follows the actual editor-column width.
- Three compact specialization rows with searchable Core/Elite selection, icon-backed major trait choices, duplicate guards, and Inspector access.
- Selected land skills, weapon skills, and API-explicit profession mechanics render as a visual combat bar with inspectable icons.
- Land skill pickers expose core skills plus only skills belonging to the active specialization; incompatible imported selections remain visible and repairable.
- Ranger terrestrial pet slots render from explicit Builder selections with official names, descriptions, and icons.
- Ranger terrestrial pet choices exclude the five aquatic-only API IDs while retaining amphibious pets; invalid imported selections remain visible and repairable.
- Revenant legend choices include core legends plus only the active elite specialization's legend, with both selected legend stances represented in the combat bar.
- Equipment uses four focused workspaces for weapons, armor and trinkets, upgrades, and consumables; each workspace presents only its matching visual summary and controls.
- The Builder command header keeps Import and Save visible while grouping secondary code and sharing actions into one Export menu.
- Desktop editing opens at full canvas width; readiness and the contextual Inspector remain available in an optional detail rail, while narrow screens retain the existing mobile sheets.
- Saved Library and Squad builds open in a focused, URL-addressable viewer with separate Build and Equipment tabs instead of silently replacing the active editing draft.

Remaining in Cut 3:

- Complete visual coverage for profession-specific legend slots, transformed bars, and tooltip detail across all selected slots.
- Compute a transparent summary of selected boons, conditions, control, healing, barrier, and revival utility from official metadata.
- Label inferred coverage separately from guaranteed build facts; never invent uptime or combat performance.

Acceptance:

- Every displayed capability links back to a selected skill, trait, pet, legend, rune, sigil, or relic.
- Builder summaries never appear in parsed combat analytics unless explicitly compared as planned-versus-observed data.

## Cut 4 — squad composer

- Drag builds between subgroups and preserve player/build identity.
- Show profession icons, roles, boon coverage, healing, barrier, revival, control, and missing coverage by subgroup and squad.
- Add duplicate-role and incomplete-build warnings.
- Add compact squad cards for export and review.

Acceptance:

- A composition can be saved, reopened, duplicated, and exported without data loss.
- Coverage labels clearly distinguish build potential from measured log output.

## Cut 5 — library and sharing

- Add search, filters, tags, version notes, and deterministic duplicate handling.
- Add portable Entropy build and squad files plus compact share links where payload size is safe.
- Add an optional hosted artifact path for large, stable public links; secrets remain server-side.
- Keep desktop storage local-first and make web persistence explicit to the user.

## Quality gates for every cut

- TypeScript check.
- Production build.
- Full automated test suite.
- Desktop and narrow-width interaction check.
- Import, edit, save, reopen, export, and re-import round trip.
- No changes to report parsing or analytics unless separately scoped and reviewed.
