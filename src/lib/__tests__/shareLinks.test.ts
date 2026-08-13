import { describe, expect, it } from "vitest";
import {
  buildEntropyArtifactShareLink,
  buildEntropyShareLink,
  getReportPermalinks,
  parseReportLoadQuery,
} from "../shareLinks";
import type { WvWReport } from "../../types/report";

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
