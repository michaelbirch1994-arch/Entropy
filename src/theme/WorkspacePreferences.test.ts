import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, parseWorkspacePreferences } from "./WorkspacePreferences";

describe("workspace appearance persistence", () => {
  it("recovers usable settings from unavailable or invalid storage", () => {
    for (const stored of [null, undefined, false, [], "compact", { density: "tiny", motion: "never", contrast: "neon" }]) {
      expect(parseWorkspacePreferences(stored)).toEqual(DEFAULT_PREFERENCES);
    }
  });

  it("restores supported preferences and ignores unrelated report state", () => {
    expect(parseWorkspacePreferences({
      density: "compact", motion: "reduced", contrast: "high", sidebar: "compact",
      fightIndex: 7, damageScope: "players", report: { totalDamage: 9 },
    })).toEqual({ density: "compact", motion: "reduced", contrast: "high", sidebar: "compact" });
  });
});
