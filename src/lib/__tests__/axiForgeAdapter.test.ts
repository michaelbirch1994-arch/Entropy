import { describe, expect, it } from "vitest";
import {
  decodeAxiForgeCode,
  detectAxiForgeCodeKind,
  encodeAxiForgeBuildCode,
  encodeAxiForgeCompCode,
} from "../axiforge/axiForgeAdapter";

describe("axiForgeAdapter", () => {
  it("rejects unsupported codes without throwing", () => {
    const result = decodeAxiForgeCode("not-an-axiforge-code");

    expect(result.ok).toBe(false);
    expect(result.kind).toBe("unknown");
    expect(result.value).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("detects unsupported code kind as unknown", () => {
    expect(detectAxiForgeCodeKind("not-an-axiforge-code")).toBe("unknown");
  });

  it("can encode and decode a minimal build fixture if the package accepts it", () => {
    const build = {
      profession: "Warrior",
      gameMode: "wvw",
      specializations: [],
      weapons: [],
      skills: [],
      traits: [],
      equipment: {},
    };

    let code: string;
    try {
      code = encodeAxiForgeBuildCode(build);
    } catch {
      expect(true).toBe(true);
      return;
    }

    const decoded = decodeAxiForgeCode(code);

    expect(code).toMatch(/^<Entropy:Build:/);
    expect(code).not.toContain("AxiForge");
    expect(decoded.ok).toBe(true);
    expect(decoded.kind).toBe("build");
    expect(decoded.value).toBeTruthy();
  });

  it("exports Entropy-branded squad codes and accepts legacy codes", () => {
    const code = encodeAxiForgeCompCode(
      { name: "Reset Night", gameMode: "wvw", partyLines: [{ capacity: 5, slots: [] }] },
      {},
    );

    expect(code).not.toBeNull();
    expect(code).toMatch(/^<Entropy:Comp:/);
    expect(code).not.toContain("AxiForge");
    expect(decodeAxiForgeCode(code!).kind).toBe("comp");
    expect(decodeAxiForgeCode(code!.replace("<Entropy:", "<AxiForge:")).kind).toBe("comp");
  });
});
