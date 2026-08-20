# Entropy v0.2.61

## Large-display and fullscreen polish

- Entropy now uses the available workspace much more effectively on 1440p, ultrawide, 4K, and 4K-ultrawide displays instead of stopping at the old fixed content ceiling.
- Top Players and other dense analytical surfaces expand more intelligently across wide monitors while preserving the established 1080p experience.
- No global CSS scaling tricks were introduced, keeping text and icons sharp at native resolution.

## UX hierarchy and navigation polish

- The report header now gives report identity more visual priority while utility controls sit in a quieter desktop tray.
- Long analytical views keep their primary filter strip available while scrolling.
- Overview more clearly communicates its summary -> MVP -> metric drill-down flow without changing destinations or metrics.
- Interactive cards use more consistent hover, focus, and press states, while reduced-motion preferences remain respected.
- Contextual drill-downs now preserve a lightweight return trail so users can see where they came from and jump back without reconstructing their path.

## Dense table readability

- Leaderboards now use stronger headers, cleaner row separation, subtle alternating rows, tabular numeric alignment, and restrained top-three rank accents.
- Wide-display column sizing is improved for metric, sample, and share columns.
- Sample reliability terminology is now consistently Strong / Moderate / Low; the underlying thresholds and calculations are unchanged.
- Table accessibility is improved with semantic column scopes and clearer progress-bar labels.

## Intelligence evidence continuity

- Intelligence linked-player evidence gained a normalized exact-time state adapter for boons, conditions, and condition-backed control effects using the existing verified Replay inspection path.
- Evidence states continue to distinguish observed control, no condition-control observed, and unavailable timestamp state rather than overclaiming unsupported hard-CC conclusions.
- Intelligence remains additive: it connects evidence across Entropy without replacing the authoritative core viewer.

## Release principle

v0.2.61 is primarily a product-quality release: fuller use of large displays, clearer hierarchy, better dense-data scanning, and stronger continuity between existing views while preserving Entropy's metrics, report contracts, Replay calculations, and source-data limits.
