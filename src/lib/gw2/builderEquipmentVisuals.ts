const GW2_WIKI_FILE = "https://wiki.guildwars2.com/wiki/Special:Redirect/file";

export const BUILDER_ARMOR_SLOT_ICONS: Record<string, string> = {
  head: `${GW2_WIKI_FILE}/Head_slot.png`,
  shoulders: `${GW2_WIKI_FILE}/Shoulder_slot.png`,
  chest: `${GW2_WIKI_FILE}/Chest_slot.png`,
  hands: `${GW2_WIKI_FILE}/Hand_slot.png`,
  legs: `${GW2_WIKI_FILE}/Leg_slot.png`,
  feet: `${GW2_WIKI_FILE}/Feet_slot.png`,
};

export const BUILDER_TRINKET_SLOT_ICONS: Record<string, string> = {
  backpack: "https://render.guildwars2.com/file/5EBEA1A467236237FCBACDC09969647956C4A371/1701118.png",
  amulet: "https://render.guildwars2.com/file/4944FD054FD80D805B0BFFB2DA60363A7DD31FDB/1614376.png",
  ring1: "https://render.guildwars2.com/file/EAA61AAF9BEF031104FD063C0A301A520EF5F5E6/1614682.png",
  ring2: "https://render.guildwars2.com/file/EAA61AAF9BEF031104FD063C0A301A520EF5F5E6/1614682.png",
  accessory1: "https://render.guildwars2.com/file/741D3F520D1DFD7BB9A35AD50FC75152D2B3CA6B/1614709.png",
  accessory2: "https://render.guildwars2.com/file/741D3F520D1DFD7BB9A35AD50FC75152D2B3CA6B/1614709.png",
};

export const BUILDER_WEAPON_ICONS: Record<string, string> = {
  axe: `${GW2_WIKI_FILE}/Bandit_Cleaver.png`,
  dagger: `${GW2_WIKI_FILE}/Bandit_Shiv.png`,
  focus: `${GW2_WIKI_FILE}/Bandit_Focus.png`,
  greatsword: `${GW2_WIKI_FILE}/Bandit_Sunderer.png`,
  hammer: `${GW2_WIKI_FILE}/Bandit_Demolisher.png`,
  harpoon: `${GW2_WIKI_FILE}/Bandit_Harpoon_Gun.png`,
  longbow: `${GW2_WIKI_FILE}/Bandit_Longbow.png`,
  mace: `${GW2_WIKI_FILE}/Bandit_Mallet.png`,
  pistol: `${GW2_WIKI_FILE}/Bandit_Revolver.png`,
  rifle: `${GW2_WIKI_FILE}/Bandit_Musket.png`,
  scepter: `${GW2_WIKI_FILE}/Bandit_Baton.png`,
  shield: `${GW2_WIKI_FILE}/Bandit_Ward.png`,
  shortbow: `${GW2_WIKI_FILE}/Bandit_Short_Bow.png`,
  spear: `${GW2_WIKI_FILE}/Bandit_Spear.png`,
  staff: `${GW2_WIKI_FILE}/Bandit_Spire.png`,
  sword: `${GW2_WIKI_FILE}/Bandit_Slicer.png`,
  torch: `${GW2_WIKI_FILE}/Bandit_Torch.png`,
  trident: `${GW2_WIKI_FILE}/Bandit_Trident.png`,
  warhorn: `${GW2_WIKI_FILE}/Bandit_Bugle.png`,
};

export function builderWeaponIcon(weapon: string | undefined): string | undefined {
  if (!weapon) return undefined;
  const normalized = weapon.toLowerCase().replace(/[^a-z]/g, "");
  const key = normalized === "harpoongun" || normalized === "speargun" ? "harpoon" : normalized;
  return BUILDER_WEAPON_ICONS[key];
}
