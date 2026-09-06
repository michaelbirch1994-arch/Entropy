import { ArrowLeftRight } from "lucide-react";
import {
  resolveProfessionMechanicSlots,
  resolveRangerPetSlots,
  resolveRevenantLegendSlots,
} from "../../lib/gw2/professionMechanics";
import { resolveWeaponSkillSlots, type WeaponSetNumber } from "../../lib/gw2/weaponSkillBar";
import type {
  EntropyBuilderState,
  Gw2Legend,
  Gw2Pet,
  Gw2Profession,
  Gw2Skill,
  Gw2Specialization,
} from "../../types/buildEditor";

interface BuildCombatBarProps {
  builder: EntropyBuilderState;
  profession: Gw2Profession | null;
  specsById: Map<number, Gw2Specialization>;
  skillsById: Map<number, Gw2Skill>;
  legends: Gw2Legend[];
  pets: Gw2Pet[];
  health: number;
  weaponSet: WeaponSetNumber;
  onSwap: () => void;
  onInspect: (skill: Gw2Skill) => void;
  onInspectPet: (pet: Gw2Pet) => void;
}

export default function BuildCombatBar({
  builder,
  profession,
  specsById,
  skillsById,
  legends,
  pets,
  health,
  weaponSet,
  onSwap,
  onInspect,
  onInspectPet,
}: BuildCombatBarProps) {
  const utilityIds = [builder.healSkillId, ...builder.utilitySkillIds, builder.eliteSkillId];
  const utilityLabels = ["Heal", "Utility 1", "Utility 2", "Utility 3", "Elite"];
  const weaponSlots = resolveWeaponSkillSlots(builder, profession, weaponSet, skillsById);
  const mechanicSlots = resolveProfessionMechanicSlots(builder, profession, specsById, skillsById);
  const legendSlots = resolveRevenantLegendSlots(builder, legends, skillsById);
  const petSlots = resolveRangerPetSlots(builder, pets);
  const setLabel = weaponSet === 1 ? "I" : "II";
  const nextSetLabel = weaponSet === 1 ? "II" : "I";
  const mainhand = builder.equipment.weapons[weaponSet === 1 ? "mainhand1" : "mainhand2"];
  const offhand = builder.equipment.weapons[weaponSet === 1 ? "offhand1" : "offhand2"];
  const weaponLabel = [mainhand, offhand].filter(Boolean).join(" + ") || "No weapons equipped";

  return (
    <div className="theme-builder-combat-bar" aria-label={`Combat skill bar, weapon set ${setLabel}`}>
      <div className="theme-builder-combat-group is-utility" aria-label="Healing and utility skills">
        <div className="theme-builder-combat-label"><span>Utility skills</span><small>6–0</small></div>
        <div className="theme-builder-combat-skills">
          {utilityIds.map((id, index) => {
            const skill = id ? skillsById.get(id) : null;
            return (
              <button
                key={`${utilityLabels[index]}-${id ?? "empty"}`}
                type="button"
                className="theme-builder-combat-skill"
                disabled={!skill}
                onClick={() => skill && onInspect(skill)}
                title={skill?.name ?? `${utilityLabels[index]} not selected`}
                aria-label={skill ? `${utilityLabels[index]}: ${skill.name}` : `${utilityLabels[index]} not selected`}
              >
                {skill?.icon ? <img src={skill.icon} alt="" /> : <span>{index + 6 > 9 ? 0 : index + 6}</span>}
                <b>{index + 6 > 9 ? 0 : index + 6}</b>
              </button>
            );
          })}
        </div>
      </div>

      <div className="theme-builder-combat-core">
        {(mechanicSlots.length > 0 || legendSlots.length > 0 || petSlots.length > 0) && (
          <div className="theme-builder-mechanic-skills" aria-label="Profession mechanics">
            {mechanicSlots.map(({ key, skill }) => (
              <button
                key={`${key}-${skill.id}`}
                type="button"
                className="theme-builder-combat-skill is-mechanic"
                onClick={() => onInspect(skill)}
                title={skill.name}
                aria-label={`${key}: ${skill.name}`}
              >
                {skill.icon ? <img src={skill.icon} alt="" /> : <span>{key}</span>}
                <b>{key}</b>
              </button>
            ))}
            {legendSlots.map(({ key, skill }) => (
              <button
                key={key}
                type="button"
                className="theme-builder-combat-skill is-mechanic is-companion"
                disabled={!skill}
                onClick={() => skill && onInspect(skill)}
                title={skill?.name ?? `${key} legend not selected`}
                aria-label={skill ? `${key}: ${skill.name}` : `${key} legend not selected`}
              >
                {skill?.icon ? <img src={skill.icon} alt="" /> : <span>{key}</span>}
                <b>{key}</b>
              </button>
            ))}
            {petSlots.map(({ key, pet }) => (
              <button
                key={key}
                type="button"
                className="theme-builder-combat-skill is-mechanic is-companion"
                disabled={!pet}
                onClick={() => pet && onInspectPet(pet)}
                title={pet?.name ?? `${key} pet not selected`}
                aria-label={pet ? `${key}: ${pet.name}` : `${key} pet not selected`}
              >
                {pet?.icon ? <img src={pet.icon} alt="" /> : <span>{key}</span>}
                <b>{key}</b>
              </button>
            ))}
          </div>
        )}
        <div className="theme-builder-preview-hp" aria-label={`${Math.round(health).toLocaleString()} health`}>
          <strong>{Math.round(health).toLocaleString()}</strong>
          <span>HP</span>
        </div>
        <button type="button" className="theme-builder-weapon-swap" onClick={onSwap} aria-label={`Show weapon set ${nextSetLabel} skills`} title={`Show weapon set ${nextSetLabel}`}>
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          <span>Set {setLabel}</span>
        </button>
      </div>

      <div className="theme-builder-combat-group is-weapon" aria-live="polite">
        <div className="theme-builder-combat-label"><span>Weapon set {setLabel}</span><small>{weaponLabel}</small></div>
        <div className="theme-builder-combat-skills">
          {weaponSlots.map((ref, index) => {
            const skill = ref ? skillsById.get(ref.id) : null;
            const label = skill?.name ?? `Weapon skill ${index + 1} unavailable`;
            return (
              <button
                key={`${weaponSet}-${index}-${ref?.id ?? "empty"}`}
                type="button"
                className="theme-builder-combat-skill is-weapon"
                disabled={!skill}
                onClick={() => skill && onInspect(skill)}
                title={label}
                aria-label={skill ? `Weapon skill ${index + 1}: ${skill.name}` : label}
              >
                {skill?.icon ? <img src={skill.icon} alt="" /> : <span>{index + 1}</span>}
                <b>{index + 1}</b>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
