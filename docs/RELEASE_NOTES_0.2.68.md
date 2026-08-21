# Entropy v0.2.68

## Royal black-and-gold product finish

This release completes the next visual pass for Entropy's command intake and player-facing analytics surfaces while preserving every underlying combat metric.

### Cinematic landing experience

- The empty-state command intake now uses a richer obsidian-and-gold composition with warm ivory typography.
- A restrained orbital/astrolabe motif and subtle circuit detailing give the landing page clearer structure and a stronger Entropy identity.
- Gold illumination is concentrated around the upload workflow and primary interactions rather than spread across the full interface.

### Player and MVP presentation

- Player cards, podium cards, and Overview MVP cards now have more defined surface separation and a controlled gold backglow.
- Gold remains an interaction and product accent; profession, friendly/enemy, healing, damage, boon, condition, and chart colors retain their semantic meaning.
- Mobile and desktop layouts keep the same information and interaction behavior.

### Scope and verification

- Presentation-only change: no report parsing, normalization, combat formulas, Intelligence evidence generation, or Fight Replay behavior changed.
- Production build passed.
- Full test suite passed: 56 files and 357 tests.
- Lint passed with only existing warnings.
- Desktop and 390px visual checks passed without horizontal overflow.
