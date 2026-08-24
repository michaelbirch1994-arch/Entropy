import { describe, expect, it } from "vitest";
import { decodeBuildChatCode, encodeBuildChatCode, professionFromBuildChatCode, type ChatCodeCatalog } from "../gw2/chatCode";
import { createEmptyBuilder } from "../axiforge/builderModel";

// Decode a produced chat code back into its raw byte sequence so tests can
// assert against byte layouts computed directly from the wiki spec
// (https://wiki.guildwars2.com/wiki/Chat_link_format#Build_template_link),
// independent of the Entropy-side decoder.
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

describe("decodeBuildChatCode", () => {
  it("round-trips profession, traits, skills, underwater skills, pets, and legends", () => {
    const state = createEmptyBuilder("Ranger");
    state.specializationIds = [5, 25, 55];
    state.traitChoices = [[1, 2, 3], [3, 1, 2], [2, 3, 1]];
    state.healSkillId = 101;
    state.utilitySkillIds = [102, 103, 104];
    state.eliteSkillId = 105;
    state.underwaterSkills = { healSkillId: 106, utilitySkillIds: [107, 108, 109], eliteSkillId: 110 };
    state.selectedPets = { terrestrial1: 12, terrestrial2: 13, aquatic1: 14, aquatic2: 15 };
    const palette = new Map(Array.from({ length: 10 }, (_, index) => [101 + index, 201 + index]));
    const code = encodeBuildChatCode(state, { skillPaletteById: palette, legendCodeById: new Map() })!;
    const decoded = decodeBuildChatCode(code, {
      skillIdByPalette: new Map([...palette].map(([skill, paletteId]) => [paletteId, skill])),
      legendIdByCode: new Map(),
    });
    expect(professionFromBuildChatCode(code)).toBe("Ranger");
    expect(decoded.specializationIds).toEqual(state.specializationIds);
    expect(decoded.traitChoices).toEqual(state.traitChoices);
    expect(decoded.healSkillId).toBe(101);
    expect(decoded.utilitySkillIds).toEqual([102, 103, 104]);
    expect(decoded.eliteSkillId).toBe(105);
    expect(decoded.underwaterSkills).toEqual(state.underwaterSkills);
    expect(decoded.selectedPets).toEqual(state.selectedPets);
  });

  it("rejects non-build chat links", () => {
    expect(() => professionFromBuildChatCode("[&AAE=]")).toThrow(/not a GW2 build template/i);
  });
});
