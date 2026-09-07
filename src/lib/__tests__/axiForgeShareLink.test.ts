import { describe, expect, it } from "vitest";
import {
  buildAxiForgeShareUrl,
  parseAxiForgeShareQuery,
} from "../axiforge/axiForgeShareLink";

describe("Entropy builder share links", () => {
  it("creates an Entropy-branded builder URL without carrying old query state", () => {
    const url = buildAxiForgeShareUrl(
      "<AxiForge:Comp:payload>",
      "https://entropy.example/?old=1#section",
    );

    expect(url).toBe("https://entropy.example/?view=entropy-builder&entropy=%3CEntropy%3AComp%3Apayload%3E");
    expect(url).not.toContain("AxiForge");
    expect(url).not.toContain("axi=");
  });

  it("parses current Entropy links and legacy builder links", () => {
    expect(parseAxiForgeShareQuery("?entropy=%3CEntropy%3ABuild%3Aone%3E")).toBe("<Entropy:Build:one>");
    expect(parseAxiForgeShareQuery("?axi=%3CAxiForge%3ABuild%3Aone%3E")).toBe("<AxiForge:Build:one>");
  });
});
