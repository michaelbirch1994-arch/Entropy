import { describe, expect, it } from "vitest";
import { encodeBuildChatCode, type ChatCodeCatalog } from "../gw2/chatCode";
import { createEmptyBuilder } from "../axiforge/builderModel";

// Decode a produced chat code back into its raw byte sequence so tests can
// assert against byte layouts computed directly from the wiki spec
// (https://wiki.guildwars2.com/wiki/Chat_link_format#Build_template_link),
// independent of any Entropy-side decoder (there isn't one yet -- see
// chatCode.ts's file header for why import is out of scope for this pass).
function decodeToBytes(code: string): number[] {
  expect(code.startsWith("[&")).toBe(true);
  expect(code.endsWith("]")).toBe(true);
  const base64 = code.slice(2, -1);
  return [...Buffer.from(base64, "base64")];
}

function emptyCatalog(): ChatCodeCatalog {
  return { skillPaletteById: new Map(), legendCodeById: new Map() };
}

describe("encodeBuildChatCode", () => {
  it("encodes header, profession, specs/traits, skills, weapon array for a simple build", () => {
    const state = createEmptyBuilder("Guardian");
    state.specializationIds = [9, null, null];
    state.traitChoices = [[1, 1, 1], [0, 0, 0], [0, 0, 0]];
    state.healSkillId = 100;
    state.utilitySkillIds = [200, null, null];
    state.eliteSkillId = 300;
    state.equipment.weapons.mainhand1 = "greatsword";

    const catalog: ChatCodeCatalog = {
      skillPaletteById: new Map([[100, 5], [200, 6], [300, 7]]),
      legendCodeById: new Map(),
    };

    const code = encodeBuildChatCode(state, catalog);
    expect(code).not.toBeNull();
    const bytes = decodeToBytes(code!);

    expect(bytes).toEqual([
      0x0d, 1, // header, Guardian
      9, 0b00010101, // spec 9, trait choices [1,1,1] -> third<<4 | second<<2 | first
      0, 0,
      0, 0,
      5, 0, 0, 0, // heal(100->palette5), aqua heal (none)
      6, 0, 0, 0, // utility1(200->palette6), aqua utility1 (none)
      0, 0, 0, 0, // utility2, aqua utility2 (none)
      0, 0, 0, 0, // utility3, aqua utility3 (none)
      7, 0, 0, 0, // elite(300->palette7), aqua elite (none)
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // profession-specific (unused for Guardian)
      1, 0x32, 0x00, // one weapon: greatsword
      0, // no weapon skill-variant overrides
    ]);
  });

  it("encodes Ranger pets into the profession-specific block", () => {
    const state = createEmptyBuilder("Ranger");
    state.selectedPets = { terrestrial1: 27, terrestrial2: 25, aquatic1: 5, aquatic2: 7 };

    const bytes = decodeToBytes(encodeBuildChatCode(state, emptyCatalog())!);
    const professionSpecific = bytes.slice(8 + 20, 8 + 20 + 16);
    expect(professionSpecific).toEqual([27, 25, 5, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(bytes[1]).toBe(4); // Ranger profession code
  });

  it("encodes Revenant legends via the codec's numeric legend code, not the 'LegendN' id string", () => {
    const state = createEmptyBuilder("Revenant");
    state.selectedLegends = ["Legend3", "Legend6"];

    const catalog: ChatCodeCatalog = {
      skillPaletteById: new Map(),
      legendCodeById: new Map([["Legend3", 5], ["Legend6", 8]]),
    };

    const bytes = decodeToBytes(encodeBuildChatCode(state, catalog)!);
    const professionSpecific = bytes.slice(8 + 20, 8 + 20 + 16);
    expect(professionSpecific).toEqual([5, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(bytes[1]).toBe(9); // Revenant profession code
  });

  it("collapses duplicate weapon-set entries into a unique weapon-id array", () => {
    const state = createEmptyBuilder("Warrior");
    state.equipment.weapons.mainhand1 = "sword";
    state.equipment.weapons.offhand1 = "shield";
    state.equipment.weapons.mainhand2 = "sword";
    state.equipment.weapons.offhand2 = "torch";

    const bytes = decodeToBytes(encodeBuildChatCode(state, emptyCatalog())!);
    const weaponSectionStart = 8 + 20 + 16;
    const weaponCount = bytes[weaponSectionStart];
    expect(weaponCount).toBe(3); // sword, shield, torch (sword de-duplicated)
    const weaponIds = new Set<number>();
    for (let i = 0; i < weaponCount; i++) weaponIds.add(bytes[weaponSectionStart + 1 + i * 2]);
    expect(weaponIds).toEqual(new Set([0x5a, 0x57, 0x66]));
  });

  it("returns null for an unrecognized profession id", () => {
    const state = createEmptyBuilder("NotAProfession");
    expect(encodeBuildChatCode(state, emptyCatalog())).toBeNull();
  });
});
