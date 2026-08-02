# Third-Party Notices

Entropy includes code and assets adapted from the following third-party projects.

## Profession / elite-specialization icons

`src/data/professionIcons.ts` contains SVG path data derived from the outline
silhouette artwork in:

- Project: [gw2-specialization-icons](https://github.com/brybrant/gw2-specialization-icons)
- Author: brybrant ("Vector recreations of the Guild Wars 2 specialization
  icons made by Matt Bryant")
- License: GNU General Public License v3.0 (GPL-3.0), same as Entropy's own
  license

The original project renders each icon as a multi-layer SolidJS component
(gradient fills, strokes, clip-paths). Entropy extracts just the single
"outline" silhouette path per profession/specialization and renders it as a
flat, single-color icon via `src/components/ui/ProfessionIcon.tsx` - a
simplification suited to small badge/chip usage, not a redistribution of the
full shaded artwork.
