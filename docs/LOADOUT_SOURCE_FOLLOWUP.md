# Live Loadout Source Follow-Up

Research date: 2026-09-13. Read-only public documentation and local file inventory.

## Outcome

No documented live gear/traits/equipped-skill export was found for Loadouts in
the inspected README or supplied settings/translations. This is not proof that
a private or forthcoming interface does not exist. Maintainer confirmation is
the next dependency for that route; no message has been sent.

Nexus DataLink provides a transport for an addon-published resource, not automatic
access to another addon's private structures. Do not invent a Loadouts resource
identifier or cast an unknown pointer as a build snapshot.

## RTAPI: Useful Identity Evidence, Not Gear

The Commander's Toolkit submodule points to GW2-RealTime-API-Releases. The old
RaidcoreGG URL redirects in GitHub to gwdevcommunity/GW2-RealTime-API-Releases.
Inspected commit: dbc89dde86fb8846fec4ce45667e79d7df0afb06.

Primary sources:
- [Pinned RTAPI header](https://github.com/gwdevcommunity/GW2-RealTime-API-Releases/blob/dbc89dde86fb8846fec4ce45667e79d7df0afb06/RTAPI.h)
- [RTAPI usage](https://github.com/gwdevcommunity/GW2-RealTime-API-Releases)
- [Nexus DataLink](https://github.com/RaidcoreGG/Nexus/wiki/API#datalink)
- [Loadouts project](https://github.com/tgk247/ldtrlss)

The public GroupMember structure includes account/character, subgroup, profession,
third-specialization ID, and self/instance/commander/lieutenant flags. The third
specialization is not necessarily an elite specialization. Zero profession/spec
values can mean unknown. RealTimeData provides local player and instance data.
Neither inspected structure includes equipment, selected traits or equipped skills.

The documented DL_RTAPI resource and group join/leave/update events offer a
candidate path for better matching and membership observations. An integration
must handle addon unload and stale data; documented GameBuild zero is an unload
signal. Runtime verification, clock mapping and snapshot consistency are not yet
established. Do not describe these declarations as successfully collected data.

The filename-only scan of the immediate addons directory found loadouts.dll but
no filename containing rtapi/realtime. This does not establish that RTAPI cannot
be loaded under another filename or path. No DLL was installed or executed.

## Maintainer Inquiry Draft (Not Sent)

We are building Entropy, a post-combat GW2 log-analysis application. We would like
to integrate Loadouts through a supported interface rather than inspect private
memory or bypass competitive-mode restrictions.

Does Loadouts expose a documented Nexus DataLink resource, event, callback or
export for active equipment, selected traits and equipped skills? If so, could
you provide the interface version, schema and integration/distribution terms?

We particularly need to know which fields are available for the local player
and consenting allies in WvW, whether those are current or cached observations,
and how identity, observation time, updates and unload invalidation are handled.
If remote inspection is unavailable, is a local-only opt-in capture integration
supported? We can leave unavailable fields unknown and use participant sharing
only where a supported local acquisition path exists.

Our intended use is recording evidence for review after a fight. Would emitting
supported snapshots through ArcDPS extension records be an acceptable integration,
and are there restrictions we should preserve? We are not requesting offsets,
restriction bypasses, or private game-memory access.

## Next Decision

1. If documented export is supplied: review ABI/lifetime/field semantics and test
   one consenting local player before squad sharing or log emission.
2. If no export: pursue a maintainer-supported local producer, or explicitly
   declared Builder data. Do not relabel declarations as observed active gear.
3. RTAPI identity integration can be researched independently, but does not unblock
   equipment acquisition by itself. Keep the existing metrics/parser unchanged.

The offline schema, fragmentation and selection tests are preparation only.
Further schema additions do not resolve this acquisition dependency.
