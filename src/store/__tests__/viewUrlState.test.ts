import { describe, expect, it } from "vitest";
import { buildViewUrl, normalizeViewId, parseViewUrlState } from "../viewUrlState";

describe("viewUrlState", () => {
  it("normalizes known views and falls back from unknown views", () => {
    expect(normalizeViewId("fight-replay")).toBe("fight-replay");
    expect(normalizeViewId("missing-view")).toBe("overview");
    expect(normalizeViewId(null, "intelligence")).toBe("intelligence");
  });

  it("parses deep-linked view state without a navigation target", () => {
    expect(parseViewUrlState("?view=defensive")).toEqual({
      view: "defensive",
      navigationTarget: null,
    });
  });

  it("parses cross-view evidence target state", () => {
    expect(
      parseViewUrlState(
        "?view=fight-replay&navSource=intelligence&fightId=fight-1&fightIndex=2&account=Player.1234&timestampMs=44000&eventId=e-7&metric=downs",
      ),
    ).toEqual({
      view: "fight-replay",
      navigationTarget: {
        source: "intelligence",
        targetView: "fight-replay",
        fightId: "fight-1",
        fightIndex: 2,
        account: "Player.1234",
        timestampMs: 44000,
        eventId: "e-7",
        metric: "downs",
      },
    });
  });

  it("preserves unrelated query state when writing view state", () => {
    expect(buildViewUrl("http://localhost:5173/?report=abc&view=overview", "top-players", null)).toBe(
      "/?report=abc&view=top-players",
    );
  });

  it("writes target parameters and clears stale ones when target is absent", () => {
    const withTarget = buildViewUrl("http://localhost:5173/?view=overview&fightId=old", "death-recap", {
      source: "overview",
      targetView: "death-recap",
      fightIndex: 0,
      account: "Player.1234",
      timestampMs: 1,
    });
    expect(withTarget).toBe(
      "/?view=death-recap&navSource=overview&fightIndex=0&account=Player.1234&timestampMs=1",
    );

    expect(buildViewUrl(`http://localhost:5173${withTarget}`, "overview", null)).toBe("/?view=overview");
  });
});
