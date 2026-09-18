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

function renderFrame(timestampMs: number, showMap = false, data = replayData(), selectedAccount: string | null = null): string {
  if (showMap) {
    data.map = {
      images: [{ url: "https://i.imgur.com/replay-map.png", startMs: 0, endMs: 1000, x: 0, y: 0 }],
      width: 100,
      height: 100,
      inchToPixel: 1,
    };
  }
  return renderToStaticMarkup(
    createElement(ReplayMapStage, {
      data,
      timestampMs,
      viewBox: "0 0 100 100",
      markerUnit: 1,
      selectedAccount,
      alignedIntelligenceEvent: null,
      showMap,
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
  it("paints a dark disc before the profession image", () => {
    const frame = renderFrame(0);
    expect(frame.indexOf('fill="#111820"')).toBeLessThan(frame.indexOf('<image'));
    expect(frame).toContain('role="button" tabindex="0"');
    expect(frame).toContain('aria-pressed="false"');
  });

  it("raises commanders and selection without changing original clip identities", () => {
    const data = replayData();
    const base = data.players[0];
    data.players = [
      { ...base, account: "commander", name: "Commander", isCommander: true },
      { ...base, account: "selected", name: "Selected" },
      { ...base, account: "ordinary", name: "Ordinary" },
    ];
    const frame = renderFrame(0, false, data, "selected");
    expect(frame.indexOf('aria-label="Ordinary')).toBeLessThan(frame.indexOf('aria-label="Commander'));
    expect(frame.indexOf('aria-label="Commander')).toBeLessThan(frame.indexOf('aria-label="Selected'));
    expect(frame).toContain('replay-icon-clip-1-selected');
    expect(frame.lastIndexOf('<image')).toBeLessThan(frame.indexOf('data-replay-labels="true"'));
    expect(frame).toContain('aria-pressed="true"');
  });
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

  it("does not send the Entropy page referrer when loading a replay map", () => {
    const frame = renderFrame(150, true);

    expect(frame).toContain('href="https://i.imgur.com/replay-map.png"');
    expect(frame).toContain('referrerPolicy="no-referrer"');
  });
});
