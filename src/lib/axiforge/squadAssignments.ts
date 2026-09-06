import type { BuilderParty } from "../../types/buildEditor";

export type SquadSlotLocation = {
  partyId: string;
  slotIndex: number;
};

export function moveSquadAssignment(
  parties: BuilderParty[],
  source: SquadSlotLocation,
  target: SquadSlotLocation,
): BuilderParty[] {
  if (source.partyId === target.partyId && source.slotIndex === target.slotIndex) return parties;

  const sourceParty = parties.find((party) => party.id === source.partyId);
  const targetParty = parties.find((party) => party.id === target.partyId);
  const sourceBuildId = sourceParty?.slots[source.slotIndex];
  if (!sourceParty || !targetParty || !sourceBuildId || target.slotIndex < 0 || target.slotIndex >= targetParty.slots.length) {
    return parties;
  }

  const targetBuildId = targetParty.slots[target.slotIndex] ?? null;
  return parties.map((party) => {
    if (party.id !== source.partyId && party.id !== target.partyId) return party;
    const slots = [...party.slots];
    if (party.id === source.partyId) slots[source.slotIndex] = targetBuildId;
    if (party.id === target.partyId) slots[target.slotIndex] = sourceBuildId;
    return { ...party, slots };
  });
}
