import manifest from "../data/communityImageManifest.json";

const localImages: Record<string, string> = manifest;
const wikiFiles = new Map(Object.entries(manifest)
  .filter(([url]) => new URL(url).hostname === "wiki.guildwars2.com")
  .map(([url, local]) => [decodeURIComponent(new URL(url).pathname.split("/").pop()!).replaceAll(" ", "_"), local]));
for (const [alias, original] of [["Poisoned.png", "Poison.png"], ["Blinded.png", "Blind.png"], ["Immobile.png", "Immobilized.png"]]) {
  const local = wikiFiles.get(original);
  if (local) wikiFiles.set(alias, local);
}

/** Stable copies of community-hosted UI images included in EI reports. */
export function reportImageSrc(src: string | undefined): string | undefined {
  if (!src) return src;
  try {
    const url = new URL(src);
    if (url.hostname === "wiki.guildwars2.com" && decodeURIComponent(url.pathname).endsWith("/Weapon_Swap_Button.png")) return "/images/weapon-swap.png";
    if (url.hostname === "i.imgur.com" && url.pathname === "/K7taOUe.png") return "/images/replay-map-K7taOUe.png";
    if (localImages[src]) return localImages[src];
    if (url.hostname === "wiki.guildwars2.com" && (url.pathname.startsWith("/images/") || url.pathname.includes("/Special:"))) {
      const file = decodeURIComponent(url.pathname.split("/").pop()!).replaceAll(" ", "_").replace(/^\d+px-/, "");
      return wikiFiles.get(file) ?? src;
    }
  } catch { /* Local asset paths already need no remapping. */ }
  return src;
}

/** Copy only changed branches, preserving numeric arrays and the source report. */
export function localizeReportImages<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    if (!value.length || value.every(item => item === null || typeof item !== "object")) return value;
    const mapped = value.map(localizeReportImages);
    return (mapped.some((item, i) => item !== value[i]) ? mapped : value) as T;
  }
  let result = value;
  for (const [key, item] of Object.entries(value)) {
    const mapped = typeof item === "string" && /^(icon|iconUrl|image|imageUrl|src|url)$/.test(key)
      ? reportImageSrc(item) : localizeReportImages(item);
    if (mapped !== item) {
      if (result === value) result = { ...value };
      (result as Record<string, unknown>)[key] = mapped;
    }
  }
  return result;
}
