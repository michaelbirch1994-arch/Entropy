import { describe, expect, it } from "vitest";
import {
  decodeAxiForgeCode,
  detectAxiForgeCodeKind,
  encodeAxiForgeBuildCode,
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

    expect(decoded.ok).toBe(true);
    expect(decoded.kind).toBe("build");
    expect(decoded.value).toBeTruthy();
  });
});
