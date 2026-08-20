# Ultrawide / 4K layout pass

## Root cause
The report workspace was capped by `.theme-content { width: min(100%, 112rem); }`, so large and ultrawide displays stopped gaining usable analytical space once the content area reached roughly 1792px. Fullscreen therefore looked like a centered desktop-sized application with large empty margins.

## Implementation
- Preserve the existing 1080p layout unchanged.
- At 1920px and above, progressively relax the report workspace width cap and use controlled responsive gutters.
- Keep typography and icons at their native sizes; no transform-based scaling is used.
- Expand Top Players cards from the existing desktop grid to 4, 5, 6, then 7 columns as real workspace width becomes available.
- Let table and chart shells consume the available analytical width.

## Acceptance criteria
- 1920x1080 retains the established dense Entropy layout.
- 2560x1440 uses materially more horizontal space.
- 3440x1440 / 3840x1600 no longer resemble a narrow centered application inside a fullscreen window.
- 4K and 5K-class widths gain additional cards without making individual cards unreadably narrow.
- No global transform/zoom scaling is introduced.
