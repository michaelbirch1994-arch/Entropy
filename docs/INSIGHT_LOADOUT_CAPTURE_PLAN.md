# Insight Loadout Capture: Feasibility and Delivery

Date: 2026-09-13. Track B of INSIGHT_SQUAD_EXECUTION_MASTER_PLAN.md.
Status: researched design, not an implemented acquisition or shipping DLL.

## Decision

Reuse Loadouts only through a supported, permitted interface. Otherwise extend
the existing Entropy companion with opt-in local capture and sharing, subject to
proving a permitted local data source first. A new DLL alone does not establish
access to another player's equipment, traits, or equipped skills.

Do not bypass competitive-mode restrictions, scrape private process structures,
or patch completed original ZEVTC files. Runtime extension records are the
preferred transport; their survival into a single uploaded log must be tested.

## Findings

The supplied de/en/es/fr JSON files are UI translations. loadouts.ini contains
display settings and panel values, not identifiable timestamped builds. Repeated
panel strings are not equipment IDs. English, Spanish, and French include a
competitive-mode-disabled message; this does not reveal which code paths it gates.

The [Loadouts repository](https://github.com/tgk247/ldtrlss) remains binary-only.
No supported build export/interface was located in the inspected documentation.
Its [WvW issue](https://github.com/tgk247/ldtrlss/issues/4) is a reported problem,
not a maintainer-confirmed explanation. See LOADOUTS_LOCAL_AUDIT.md for prior
installed-binary identification; that hash was not reverified in this pass.

The [ArcDPS API](https://www.deltaconnected.com/arcdps/api/README.txt) documents
e9 for extension events and e10 for extension events with skill processing.
This establishes an event-emission interface, not access to loadouts. Confirm
its current ABI, event-field handling and logging behavior before implementation.
Use the [EVTC specification](https://www.deltaconnected.com/arcdps/evtc/README.txt)
for encoding and scoped actor/time binding. Nexus's general
[API](https://github.com/RaidcoreGG/Nexus/wiki/API) does not by itself establish
that Loadouts publishes a resource or event containing builds.

Our existing companion copies combat callbacks into JSONL with bounded queues.
Its README does not claim loadout acquisition, peer sharing, or EVTC emission.
Reuse its lifecycle/loss-accounting infrastructure where appropriate; do not
create a second unrelated collector or assume existing callbacks contain gear.

## Phase 1: Acquisition Gate

Obtain maintainer documentation for local versus ally inspection, especially
WvW; export API/version; per-field coverage; active versus cached/template state;
identity; observation time; change notifications; and integration permission.
No contact has been made by this task.

Build a capability table for profession/spec, selected traits, heal/utilities/
elite, weapon sets, equipment stats, runes, sigils, relic, and infusions. Every
field needs a reproducible local observation before being labeled observed.
Treat skills and equipment as separate capabilities; neither implies the other.

If no permitted live source is available, stop live acquisition work. Offer
explicit participant-declared Builder snapshots instead. Saved templates and
account API snapshots must not masquerade as observed active in-fight state.

Acceptance: one consenting player changes an available field; capture identifies
the player, old/new IDs, observation time, and source version. Repeat in WvW
only where supported. A reduced field set is a partial success, not full capture.

## Phase 2: Snapshot Contract and Offline Tests

Extend the existing companion interchange rather than replacing report parsing.
Snapshots carry schema/source versions, session, game build/mode, scoped actor
identity, observation/effective time, clock uncertainty, sequence, and baseline ID.
Each field distinguishes observed value, explicitly unequipped, unknown, and
participant-declared. Store numeric IDs with namespaces, not translated labels.

Define a complete baseline and validated deltas. A lost delta invalidates affected
state until a new baseline. Reset on reconnect/session changes; weapon swaps do
not imply equipment replacement. Preserve stale/conflicting snapshots visibly.
Test absent fields, malformed IDs, duplicate/conflicting sequences and time order.

## Phase 3: Single-Player EVTC Round Trip

Prototype synthetic framing/decoding first, then emit available local snapshots
through the documented extension interface. Verify a noncolliding signature;
do not reuse the companion's provisional signature as a production allocation.
Define payload version, snapshot ID, fragment index/count, byte length, checksum,
and strict size limits. Checksum proves integrity, not who supplied the values.

Prove baseline availability for each new log, including snapshots observed before
logging begins. Preserve their original observation time; re-emission is not a
new observation. Test callback recursion, logging boundaries and flush timing.
Do not repurpose ordinary damage/skill records to smuggle equipment data.

Acceptance: a second machine reads only the resulting ZEVTC, reconstructs one
complete snapshot and uniquely matches it to the EI player. Test missing parts,
unknown schemas, truncated archives, late joins and other installed extensions.
Run pinned EI with/without extension records and compare original metric totals.
If EI drops the payload, Entropy decodes the original upload separately and joins
verified identity/time evidence without changing the EI metrics pipeline.

If embedding cannot be proven, use an explicit bundle containing untouched log,
manifest and sidecar. Do not label that fallback a self-contained original ZEVTC.

## Phase 4: Opt-In Ally Sharing

Unless a supported remote observation interface is verified, each participating
ally needs a local producer (our companion or compatible supported addon).
A recorder-only install cannot promise full-squad builds.

Use explicit session consent and an authenticated, encrypted sharing channel
whose design is reviewed separately. Scope sessions to consenting participants;
reject replayed, oversized and cross-session messages; rate-limit senders. Do not
collect API keys in logs. Authentication binds a sender, not truthful equipment.

Record sender observation time, receiver time, clock-offset bounds and identity
binding. Remap remote actor identifiers into the recorder's scope; never use
foreign process addresses as local EVTC identities. Reject ambiguous bindings.
Never silently backdate late arrivals as fresh observations.

Acceptance: two clients, one recorder, one output log. Both consenting players'
available snapshots survive a change, disconnect/reconnect and packet loss.
Nonparticipants remain unknown. No disk/network I/O in combat callbacks; retain
bounded queues, visible loss counts and safe unload behavior.

## Phase 5: Raw and Insight Integration

Raw shows inspectable per-player snapshots, changes, source, freshness, missing
fields, and encounter association. Insight uses the same selected fight/time to
resolve valid loadout evidence; unknown or stale fields do not override facts.
Keep observed loadouts, participant declarations and meta assumptions separate.

This improves which skills/traits are plausibly equipped. It does not alone prove
cooldown/charges, resource availability, reach, ability to act or a successful
save. Preserve those separate gates from the refined master plan.

Acceptance: inspect a snapshot from a mechanic event, return to the same replay
moment, and explain exactly which fields support the interpretation. Existing
report totals, Builder, parsing, and no-addon uploads continue to work unchanged.

## Immediate Next Deliverables

1. Maintainer answers and one supported local acquisition demonstration.
2. Offline snapshot/framing fixtures with loss/conflict tests, independent of GW2.
3. Only after acquisition and compatibility gates: controlled in-game prototype.

No installed addon/configuration was changed. No live memory inspection, provider
call, peer connection, extension emission, deployment, or original-log rewrite
was performed during this planning task.

## Player Inspector Prototype Checkpoint

The local Insight player inspector now follows the shared fight/player/time,
offers recorded-skill selection and previous/next cast navigation, and shows
gear/traits as unverified rather than deriving them from casts. It fetches skill
reference facts on selection, with a bounded waiting state and a source link.

Ordinary heal/utility/elite uses can show a base-only recharge scenario from cast
start. Ammo, transforms, flip skills and weapon access are not reconstructed.
Any prior distinct cast gap shorter than reference recharge suspends that scenario
for the selected skill and shows the exact gap. The cause is unresolved; neither
a short gap nor an elapsed reference is proof of availability or successful use.
Future casts do not affect earlier selected moments. No probability is assigned.

This is UI and conditional reference analysis, not completion of the acquisition
gate or native transport. Next native milestone remains a documented permitted
local snapshot source and the offline snapshot/fragment round-trip tests above.

## Offline Transport Checkpoint

`scripts/companion-fragments.mjs` now fragments and reconstructs the existing
validated companion recording format. This partial prototype carries its current
skill-ID loadout events, not gear/trait fields or native EVTC extension records.
The envelope snapshot ID identifies one complete transmitted recording payload;
it is not yet the baseline/delta snapshot protocol described in Phase 2.

Limits: 256 KiB per payload, 1024-byte binary chunks, 256 distinct chunks and at
most 512 received entries including retransmissions. Exact duplicates are accepted;
conflicts, missing parts, cross-session/snapshot identities, invalid metadata,
noncanonical base64 and checksum mismatches are rejected. UTF-8 decoding is strict.
The reassembler reuses parseCompanionRecording before returning any observations.

Nine offline tests pass, including reordered pieces, loss, corruption, duplicates,
identity separation and Unicode preservation. No game files were opened or
changed by these tests. SHA-256 checks integrity, not sender identity or truth.
The supplied session identity must still be authenticated by a future transport;
there is no replay-protection store, peer channel or native extension allocation.

The current recording contract binds to a completed log hash. A future live
extension payload cannot embed its own final log hash without circularity: use
session-scoped event/actor binding in the native payload, and attach the completed
file digest after capture in the external import manifest. Do not emit this
offline envelope unchanged into EVTC or claim the single-log gate has passed.

Next: a field-level gear/trait/skill baseline schema with provenance and unknowns,
then a supported local acquisition demonstration. Native framing/encoding and
two-client sharing remain separately gated; existing metrics and UI are unchanged.

## Field Baseline Prototype

`src/lib/insight/loadoutSnapshot.ts` validates an offline full-field baseline:
equipment item/stat IDs, runes, sigils, relic, specializations, traits, selected
heal/utilities/elite and weapon skill IDs. Each field must explicitly contain
unknown, unequipped, or IDs with collector-observed/player-provided provenance.
Repeated equipment/upgrade IDs are retained. Empty value lists are not silently
treated as unequipped. Unknown sources and schema fields are rejected.

This is a field inventory, not slot-resolved equipment: item and stat arrays must
not be zipped together, and weapon skills do not prove the active weapon set.
Before UI integration, replace these inventory groups with reviewed slot/state
contracts using explicit GW2 item/itemstat/specialization/trait/skill namespaces.
No current or historical build legality is inferred from positive integer IDs.

The point selector checks account/session, clock uncertainty, and an explicit
caller-supplied maximum age. It does not prove continuous state or bind to an EI
fight. Five synthetic tests cover unknowns, declarations, malformed IDs, missing
fields, identity, future observations and stale data. Native acquisition, clock
alignment, transport integration, slot-level schema and change invalidation are
still required. This baseline is not yet accepted by the upload UI or fragment
envelope; both prototypes remain isolated until that contract is reviewed.

## Slot Contract Revision 2

The offline baseline now requires twenty named equipment slots, including both
land weapon sets and aquatic slots. Each slot is unknown, explicitly unequipped,
or an item with independently sourced stat, upgrade and infusion details.
Item references use gw2:item and stat references use gw2:itemstat; swapping these
namespaces is rejected. Repeated items in different slots are allowed. The
upgrade/infusion count limit is a transport bound, not a legality assertion.

This supersedes revision 1's unlinked equipment/stat/upgrade inventories. Revision
1 is rejected, not silently migrated. No production importer consumes either
version yet. Specialization/trait/skill groups remain inventories and still need
slot-specific review before rendering a complete build bar. Equipped weapons
do not establish active set, transformation access or weapon-skill availability.

Eight baseline tests pass. No UI, parsing, native DLL, or upload integration was
changed. Current remaining gates: a permitted acquisition source, validated
session-to-fight binding, change/gap invalidation, and transport round trip for
this revised schema. Do not fill the inspector from synthetic fixtures as if
they were live observations.

## Integrated Offline Loadout Round Trip

The revision-2 baseline is now supported by fragmentLoadout/reassembleLoadout in
`scripts/companion-fragments.mjs`. It reuses bounded framing, integrity checks,
strict decoding and duplicate handling, with a distinct entropy-loadout-fragments
envelope. Existing companion-recording envelopes remain separate and compatible.

The decoder requires expected session, snapshot and account, then verifies those
against the reconstructed payload as well as its headers. Rewriting headers
without changing a valid payload is rejected. This prevents accidental identity
mix-ups but is not authentication against a sender forging both contents and hash.

Five new integration tests plus nine existing transport tests pass. Tests preserve
named weapon slot item/stat associations, unknown upgrades, and player-declared
skills. Missing pieces do not publish partial baselines. The earlier note that
baseline and transport prototypes were disconnected is superseded by this step.

Still unproven: a permitted live acquisition source, native ArcDPS emission,
single-ZEVTC recovery, peer authentication, encounter binding and continuous-state
invalidation. No upload UI or installed DLL was changed. This is a reproducible
offline payload round trip, not the in-game round-trip acceptance milestone.

## Full Baseline Selection and Gap Invalidation

selectLoadoutSnapshot now selects validated full baselines within an explicit
session/account/build/mode and maximum-age policy. It never merges old values
into a newer baseline's unknown fields. Known gaps conservatively invalidate
evidence from before or overlapping the gap; a fresh later baseline can restore
point evidence. Overlapping observation uncertainty, duplicate latest snapshot
identity, and incompatible latest game context return unknown instead of falling
back to older evidence. Verified retransmissions must be deduplicated at import.

Seven new tests plus eight schema tests pass. These tests do not establish real
capture completeness: callers must supply same-clock session gaps, validated
snapshots and verified identity/clock associations. This is full-baseline handling,
not a delta protocol. Freshness remains a declared analysis policy, not proof of
unchanged equipment. The selector is still isolated from production report/UI
consumers until live source and encounter-binding gates pass.
