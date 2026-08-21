# Entropy Obsidian Gold UI Audit

Status: Passes 1–7 complete; Pass 8 implementation verification complete, representative multi-fight visual acceptance pending

This document defines the presentation boundary for the Obsidian Gold consolidation. Pass 1 intentionally changes no visual styling, report data, Replay geometry, metrics, normalization, scoring, or evidence behavior.

## Design contract

- Obsidian and charcoal provide structure.
- Warm near-white carries primary information.
- Gray establishes information hierarchy.
- Restrained gold identifies Entropy, interaction, focus, and Intelligence investigation.
- Semantic combat colors remain authoritative when color communicates actual data.
- Surface luminance and spacing create most panel hierarchy; bright borders and decorative glows do not.
- Gold is never a blanket replacement for combat, profession, boon, condition, status, or chart-series color.

## Current theme architecture

Entropy already has one usable theme pipeline and must continue to use it:

1. `src/theme/defaultTheme.ts` defines the `ENTROPY_THEME` object.
2. `src/theme/ThemeProvider.tsx` writes those values to document-level `--theme-*` CSS variables.
3. `src/Styles/Global.css` supplies matching startup fallbacks and maps the variables into Tailwind theme utilities such as `bg-theme-surface` and `text-theme-muted`.
4. Shared presentation classes in `src/Styles/*.css` style the application shell, navigation, analytical surfaces, Replay workspace, cross-view trail, motion, and Intelligence pulse.
5. Views use a mixture of theme utilities and direct Tailwind/raw color values.

There is no separate user-selectable theme engine in the audited React path. Obsidian Gold should therefore refine the existing primary token set instead of creating a parallel provider or a second CSS-variable namespace.

### Source-of-truth issue

The JavaScript theme object and the CSS startup fallbacks duplicate the palette. They currently agree on the main tokens, but `Global.css` also defines `onAccent`, `onWarning`, and `onDanger` while `defaultTheme.ts` does not. Pass 2 must make the typed theme object complete and keep the CSS fallback synchronized.

### Current decorative workspace system

`Global.css` overrides the global accent for five workspace tones:

- Overview: cyan
- Squad: green
- Performance: warm amber
- Combat Log: rose
- Extras: violet

Those overrides recolor shell chrome, navigation, headings, panel trims, and glows. They are a major source of the current "different app on every page" feeling. Obsidian Gold will remove workspace color as decorative identity. Workspace identity should come from title, icon, navigation position, and content; the shared interaction accent should remain restrained gold.

## Inventory summary

The audit found:

- 494 raw hexadecimal color occurrences across TypeScript, TSX, and CSS.
- 2,243 hard-coded Tailwind color utility occurrences in TypeScript/TSX.
- 208 hexadecimal occurrences in `Global.css` alone.
- The heaviest view-level color debt is in Intelligence, Top Skills, Squad Stats, Replay, import surfaces, Defensive Stats, Fight Breakdown, Overview, Death Recap, Classes, Commander Stats, and Mechanics.

These totals are migration indicators, not search-and-replace targets. Many occurrences are legitimate semantic or data colors.

## Color classification

### 1. Decorative UI colors — consolidate heavily

Examples:

- Workspace-specific cyan/green/amber/rose/violet accent overrides.
- Cyan borders and glows used only to make a panel look technical.
- Amber borders used as general framing rather than warning or selected state.
- Slate and raw near-black values embedded directly in view components.
- Repeated raw table sticky-column backgrounds.
- Decorative gradients and inset side bars on ordinary cards.
- Hard-coded chart tooltip chrome.

Target: centralized surface, text, border, accent, focus, hover, selected, and under-glow tokens.

### 2. Semantic application colors — preserve

- Informational state.
- Success/positive state.
- Warning state.
- Danger/failure state.
- Disabled/unavailable state.

Target: semantic tokens, not gold substitutions. Gold can indicate selection around a semantic state without replacing its meaning.

### 3. Guild Wars 2 profession colors — preserve

Profession chips, icons, and composition marks keep their profession identity where it improves scanning. Profession color must not become a panel-level decorative wash.

### 4. Friendly and enemy colors — preserve

- Friendly/squad: blue.
- Enemy/hostile pressure: red.
- Neutral map and geography: neutral.

Replay participant markers keep these colors. A selected Intelligence participant may receive a restrained gold secondary ring while retaining their actual side color.

### 5. Positive and negative combat states — preserve

- Healing and positive survival information: established green/positive colors.
- Death, danger, failure, and hostile pressure: established red/orange treatment where appropriate.
- Boons and conditions: recognizable icon/source colors.

These meanings take priority over the product accent.

### 6. Chart differentiation — preserve, then tune

The existing `CHART_COLORS` series palette provides blue, sky, orange, red, amber, emerald, rose, teal, and cyan. Multi-series charts need distinct data colors, so this palette should not be converted to gold. Pass 4 should:

- route tooltip surface, border, text, cursor, and focus chrome through theme tokens;
- confirm series colors remain distinguishable on Obsidian surfaces;
- avoid gold as a general series color when gold already means selection or Intelligence focus.

### 7. Intelligence emphasis — migrate to gold

Current Intelligence surfaces rely heavily on sky/cyan, violet, amber, and multi-color decorative treatments. Pass 5 should reserve gold for:

- selected event;
- current evidence;
- active evidence card;
- current Intelligence timestamp/playhead;
- evidence-linked hover/focus;
- Entropy interpretation labels.

Severity, danger, player side, boon, condition, and combat-status colors remain semantic.

### 8. Legacy and compatibility colors — retire carefully

`Global.css` contains a compatibility layer that detects old raw utility classes and remaps their backgrounds, radii, and surfaces. This prevents older views from visually diverging, but it also masks the remaining component-level debt. Passes 3–6 should migrate live components to semantic classes first, then remove only compatibility selectors proven unused by repository search and visual validation.

`src/utils/themeTone.ts` is another legacy bridge: it infers semantic tone by parsing raw Tailwind color names. Keep it during migration, replace call sites with explicit semantic tone props, and remove it only after its consumers are gone.

## Proposed semantic token map

Pass 2 extends the existing provider with a semantic `--entropy-*` token family. This is an additional output of the same typed theme object and provider, not a parallel theme engine. Existing `--theme-*` compatibility tokens remain in place until their component call sites are migrated and verified.

### Structure

- `bg`: deep application environment.
- `canvas`: primary workspace.
- `sidebar`: navigation surface.
- `surface`: ordinary card/panel.
- `surfaceElevated`: selected or raised surface.
- `surfaceInset`: table wells, controls, and recessed regions.

### Hierarchy

- `borderSubtle`: ordinary panel/table separation.
- `border`: interactive/default control edge.
- `borderStrong`: rare structural emphasis, not a gold border alias.
- `text`: warm primary information.
- `textMuted`: secondary information.
- `textFaint`: metadata and tertiary labels.

### Product interaction

- `accent`: restrained Entropy gold.
- `accentStrong`: brighter gold for active/focus states.
- `accentDim`: muted gold for low-emphasis edges.
- `accentSoft`: translucent selected/hover surface.
- `accentFaint`: extremely subtle warm illumination.
- `glow`: low-opacity gold under-light.
- `focus`: accessible keyboard focus color derived from gold and warm white.

### Semantic data

- `info`
- `success`
- `warning`
- `danger`
- `friendly`
- `enemy`
- `healing`
- `barrier`

Profession, boon, condition, and chart-series colors remain in their existing data-specific mappings rather than being folded into the product theme accent.

## Migration map

### Pass 2 — tokens only

- [x] Complete the typed token object, including on-color tokens.
- [x] Add Obsidian surface, hierarchy, gold-soft/faint, focus, friendly/enemy, healing/barrier tokens.
- [x] Synchronize `Global.css` startup fallbacks and Tailwind mappings.
- [x] Keep component behavior and layout unchanged.

### Pass 3 — application shell

- [x] Convert app background, sidebar, selected navigation, search, top bar, common cards, common panel borders, and general shadows.
- [x] Remove five decorative workspace accent overrides.
- [x] Use near-white titles and restrained gold active indicators.
- [x] Replace broad cyan/green/rose/violet shell glow with a low-opacity gold under-light only on selected or focused surfaces.

### Pass 4 — analytical surfaces

- [x] Migrate shared tables, sticky columns, filters, tabs, buttons, metric cards, tooltips, chart chrome, and progressive-disclosure regions.
- [x] Preserve semantic metric and multi-series colors.
- [x] Remove bright borders from ordinary cards.
- [x] Keep selected rows and active tabs on a faint gold-tinted surface, not a solid gold fill.

### Pass 5 — Intelligence

- [x] Associate Entropy interpretation and evidence selection with gold.
- [x] Keep danger/severity, player side, and combat state semantic.
- [x] Apply the signature under-glow only to active evidence/focus states.
- [x] Keep unselected event feeds neutral and visually quiet.

### Pass 6 — Replay chrome

- [x] Change only surrounding UI chrome and presentation tokens.
- [x] Keep map geometry, coordinate transforms, interpolation, marker identity, playback timing, world-space work, evidence computation, and tactical calculations unchanged.
- [x] Preserve blue squad and red enemy markers.
- [x] Use gold only for playhead, selected event/evidence, selected Intelligence investigation, and focus.

### Pass 7 — accessibility and validation

- [x] Check primary, secondary, muted, disabled, hover, selected, focus, tooltip, table, and chart contrast.
- [x] Verify reduced-motion behavior and eliminate decorative continuous animation.
- [x] Verify keyboard focus remains obvious without turning whole controls gold.

### Pass 8 — consistency

- [~] Inspect all major workspaces on desktop and hosted web with representative multi-fight data. The production build and hosted-web shell were inspected; a representative multi-fight report is still required for final visual acceptance across every workspace.
- [x] Verify that remaining theme-layer colors communicate interaction, data, profession, side, status, icon identity, or chart differentiation.
- [x] Retain compatibility selectors only inside the documented migration layer; no second theme provider was introduced.

## Replay guardrail

The Obsidian Gold program must not modify:

- EI Replay-pixel, map, continent, or world-space conversions;
- objective-coordinate validation or projection;
- position interpolation or teleport filtering;
- marker identity or participant classification;
- playback clock or analysis cadence;
- event/evidence selection rules;
- Fight Replay report contracts.

Replay visual work is limited to presentation tokens and chrome until the world-space roadmap is independently accepted.

## Validation gates

After each meaningful implementation slice:

1. TypeScript check.
2. Production build.
3. Full test suite.
4. Changed-file lint where available.
5. Visual inspection with representative data.
6. Reduced-motion, keyboard focus, and contrast check for affected surfaces.
7. Diff review confirming no analytics, parsing, metric, evidence, or Replay coordinate behavior changed.

## Pass 1 conclusion

The existing theme provider is the correct foundation. The main consolidation work is to stop component-level decorative colors and five workspace-specific accent palettes from overriding that foundation. Obsidian Gold should become the primary shared visual identity through centralized semantic tokens, while combat and Guild Wars 2 colors become easier to read because the surrounding application chrome is quieter.
