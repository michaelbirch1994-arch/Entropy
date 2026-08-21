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

Status: implemented on `feature/entropy-builder-parity`.

- One cache-backed GW2 catalog source for professions, stat packages, legends, and pets.
- Seven-day local cache with stale-cache fallback when the API is temporarily unavailable.
- Profession- and specialization-aware weapon choices.
- Main-hand, off-hand, and two-handed legality checks.
- Named selectors for Revenant legends, Ranger pets, Engineer kits, and Thief profession skills.
- Imported legacy values remain visible and are never silently discarded.
- AxiCode field shapes and round-trip behavior remain unchanged.

## Cut 2 — complete equipment editor

Status: in progress on `feature/entropy-builder-parity`.

Implemented in the current slice:

- Searchable, codec-backed relic, food, and utility choices.
- Official GW2 item-name and icon resolution for imported rune, sigil, and enrichment IDs.
- Local item metadata cache with raw-value fallback when metadata is unavailable.
- Compact visual loadout summary for stats, weapon sets, runes, relic, and consumables.
- Mixed per-slot rune imports remain independently editable instead of being flattened.
- Unsupported future text values remain visible and are clearly marked as not encodable by the installed AxiCode format.

Remaining in Cut 2:

- Add full searchable rune, sigil, and enrichment catalogs, plus official relic icon resolution.
- Add armor, trinket, and weapon slot cards with clear empty and unavailable states.
- Add weapon-specific skill previews and profession mechanic slots.
- Add game-mode-aware filtering where the GW2 API exposes a reliable mode distinction.
- Keep raw IDs available only in an advanced inspector for troubleshooting and lossless import.

Acceptance:

- A normal user can finish a legal equipment setup without typing an API ID.
- Unsupported imported values are labeled, preserved, and repairable.
- Saving and reopening a build produces the same encoded build data.

## Cut 3 — visual build sheet and derived summaries

- Render the familiar three specialization rows and trait choices as an interactive build sheet.
- Render heal, utility, elite, profession, pet, and legend slots with icons and tooltips.
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
