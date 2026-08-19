# Entropy v0.2.59

## Intelligence nervous-system groundwork

- Intelligence Critical Events are directly inspectable in-tab with a bounded ±15 second forensic window.
- Nearby same-fight Critical Events are shown as temporal context without being mislabeled as causal.
- Existing engagement windows, findings, player identities, and evidence ids are linked into the selected event inspector.
- Intelligence cards use a very faint breathing underglow confined to the Intelligence tab, with reduced-motion support.
- Existing Death Recap packets can now be surfaced inside the selected Intelligence event window without duplicating Death Recap calculations.
- Death Recap evidence stays scoped to the exact fight and timestamp window; exact linked-player matches are distinguished from nearby temporal context.

## Top Skills groundwork

- Added deterministic ranked per-fight extreme helpers with regression coverage for ranking, ties, invalid data, and configurable limits.

## Release principle

Entropy's existing metric tables and detailed viewer remain authoritative. Intelligence connects and investigates existing evidence rather than replacing or recreating core analytics.
