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
