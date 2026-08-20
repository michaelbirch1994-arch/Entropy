# Replay World-Space Correctness Roadmap

This roadmap is deliberately sequential. Each phase must be implemented, tested, reviewed, and merged before the next phase begins.

## Phase 1 — Death / release separation correctness

Goal: dead or released players must never generate squad-separation events.

Rules:
- A valid separation that fully meets the normal duration threshold before death may still be emitted.
- Death immediately terminates the active separation run.
- While dead/released, distance from commander is ignored for squad-separation detection.
- Respawn does not automatically restore eligibility.
- The player must re-establish formation near commander before a later separation can be emitted.
- No arbitrary post-death timeout is used.

## Phase 2 — Replay teleport / respawn discontinuities

Goal: Replay must never visually interpolate a player from their death location to a later spawn/teleport location.

Rules:
- Dead intervals are explicit movement discontinuities.
- Large unproven position jumps are never rendered as continuous travel.
- Missing position coverage remains unknown rather than inventing a path or spawn point.
- No change to combat-event timing or evidence semantics.

## Phase 3 — WvW world-space foundation

Goal: prove a trustworthy mapping between EI replay coordinates and Guild Wars 2 WvW map coordinates.

Rules:
- Persist MapID where available.
- Persist WvW map/objective metadata where the EI source actually supplies it.
- Build and test coordinate transforms before rendering new objective overlays.
- Do not infer map identity or objective locations from fight text/name alone.
- Retain EI replay imagery as a fallback.

## Phase 4 — High-resolution WvW map + objectives

Goal: improve map fidelity and add verified WvW battlefield context.

Rules:
- Use higher-resolution WvW map imagery/tiles only after Phase 3 transform validation.
- Add only real, verified camps/towers/keeps/castle/spawn objectives.
- Apply documented coordinate corrections only where a source-backed exception is known.
- Do not create fight-location narrative until objective/map placement is verified.

## Out of scope until all four phases are stable

- AI-generated spatial explanations
- inferred spawn locations
- inferred objective ownership without trustworthy state data
- predictive positioning advice
- new detector families unrelated to world-space correctness
