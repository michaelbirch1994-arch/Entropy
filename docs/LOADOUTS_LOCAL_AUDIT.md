# Loadouts: Local Identification and Integration Audit

Inspected 2026-09-12. Read-only file inspection and public release research.
No addon execution, injection, memory inspection, configuration changes, or
communication with the developer was performed.

## Verified Identity

- Supplied folder: `C:/Program Files/Guild Wars 2/addons/Loadouts/`.
- Contains an 818-byte `loadouts.ini` and four translation JSON files.
- Actual binary: `C:/Program Files/Guild Wars 2/addons/loadouts.dll`.
- Binary size: 2,962,944 bytes.
- SHA-256: `44170e57abcb960955f1367998a8314df2271074bd947584c8eb24fb826ed559`.
- Embedded project URL: https://github.com/tgk247/ldtrlss.
- Installed hash and size exactly match the GitHub release asset for
  [2026.8.1.783](https://github.com/tgk247/ldtrlss/releases/tag/2026.8.1.783).
- Asset metadata checked through
  https://api.github.com/repos/tgk247/ldtrlss/releases?per_page=5.

The [project README](https://github.com/tgk247/ldtrlss) explicitly identifies
the repository as binary-only, without source. No reusable source license or
documented data-sharing API was established from the inspected materials.
An embedded release URL is identification evidence, not an integration API.

## Local Files Do Not Contain Captured Builds

The INI contains display/general settings and panel values. It does not expose
identified player loadout records, timestamps, or stable skill/equipment IDs.
Do not interpret the repeated panel strings as gear snapshots without a schema.

English UI labels refer to profession, specialization, traits, weapon sets,
equipment stats, runes, sigils, infusions, relics, and boons. These establish UI
concepts, not that Entropy can acquire the corresponding values.

| Candidate data | Local evidence | Entropy acquisition status |
| --- | --- | --- |
| Profession and specialization | Profession/build labels | Unverified |
| Selected traits | Trait/build labels | Unverified |
| Weapons and equipment stats | Slot/stat labels | Unverified |
| Runes, sigils, relic, infusions | Specific equipment/upgrade labels | Unverified |
| Equipped heal/utility/elite skills | No explicit snapshot/API identified | Unverified |
| Food and utility consumables | No explicit snapshot/API identified | Unverified |
| Timestamped changes and player identity | No export identified | Unverified |

## WvW Is a Material Open Question

The installed `i18n/en.json` contains `ui.options.disabledCompetitive` with
the value "Disabled in competitive mode (PvP/WvW)." Its call sites are unavailable,
so this alone does not establish that every feature, including self-inspection,
is disabled.

An [open issue dated August 22, 2026](https://github.com/tgk247/ldtrlss/issues/4)
reports that Loadouts no longer works in WvW. The inspected issue contains no
maintainer explanation. Treat this as a reported symptom, not a confirmed cause
or statement about ArenaNet policy. Do not bypass the restriction.

## Next Gate

Before implementing a Loadouts-dependent collector, obtain documented answers:

1. Is local-player self-inspection supported in WvW? Which fields are available?
2. Does the addon expose a supported Nexus event, shared resource, callback, or
   snapshot export? Request its schema and interface version.
3. Are values current active state, cached inspection data, or saved templates?
4. What identity, observation timestamp, freshness, and change notification exist?
5. What usage/distribution permission applies to an Entropy integration?
6. Is local-only opt-in combat logging supported without enabling inspection of
   other players or bypassing competitive restrictions?

Then perform a controlled local-player observation before attempting the
loadout-to-combat-log round trip. No reusable acquisition mechanism has yet
been verified. EVTC extension emission and EI compatibility require separate
tests; finding this DLL does not establish either capability.

Insight squad analytics remain independent of this research. If no supported
interface exists, use explicitly user-declared Builder snapshots as annotations
or research a permitted local-only capture path. Neither should be labeled an
observed in-fight loadout until verified.
