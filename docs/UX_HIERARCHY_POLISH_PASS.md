# Entropy UX hierarchy polish pass

## Shared root cause

Entropy already exposes the right controls and drill-down destinations, but several high-value surfaces compete visually at the same strength. The report title, utility actions, view filters, summary cards, MVP cards, and dense investigation views all read as peers. That makes a powerful interface feel busier than it needs to and makes some clickable summary surfaces less obviously actionable.

## Smallest compatible implementation

This pass is CSS-only. It does not move, rename, remove, or recalculate any feature. The existing DOM, routes, metrics, report contracts, Intelligence semantics, and Replay behavior remain authoritative.

The polish layer:

- anchors report identity as the primary topbar element;
- groups utility actions into a quieter tray on desktop;
- keeps the first in-view filter strip available while long analytical views scroll;
- strengthens Overview's existing summary -> MVP -> metric drill-down hierarchy;
- makes clickable KDR and metric cards communicate their destination on hover/focus;
- keeps Top Players podium/cards/table visually ordered as quick answer -> investigation -> dense source;
- preserves the prior ultrawide/fullscreen layout behavior;
- preserves reduced-motion handling.

## Affected views and paths

- Shared report topbar and utility actions
- Shared filter strips
- Overview KDR summary strip, MVP cards, and metric cards
- Performance / Top Players podium and player-card grid

No analytics/data paths are changed.

## Regression / validation expectations

CI must pass the existing TypeScript build and test suite. Because this is presentation-only, acceptance is primarily visual and interaction-based:

- 1920x1080 retains the established dense layout;
- 2560/3440/4K workspace expansion remains intact;
- topbar utilities stay scannable rather than visually competing with report identity;
- selected metric/filter state remains obvious;
- long Top Players views retain access to their metric selector while scrolling;
- Overview cards continue to navigate to the same exact destinations as before;
- keyboard focus exposes the same destination cues as pointer hover;
- no metrics, values, aggregation, or player identity behavior changes.
