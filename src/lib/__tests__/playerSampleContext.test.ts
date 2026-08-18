import { describe, expect, it } from "vitest";
import { resolvePlayerSampleContext } from "../playerSampleContext";

describe("player sample context", () => {
  it("prefers account-level participation and active time", () => {
    const sample = resolvePlayerSampleContext(
      [{ account: "Player.1234", logsJoined: 7, squadActiveMs: 420_000, totalFightMs: 500_000 }],
      10,
      "Player.1234",
      { fights: 2, activeMs: 90_000 },
    );

    expect(sample).toEqual({ fights: 7, totalFights: 10, activeMs: 420_000, known: true });
  });

  it("uses explicit legacy fallbacks without inventing coverage", () => {
    expect(resolvePlayerSampleContext(undefined, 8, "Legacy.1234", { fights: 3, activeMs: 120_000 }))
      .toEqual({ fights: 3, totalFights: 8, activeMs: 120_000, known: true });

    expect(resolvePlayerSampleContext(undefined, 8, "Unknown.1234", { activeMs: 120_000 }))
      .toEqual({ fights: 0, totalFights: 8, activeMs: 120_000, known: false });
  });

  it("clamps malformed values and never reports more fights than the session", () => {
    const sample = resolvePlayerSampleContext(
      [{ account: "Odd.1234", logsJoined: 12, squadActiveMs: -1 }],
      5,
      "Odd.1234",
    );

    expect(sample).toEqual({ fights: 12, totalFights: 12, activeMs: 0, known: true });
  });
});
