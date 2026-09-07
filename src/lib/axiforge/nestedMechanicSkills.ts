import type { EntropyBuilderState, Gw2ApiFact, Gw2Skill } from "../../types/buildEditor";

const FIREBRAND_SPECIALIZATION_ID = 62;
const REAPER_SPECIALIZATION_ID = 34;
const TEMPEST_SPECIALIZATION_ID = 48;

const API_NESTED_SKILL_IDS: Record<number, number[]> = {
  [REAPER_SPECIALIZATION_ID]: [29442, 29458, 30278, 30825, 29958, 30504, 30557],
  [TEMPEST_SPECIALIZATION_ID]: [29706, 29415, 29719, 29618],
};

const EFFECT_ICONS: Record<string, string> = {
  Aegis: "https://render.guildwars2.com/file/DFB4D1B50AE4D6A275B349E15B179261EE3EB0AF/102854.png",
  Bleeding: "https://wiki.guildwars2.com/images/3/33/Bleeding.png",
  Burning: "https://render.guildwars2.com/file/B47BF5803FED2718D7474EAF9617629AD068EE10/102849.png",
  Might: "https://render.guildwars2.com/file/2FA9DF9D6BC17839BBEA14723F1C53D645DDB5E1/102852.png",
  Protection: "https://render.guildwars2.com/file/CD77D1FAB7B270223538A8F8ECDA1CFB044D65F4/102834.png",
  Regeneration: "https://render.guildwars2.com/file/D5F6EBC4630EFA96015B5AF24FB9F98F78170434/102833.png",
  Resistance: "https://render.guildwars2.com/file/50BAC1B8E10CFAB9E749A5D910D4A9DCF29EBB7C/961398.png",
  Resolution: "https://render.guildwars2.com/file/D104A6B9344A2E2096424A3C300E46BC2926E4D7/2440718.png",
  Stability: "https://render.guildwars2.com/file/1A452A6A6C703A909E7A534F43E085CD68D3042A/102853.png",
  Swiftness: "https://render.guildwars2.com/file/E3011BD266F50D15943D932FA272F4539B7DBB2D/102841.png",
  Taunt: "https://wiki.guildwars2.com/images/7/79/Taunt.png",
  Vigor: "https://render.guildwars2.com/file/17D4A8B0B23B5C7E16A2F056718D43842C0B0D02/102840.png",
  Vulnerability: "https://wiki.guildwars2.com/images/a/aa/Vulnerability.png",
  Weakness: "https://wiki.guildwars2.com/images/f/f4/Weakness.png",
};

function buff(status: string, duration: number, applyCount = 1): Gw2ApiFact {
  return { type: "Buff", status, duration, apply_count: applyCount, icon: EFFECT_ICONS[status] };
}

function recharge(value: number): Gw2ApiFact {
  return { type: "Recharge", text: "Recharge", value };
}

function fact(type: string, text: string, value?: number): Gw2ApiFact {
  return { type, text, value };
}

function tomeSkill(
  id: number,
  name: string,
  description: string,
  facts: Gw2ApiFact[],
): Gw2Skill {
  const iconFile = `${name.replace(":", "-").replaceAll(" ", "_")}.png`;
  return {
    id,
    name,
    description,
    facts,
    icon: `https://wiki.guildwars2.com/wiki/Special:Redirect/file/${iconFile}`,
    professions: ["Guardian"],
    specialization: FIREBRAND_SPECIALIZATION_ID,
    slot: "Profession",
    type: "Bundle",
  };
}

// Firebrand tome chapters are intentionally absent from /v2/skills. Keep the
// WvW split here so nested mechanic effects can participate in squad analysis.
const FIREBRAND_TOME_SKILLS: Gw2Skill[] = [
  tomeSkill(41258, "Chapter 1: Searing Spell", "Incite heat before you, burning and making foes vulnerable.", [
    buff("Burning", 2.5), buff("Vulnerability", 6, 2),
  ]),
  tomeSkill(40635, "Chapter 2: Igniting Burst", "Ignite the air around you, burning and weakening nearby foes.", [
    buff("Burning", 5), buff("Weakness", 2), recharge(8),
  ]),
  tomeSkill(42449, "Chapter 3: Heated Rebuke", "Call forth a heated vortex that pulls enemies together.", [
    fact("DefianceBreak", "Defiance Break", 150), recharge(10),
  ]),
  tomeSkill(40015, "Chapter 4: Scorched Aftermath", "Create a fire field that bleeds and burns foes over several pulses.", [
    buff("Bleeding", 2), buff("Burning", 2), recharge(15),
  ]),
  tomeSkill(42898, "Epilogue: Ashes of the Just", "Grant nearby allies might and searing blades that burn enemies.", [
    buff("Burning", 3), buff("Might", 8, 5), recharge(20),
  ]),
  tomeSkill(45022, "Chapter 1: Desert Bloom", "Create a wave of healing for allies before you.", [
    fact("AttributeAdjust", "Healing", 564),
  ]),
  tomeSkill(40679, "Chapter 2: Radiant Recovery", "Cleanse conditions on nearby allies and heal for each condition removed.", [
    fact("AttributeAdjust", "Healing", 388), fact("Number", "Conditions Removed", 2), recharge(4),
  ]),
  tomeSkill(45128, "Chapter 3: Azure Sun", "Heal and grant vigor, regeneration, and swiftness to nearby allies.", [
    fact("AttributeAdjust", "Healing", 1450), buff("Vigor", 5), buff("Regeneration", 6), buff("Swiftness", 5), recharge(8),
  ]),
  tomeSkill(42008, "Chapter 4: Shining River", "Heal allies and grant them swiftness in a pulsing water field.", [
    fact("AttributeAdjust", "Healing", 287), buff("Swiftness", 4), recharge(10),
  ]),
  tomeSkill(42925, "Epilogue: Eternal Oasis", "Convert conditions on nearby allies into boons and increase healing received.", [
    fact("Number", "Conditions Converted to Boons", 5), recharge(20),
  ]),
  tomeSkill(42986, "Chapter 1: Unflinching Charge", "Grant protection and swiftness to allies before you.", [
    buff("Protection", 1.5), buff("Swiftness", 6),
  ]),
  tomeSkill(41968, "Chapter 2: Daring Challenge", "Taunt nearby enemies and gain resolution.", [
    buff("Taunt", 1), buff("Resolution", 3), recharge(4),
  ]),
  tomeSkill(41836, "Chapter 3: Valiant Bulwark", "Manifest a shimmering area that reflects enemy missiles.", [
    fact("NoData", "Reflects Missiles"), recharge(15),
  ]),
  tomeSkill(40988, "Chapter 4: Stalwart Stand", "Break stuns and grant resistance to allies in a pulsing light field.", [
    buff("Resistance", 3), fact("NoData", "Breaks Stun"), recharge(20),
  ]),
  tomeSkill(44455, "Epilogue: Unbroken Lines", "Grant nearby allies aegis, protection, stability, and formidable defenses.", [
    buff("Aegis", 4), buff("Protection", 5), buff("Stability", 5), recharge(25),
  ]),
];

export function nestedMechanicSkillIds(state: EntropyBuilderState): number[] {
  return state.specializationIds.flatMap((specializationId) => (
    specializationId ? API_NESTED_SKILL_IDS[specializationId] ?? [] : []
  ));
}

export function resolveNestedMechanicSkills(
  state: EntropyBuilderState,
  skillsById: Map<number, Gw2Skill> = new Map(),
): Gw2Skill[] {
  const apiSkills = nestedMechanicSkillIds(state)
    .map((id) => skillsById.get(id))
    .filter((skill): skill is Gw2Skill => Boolean(skill));
  const curatedSkills = state.professionId === "Guardian"
    && state.specializationIds.includes(FIREBRAND_SPECIALIZATION_ID)
    ? FIREBRAND_TOME_SKILLS
    : [];
  return [...apiSkills, ...curatedSkills];
}
