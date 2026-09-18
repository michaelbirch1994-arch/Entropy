# Matt's feedback: fixes and verification

## Scope

1. Improve replay profession-icon contrast on bright maps.
2. Keep important overlapping markers readable: commander, selected, hovered.
3. Allow deselection by clicking the selected actor or empty map, without treating panning as a click.
4. Align profession text colors with bundled profession artwork.
5. Bundle known Wiki/Imgur images and resolve their original report URLs locally, including equipment, conditions and Firebrand tome skills.

Parser architecture and dependency messaging are excluded at the user's request.

## Implementation plan

- Put an opaque dark disc behind icons, avoiding accumulating translucent fills.
- Retain stable actor keys; paint normal actors first, then commander, selection, hover.
- Ignore label hit testing and distinguish pointer movement from clicks.
- Measure actual icon colors and use them for profession labels.
- Preserve official ArenaNet render URLs and unknown URLs; remap only verified assets.
- Run replay regression tests, asset resolver tests, type checks, and browser interaction checks.

## Completed locally

- Dark opaque marker backing; stable commander/selection/hover paint order.
- Names painted above markers, with vertical separation for colliding labels.
- Selected-marker and empty-map deselection; dragging preserves selection.
- Profession text palette sampled from bundled artwork. Revenant and Engineer use lighter variants of the same hue for dark-surface readability.
- Known weapon-swap URLs resolved locally in rotation, skill and squad-source displays.
- Expanded the local manifest to 56 Wiki/Imgur assets. Builder equipment, nested mechanic facts and condition icons use the resolver; loaded reports are localized without mutating their source data.
- The sync script reuses existing images by default; `--refresh` downloads updates and retains existing copies when a refresh fails. Source mappings and failures are recorded in `docs/community-image-sync.json`.
- All 648 tests passed across 114 files. TypeScript project checks passed. All 56 manifest images decoded successfully in Chrome and their gallery was visually inspected.
- Isolated Chromium interaction checks passed for selection, toggling, empty-space clearing, hover foreground, drag preservation and keyboard selection/deselection.
- Not deployed. Dense real-session Firefox verification remains outstanding; unrelated external image URLs are not indiscriminately mirrored.

### Sources

- public/images/weapon-swap.png: https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png
- public/images/replay-map-K7taOUe.png: https://i.imgur.com/K7taOUe.png (weapon-swap arrow, despite the legacy local filename).
- Downloaded and visually inspected September 9, 2026. Guild Wars 2 artwork belongs to ArenaNet; originals retained without alteration.
