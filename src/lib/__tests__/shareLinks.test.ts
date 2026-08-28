import { afterEach, describe, expect, it, vi } from "vitest";
import { isTauri } from "@tauri-apps/api/core";
import {
  buildEntropyArtifactShareLink,
  buildEntropyShareLink,
  DEFAULT_SHARE_VIEWER_URL,
  getReportPermalinks,
  parseReportLoadQuery,
} from "../shareLinks";
import type { WvWReport } from "../../types/report";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(() => false) }));

function reportWithPermalinks(values: unknown[]): WvWReport {
  return {
    meta: {
      title: "Reset Night",
      dateLabel: "Aug 13, 2026",
      appVersion: "entropy-raw-v5",
    },
    stats: {
      fightBreakdown: values.map((permalink, i) => ({
        id: `fight-${i}`,
        permalink,
      })),
    },
  } as WvWReport;
}

describe("share links", () => {
  it("extracts safe unique dps.report permalinks from fight breakdown rows", () => {
    const report = reportWithPermalinks([
      "abc-20260813_wvw",
      "abc-20260813_wvw",
      "bad/value",
      "",
      null,
      "xyz_123",
    ]);

    expect(getReportPermalinks(report)).toEqual(["abc-20260813_wvw", "xyz_123"]);
  });

  it("builds a hosted permalink collection URL without carrying old query state", () => {
    const report = reportWithPermalinks(["one", "two"]);

    expect(buildEntropyShareLink(report, "https://entropy.example/report?old=1#top")).toBe(
      "https://entropy.example/report?permalinks=one%2Ctwo",
    );
  });

  it("builds a hosted artifact URL for externally stored report artifacts", () => {
    expect(
      buildEntropyArtifactShareLink(
        "https://cdn.example/reports/reset.entropy-report.json",
        "https://entropy.example/",
      ),
    ).toBe(
      "https://entropy.example/?artifact=https%3A%2F%2Fcdn.example%2Freports%2Freset.entropy-report.json",
    );
  });

  it("parses hosted viewer query modes", () => {
    expect(
      parseReportLoadQuery(
        "?report=reset-night&permalinks=one,two,bad/value,one&artifact=https%3A%2F%2Fcdn.example%2Fa.json",
      ),
    ).toEqual({
      reportId: "reset-night",
      permalinks: ["one", "two"],
      artifactUrl: "https://cdn.example/a.json",
    });
  });

  it("rejects non-http artifact URLs", () => {
    expect(parseReportLoadQuery("?artifact=javascript%3Aalert(1)").artifactUrl).toBeNull();
  });

  it("rejects unsafe local report ids", () => {
    expect(parseReportLoadQuery("?report=../private/report").reportId).toBeNull();
  });
});

describe("share links inside the desktop app", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error - deliberately removing the test-only window stub
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it("falls back to the hosted Vercel URL instead of the local Tauri pseudo-origin", () => {
    // Regression test: the desktop app's WebView reports an http(s) protocol
    // (https://tauri.localhost on Windows) even though it isn't a real,
    // reachable page - isTauri() must override that so share links never
    // point somewhere only this machine can open.
    vi.mocked(isTauri).mockReturnValue(true);
    // @ts-expect-error - partial window stub is enough for this code path
    globalThis.window = { location: { protocol: "https:", href: "https://tauri.localhost/" } };

    const report = reportWithPermalinks(["one", "two"]);

    expect(buildEntropyShareLink(report)).toBe(`${DEFAULT_SHARE_VIEWER_URL}?permalinks=one%2Ctwo`);
  });

  it("still uses the real page URL when actually running in a browser tab", () => {
    vi.mocked(isTauri).mockReturnValue(false);
    // @ts-expect-error - partial window stub is enough for this code path
    globalThis.window = { location: { protocol: "https:", href: "https://entropy-um58.vercel.app/" } };

    const report = reportWithPermalinks(["one", "two"]);

    expect(buildEntropyShareLink(report)).toBe("https://entropy-um58.vercel.app/?permalinks=one%2Ctwo");
  });
});
