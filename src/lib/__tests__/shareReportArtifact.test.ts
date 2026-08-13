import { describe, expect, it } from "vitest";
import { buildReportArtifact, ENTROPY_REPORT_ARTIFACT_SCHEMA, reportArtifactFilename } from "../shareReportArtifact";
import type { WvWReport } from "../../types/report";

const report = {
  meta: {
    title: "Reset Night / EBG",
    dateLabel: "Aug 13, 2026",
    appVersion: "entropy-raw-v5",
  },
  stats: {
    total: 1,
    wins: 1,
    losses: 0,
    leaderboards: {},
  },
} as WvWReport;

describe("share report artifact", () => {
  it("wraps a report in a stable viewer-ready artifact contract", () => {
    const artifact = buildReportArtifact(report);

    expect(artifact.schema).toBe(ENTROPY_REPORT_ARTIFACT_SCHEMA);
    expect(artifact.source).toBe("desktop-export");
    expect(artifact.viewerHint.preferredRoute).toBe("/report");
    expect(artifact.viewerHint.accepts).toContain("json-file");
    expect(artifact.report).toBe(report);
    expect(Date.parse(artifact.generatedAt)).toBeGreaterThan(0);
  });

  it("uses the Entropy report extension for exported files", () => {
    expect(reportArtifactFilename("Reset Night / EBG")).toBe("Reset-Night-EBG.entropy-report.json");
  });
});
