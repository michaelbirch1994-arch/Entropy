import type { WvWReport } from "../types/report";

export const ENTROPY_REPORT_ARTIFACT_SCHEMA = "entropy.report-artifact.v1";

export interface EntropyReportArtifact {
  schema: typeof ENTROPY_REPORT_ARTIFACT_SCHEMA;
  generatedAt: string;
  source: "desktop-export";
  viewerHint: {
    preferredRoute: "/report";
    accepts: ["json-file", "hosted-artifact"];
  };
  report: WvWReport;
}

export function buildReportArtifact(report: WvWReport): EntropyReportArtifact {
  return {
    schema: ENTROPY_REPORT_ARTIFACT_SCHEMA,
    generatedAt: new Date().toISOString(),
    source: "desktop-export",
    viewerHint: {
      preferredRoute: "/report",
      accepts: ["json-file", "hosted-artifact"],
    },
    report,
  };
}

export function reportArtifactFilename(title: string): string {
  const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "entropy-report";
  return `${safeTitle}.entropy-report.json`;
}

export function downloadReportArtifact(report: WvWReport): void {
  const artifact = buildReportArtifact(report);
  const blob = new Blob([JSON.stringify(artifact)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportArtifactFilename(report.meta.title);
  a.click();
  URL.revokeObjectURL(url);
}
