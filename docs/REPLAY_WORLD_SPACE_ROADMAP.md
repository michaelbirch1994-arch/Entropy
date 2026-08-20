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

## Phase 5 — Expanded Replay workspace

Goal: let Replay use a dedicated, larger tactical workspace without replacing or duplicating the embedded Replay implementation.

Rules:
- Keep the existing embedded Replay available.
- Add an explicit expanded/popout Replay action.
- On desktop, prefer a real Tauri secondary window rather than maintaining a separate browser-only Replay implementation.
- Reuse the same Replay components, data model, evidence rules, and world-space rendering path; do not fork Replay logic.
- Preserve the active fight, playhead timestamp, selected player, and selected Intelligence event when opening the expanded workspace.
- Design the expanded layout around a large tactical map, Tactical State/evidence rail, and persistent timeline/Intelligence track.
- Make the workspace multi-monitor friendly.
- Treat cross-window playback/selection synchronization as optional follow-up behavior; do not make it a prerequisite for the first expanded workspace.
- Do not start this phase until the world-space/map work is stable enough that the larger canvas displays trustworthy battlefield context.

## Out of scope until the world-space phases are stable

- AI-generated spatial explanations
- inferred spawn locations
- inferred objective ownership without trustworthy state data
- predictive positioning advice
- new detector families unrelated to world-space correctness
