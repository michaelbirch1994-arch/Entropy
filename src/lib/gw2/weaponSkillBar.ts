import type {
  EntropyBuilderState,
  Gw2Profession,
  Gw2ProfessionWeapon,
  Gw2ProfessionWeaponSkillRef,
  Gw2Skill,
} from "../../types/buildEditor";

export type WeaponSetNumber = 1 | 2;
export type WeaponSkillSlots = [
  Gw2ProfessionWeaponSkillRef | null,
  Gw2ProfessionWeaponSkillRef | null,
  Gw2ProfessionWeaponSkillRef | null,
  Gw2ProfessionWeaponSkillRef | null,
  Gw2ProfessionWeaponSkillRef | null,
];

function weaponDefinition(profession: Gw2Profession | null, name: string): Gw2ProfessionWeapon | null {
  if (!name) return null;
  const entry = Object.entries(profession?.weapons ?? {}).find(([weaponName]) => weaponName.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? null;
}

function slotNumber(ref: Gw2ProfessionWeaponSkillRef): number | null {
  const match = /^Weapon_([1-5])$/.exec(ref.slot);
  return match ? Number(match[1]) : null;
}

function chooseSkill(
  refs: Gw2ProfessionWeaponSkillRef[],
  slot: number,
  offhandName: string,
  attunement: string,
  secondaryAttunement: string,
  activeSpecs: Set<number>,
  skillsById?: Map<number, Gw2Skill>,
): Gw2ProfessionWeaponSkillRef | null {
  const normalizedOffhand = offhandName.trim().toLowerCase();
  const normalizedAttunement = attunement.trim().toLowerCase();
  const normalizedSecondaryAttunement = secondaryAttunement.trim().toLowerCase();
  const candidates = refs.filter((ref) => {
    const skill = skillsById?.get(ref.id);
    if (slotNumber(ref) !== slot) return false;
    if (ref.offhand) {
      const requiredOffhand = ref.offhand.toLowerCase();
      if (requiredOffhand === "nothing" ? Boolean(normalizedOffhand) : requiredOffhand !== normalizedOffhand) return false;
    }
    const skillAttunement = ref.attunement ?? skill?.attunement;
    if (skillAttunement && normalizedAttunement && skillAttunement.toLowerCase() !== normalizedAttunement) return false;
    if (skill?.specialization && !activeSpecs.has(skill.specialization)) return false;
    if (skill?.dual_attunement && skill.dual_attunement.toLowerCase() !== normalizedSecondaryAttunement) return false;
    return true;
  });

  return candidates.sort((left, right) => {
    const leftSkill = skillsById?.get(left.id);
    const rightSkill = skillsById?.get(right.id);
    const leftScore = Number(Boolean(left.offhand)) * 8 + Number(Boolean(leftSkill?.specialization)) * 4 + Number(Boolean(leftSkill?.dual_attunement)) * 2 + Number(Boolean(left.attunement ?? leftSkill?.attunement));
    const rightScore = Number(Boolean(right.offhand)) * 8 + Number(Boolean(rightSkill?.specialization)) * 4 + Number(Boolean(rightSkill?.dual_attunement)) * 2 + Number(Boolean(right.attunement ?? rightSkill?.attunement));
    return rightScore - leftScore;
  })[0] ?? null;
}

export function resolveWeaponSkillSlots(
  builder: EntropyBuilderState,
  profession: Gw2Profession | null,
  weaponSet: WeaponSetNumber,
  skillsById?: Map<number, Gw2Skill>,
): WeaponSkillSlots {
  const mainhandName = builder.equipment.weapons[weaponSet === 1 ? "mainhand1" : "mainhand2"];
  const offhandName = builder.equipment.weapons[weaponSet === 1 ? "offhand1" : "offhand2"];
  const mainhand = weaponDefinition(profession, mainhandName);
  const offhand = weaponDefinition(profession, offhandName);
  const activeSpecs = new Set(builder.specializationIds.filter((id): id is number => id !== null));
  const mainhandAvailable = mainhand && (!mainhand.specialization || activeSpecs.has(mainhand.specialization)) ? mainhand : null;
  const offhandAvailable = offhand && (!offhand.specialization || activeSpecs.has(offhand.specialization)) ? offhand : null;
  const isTwoHanded = Boolean(mainhandAvailable?.flags?.includes("TwoHand"));
  const attunement = builder.activeAttunement;
  const slots: WeaponSkillSlots = [null, null, null, null, null];

  for (let slot = 1; slot <= 5; slot += 1) {
    const source = slot <= 3 || isTwoHanded ? mainhandAvailable : offhandAvailable;
    if (!source?.skills) continue;
    slots[slot - 1] = chooseSkill(source.skills, slot, offhandName, attunement, builder.activeAttunement2, activeSpecs, skillsById);
  }

  return slots;
}

export function weaponSkillIds(profession: Gw2Profession | null): number[] {
  return [...new Set(Object.values(profession?.weapons ?? {}).flatMap((weapon) => weapon.skills?.map((skill) => skill.id) ?? []))];
}
