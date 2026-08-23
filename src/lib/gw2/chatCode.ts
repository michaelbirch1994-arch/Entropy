// GW2 in-game chat-code (build template, header byte 0x0D) EXPORT-only encoder.
//
// Spec: https://wiki.guildwars2.com/wiki/Chat_link_format#Build_template_link
// (read and verified live before writing this — every byte offset, bit
// layout, and worked example below traces back to that page).
//
// Scope, deliberately narrow (see shareable-builder-plan.md Phase D):
// - Export only. Entropy build -> chat code. Decoding a chat code back into
//   a build is a separate, harder problem (chat codes use internal "skill
//   palette" ids resolvable only via a live GW2 API profession-detail call,
//   not the API skill ids Entropy stores) and is out of scope for this pass.
// - Chat codes carry build info (profession, specs/traits, skills, pets/
//   legends) losslessly, but NOT gear/rune/sigil/stat detail at all — that
//   is AxiCode's job (see axiForgeAdapter.ts). Do not treat this as a
//   replacement for AxiCode; it is the second, GW2-native export format the
//   reference site (AxiForge) also offers alongside its own build code.
// - Pure function: the caller supplies pre-resolved skill-palette and
//   legend-code lookups (mirroring how buildAxiShape takes pre-resolved
//   specsById/traitsBySpecId/skillsById maps rather than fetching itself).

import type { EntropyBuilderState } from "../../types/buildEditor";

export const CHAT_CODE_PROFESSION_IDS: Record<string, number> = {
  Guardian: 1,
  Warrior: 2,
  Engineer: 3,
  Ranger: 4,
  Thief: 5,
  Elementalist: 6,
  Mesmer: 7,
  Necromancer: 8,
  Revenant: 9,
};

// Land-weapon type ids used by the "selected weapons" array appended to
// build codes since the Weaponmaster Training update (wiki's documented
// table). Underwater weapons (spear/trident/harpoon) have no documented id
// and are omitted — Entropy is WvW-focused, so this is a non-issue.
export const CHAT_CODE_WEAPON_IDS: Record<string, number> = {
  axe: 0x05,
  longbow: 0x23,
  dagger: 0x2f,
  focus: 0x31,
  greatsword: 0x32,
  hammer: 0x33,
  mace: 0x35,
  pistol: 0x36,
  rifle: 0x55,
  scepter: 0x56,
  shield: 0x57,
  staff: 0x59,
  sword: 0x5a,
  torch: 0x66,
  warhorn: 0x67,
  shortbow: 0x6b,
};

export interface ChatCodeCatalog {
  /** Entropy/API skill id (e.g. 14402) -> internal skill "palette" id used by chat codes. */
  skillPaletteById: Map<number, number>;
  /** Revenant legend id ("Legend1".."Legend7") -> /v2/legends' numeric `code` field. */
  legendCodeById: Map<string, number>;
}

function paletteBytes(skillId: number | null, catalog: ChatCodeCatalog): [number, number] {
  const palette = skillId ? catalog.skillPaletteById.get(skillId) ?? 0 : 0;
  return [palette & 0xff, (palette >> 8) & 0xff];
}

function traitChoiceByte(row: readonly [number, number, number]): number {
  const [first, second, third] = row.map((value) => Math.max(0, Math.min(3, value)));
  return ((third & 0x3) << 4) | ((second & 0x3) << 2) | (first & 0x3);
}

function toBase64(bytes: number[]): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === "function") return btoa(binary);
  // Non-browser fallback (Node test environment).
  return Buffer.from(binary, "binary").toString("base64");
}

/**
 * Encode an Entropy build into a GW2 in-game chat code, e.g. `[&DQg1...]`.
 * Returns null if the build's profession isn't one of the nine playable
 * professions (should never happen for a real build, but the function
 * stays total rather than throwing).
 */
export function encodeBuildChatCode(builder: EntropyBuilderState, catalog: ChatCodeCatalog): string | null {
  const professionCode = CHAT_CODE_PROFESSION_IDS[builder.professionId];
  if (!professionCode) return null;

  const bytes: number[] = [0x0d, professionCode];

  for (let track = 0; track < 3; track++) {
    const specId = builder.specializationIds[track] ?? 0;
    bytes.push(specId & 0xff);
    bytes.push(specId ? traitChoiceByte(builder.traitChoices[track]) : 0);
  }

  const skillSlots: Array<number | null> = [
    builder.healSkillId,
    builder.underwaterSkills.healSkillId,
    builder.utilitySkillIds[0],
    builder.underwaterSkills.utilitySkillIds[0],
    builder.utilitySkillIds[1],
    builder.underwaterSkills.utilitySkillIds[1],
    builder.utilitySkillIds[2],
    builder.underwaterSkills.utilitySkillIds[2],
    builder.eliteSkillId,
    builder.underwaterSkills.eliteSkillId,
  ];
  for (const skillId of skillSlots) bytes.push(...paletteBytes(skillId, catalog));

  const professionSpecific = new Array<number>(16).fill(0);
  if (builder.professionId === "Ranger") {
    professionSpecific[0] = builder.selectedPets.terrestrial1 & 0xff;
    professionSpecific[1] = builder.selectedPets.terrestrial2 & 0xff;
    professionSpecific[2] = builder.selectedPets.aquatic1 & 0xff;
    professionSpecific[3] = builder.selectedPets.aquatic2 & 0xff;
  } else if (builder.professionId === "Revenant") {
    const legendCode = (legendId: string) => (legendId ? catalog.legendCodeById.get(legendId) ?? 0 : 0);
    professionSpecific[0] = legendCode(builder.selectedLegends[0]);
    professionSpecific[1] = legendCode(builder.selectedLegends[1]);
    professionSpecific[2] = legendCode(builder.selectedUnderwaterLegends[0]);
    professionSpecific[3] = legendCode(builder.selectedUnderwaterLegends[1]);
    // Bytes 4-15 (inactive-legend utility skills, 2 bytes x 6) stay 0:
    // Entropy doesn't track per-legend utility loadouts independently today.
  }
  bytes.push(...professionSpecific);

  const weaponIds = new Set<number>();
  for (const weapon of [
    builder.equipment.weapons.mainhand1,
    builder.equipment.weapons.offhand1,
    builder.equipment.weapons.mainhand2,
    builder.equipment.weapons.offhand2,
  ]) {
    const id = weapon ? CHAT_CODE_WEAPON_IDS[weapon] : undefined;
    if (id !== undefined) weaponIds.add(id);
  }
  bytes.push(weaponIds.size);
  for (const id of weaponIds) bytes.push(id & 0xff, 0x00);

  // Weapon skill-variant overrides (Weaponmaster Training): Entropy doesn't
  // track per-weapon skill-variant selection yet, so always zero of them.
  bytes.push(0);

  return `[&${toBase64(bytes)}]`;
}
