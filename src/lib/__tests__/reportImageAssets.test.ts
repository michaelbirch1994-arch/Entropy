import { describe, expect, it } from "vitest";
import { reportImageSrc, localizeReportImages } from "../../utils/reportImageAssets";
import manifest from "../../data/communityImageManifest.json";
import { readFileSync } from "node:fs";
describe("Bundled report artwork", () => {
  it("ships a valid PNG for every manifest entry", () => {
    for (const local of Object.values(manifest)) {
      const data = readFileSync(`public${local}`);
      expect([...data.subarray(0, 8)]).toEqual([137,80,78,71,13,10,26,10]);
    }
  });
  it("resolves wiki filename aliases and thumbnail URLs", () => {
    const local = reportImageSrc("https://wiki.guildwars2.com/images/3/33/Blind.png");
    expect(local).toMatch(/^\/images\/community\//);
    expect(reportImageSrc("https://wiki.guildwars2.com/images/thumb/a/ab/Blinded.png/64px-Blinded.png")).toBe(local);
  });
  it("localizes nested images without altering source data or numeric arrays", () => {
    const points = [[0, 10, 20], [1, 20, 30]];
    const source = { skillMeta: { s1: { icon: "https://wiki.guildwars2.com/images/3/33/Blind.png" } }, points, title: "unchanged" };
    const result = localizeReportImages(source);
    expect(result.skillMeta.s1.icon).toMatch(/^\/images\/community\//);
    expect(source.skillMeta.s1.icon).toContain("https://");
    expect(result.points).toBe(points);
    expect(localizeReportImages(result)).toBe(result);
  });
  it("uses local weapon swap assets for known community URLs", () => {
    expect(reportImageSrc("https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png")).toBe("/images/weapon-swap.png");
    expect(reportImageSrc("https://i.imgur.com/K7taOUe.png")).toBe("/images/replay-map-K7taOUe.png");
  });
  it("leaves official and unknown assets intact", () => {
    for (const src of [undefined, "/images/local.png", "https://render.guildwars2.com/file/a.png", "https://i.imgur.com/other.png"]) expect(reportImageSrc(src)).toBe(src);
  });
});
