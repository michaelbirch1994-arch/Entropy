import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReplayMapStage, replayActorTransform } from "../../components/replay/ReplayMapStage";
import type { ReplayData } from "../parseReplayData";

function replayData(): ReplayData {
  return {
    durationMs: 1000,
    bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    map: null,
    mechanics: [],
    skillMeta: {},
    players: [
      {
        account: "Player.1234",
        name: "Player One",
        profession: "Guardian",
        inSquad: true,
        isCommander: false,
        points: [
          { t: 0, x: 10, y: 20 },
          { t: 150, x: 30, y: 40 },
        ],
        downIntervals: [],
        deadIntervals: [],
        facings: [],
        effects: [],
        casts: [],
      },
    ],
    enemies: [
      {
        id: "target-42",
        name: "Enemy One",
        points: [
          { t: 0, x: 70, y: 80 },
          { t: 150, x: 60, y: 50 },
        ],
        downIntervals: [],
        deadIntervals: [],
        facings: [],
      },
    ],
  };
}

function renderFrame(timestampMs: number): string {
  return renderToStaticMarkup(
    createElement(ReplayMapStage, {
      data: replayData(),
      timestampMs,
      viewBox: "0 0 100 100",
      markerUnit: 1,
      selectedAccount: null,
      alignedIntelligenceEvent: null,
      showMap: false,
      showMechanics: false,
      showCasts: false,
      showFacing: false,
      zoom: 1,
      dragging: false,
      focusMode: false,
      svgRef: createRef<SVGSVGElement>(),
      onPointerDown: () => undefined,
      onPointerMove: () => undefined,
      onPointerUp: () => undefined,
      onSelectPlayer: () => undefined,
    }),
  );
}

describe("ReplayMapStage stable actor painting", () => {
  it("encodes actor motion as one group transform", () => {
    expect(replayActorTransform(10, 20)).toBe("translate(10 20)");
    expect(replayActorTransform(30, 40)).toBe("translate(30 40)");
  });

  it("renders only current actor transforms in each frame", () => {
    const first = renderFrame(0);
    const second = renderFrame(150);

    expect(first).toContain('transform="translate(10 20)"');
    expect(first).toContain('transform="translate(70 80)"');

    expect(second).toContain('transform="translate(30 40)"');
    expect(second).toContain('transform="translate(60 50)"');
    expect(second).not.toContain('transform="translate(10 20)"');
    expect(second).not.toContain('transform="translate(70 80)"');
  });

  it("keeps player clip geometry actor-local instead of moving the clip path itself", () => {
    const frame = renderFrame(150);
    expect(frame).toContain('id="replay-icon-clip-0-Player1234"');
    expect(frame).toContain('cx="0" cy="0"');
  });
});
