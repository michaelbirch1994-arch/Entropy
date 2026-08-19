import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { WvWReport, ReportIndex } from "../types/report";
import {
  type ReportSource,
  clearActiveReport,
  getActiveReport,
  putActiveReport,
} from "../utils/reportCache";
import { recordReportIntoProfiles } from "../lib/playerProfileStore";
import { saveToArchive } from "../utils/reportArchive";
import { buildReportFromFights } from "../lib/buildReportFromFights";
import { fetchDpsReportJson } from "../utils/dpsReport";
import { summarizeRawFight } from "../types/rawFight";
import { ENTROPY_REPORT_ARTIFACT_SCHEMA } from "../lib/shareReportArtifact";
import { parseReportLoadQuery } from "../lib/shareLinks";


export type { ReportSource };


interface ReportContextValue {
  report: WvWReport | null;
  index: ReportIndex | null;
  loading: boolean;
  error: string | null;
  reportId: string | null;
  source: ReportSource | null;
  uploadReport: (file: File) => Promise<void>;
  loadFromUrl: (url: string) => Promise<void>;
  reloadReport: () => Promise<void>;
  /** Loads an already-built report object directly (e.g. combined from raw fights). */
  setReport: (report: WvWReport) => Promise<void>;
  clearReport: () => Promise<void>;
}


const ReportContext = createContext<ReportContextValue>({
  report: null,
  index: null,
  loading: true,
  error: null,
  reportId: null,
  source: null,
  uploadReport: async () => {},
  loadFromUrl: async () => {},
  reloadReport: async () => {},
  setReport: async () => {},
  clearReport: async () => {},
});


function parseReport(text: string, labelForError: string): WvWReport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${labelForError} is not valid JSON.`);
  }
  const candidate =
    typeof data === "object" &&
    data !== null &&
    "schema" in data &&
    (data as { schema?: unknown }).schema === ENTROPY_REPORT_ARTIFACT_SCHEMA &&
    "report" in data
      ? (data as { report?: unknown }).report
      : data;

  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("meta" in candidate) ||
    !("stats" in candidate)
  ) {
    throw new Error(
      `${labelForError} does not look like an Entropy report (missing meta/stats).`,
    );
  }
  return candidate as WvWReport;
}


function reportCacheId(report: WvWReport, source: ReportSource): string {
  const base = report.meta?.id ?? (source === "upload" ? "upload" : "url");
  return `${source}:${base}`;
}


function reportPermalinks(report: WvWReport | null): string[] {
  const rows = report?.stats?.fightBreakdown ?? [];
  return Array.from(
    new Set(
      rows
        .map((row) => row.permalink)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );
}


export function ReportProvider({ children }: { children: ReactNode }) {
  const [report, setReportState] = useState<WvWReport | null>(null);
  const [index, setIndex] = useState<ReportIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [source, setSource] = useState<ReportSource | null>(null);


  useEffect(() => {
    let cancelled = false;
    const { reportId: id, permalinks, artifactUrl } =
      typeof window === "undefined"
        ? { reportId: null, permalinks: [], artifactUrl: null }
        : parseReportLoadQuery(window.location.search);
    setReportId(id);


    async function load() {
      setLoading(true);
      setError(null);
      try {
        const idxRes = await fetch(`${import.meta.env.BASE_URL}reports/index.json`);
        if (idxRes.ok && !cancelled) {
          setIndex((await idxRes.json()) as ReportIndex);
        }


        if (permalinks.length > 0) {
          const fights = await Promise.all(
            permalinks.map(async (permalink) => {
              const raw = await fetchDpsReportJson(permalink);
              return { summary: summarizeRawFight(raw, permalink), raw };
            }),
          );
          const data = buildReportFromFights(fights);
          if (cancelled) return;
          setReportState(data);
          setSource("url");
          setLoading(false);
          void saveToArchive(data);
          void putActiveReport({
            id: reportCacheId(data, "url"),
            source: "url",
            savedAt: Date.now(),
            report: data,
          });
          return;
        }

        if (artifactUrl) {
          const res = await fetch(artifactUrl);
          if (!res.ok) throw new Error(`Shared report artifact not found (${res.status})`);
          const data = parseReport(await res.text(), artifactUrl);
          if (cancelled) return;
          setReportState(data);
          setSource("url");
          setLoading(false);
          void saveToArchive(data);
          void putActiveReport({
            id: reportCacheId(data, "url"),
            source: "url",
            savedAt: Date.now(),
            report: data,
          });
          void recordReportIntoProfiles(data);
          return;
        }

        if (id) {
          // URL param wins: fetch fresh, cache it.
          const res = await fetch(`${import.meta.env.BASE_URL}reports/${id}/report.json`);
          if (!res.ok) throw new Error(`Report not found (${res.status})`);
          const data = parseReport(await res.text(), `Report ${id}`);
          if (cancelled) return;
          setReportState(data);
          setSource("url");
          setLoading(false);
                    void saveToArchive(data);
          void putActiveReport({
            id: reportCacheId(data, "url"),
            source: "url",
            savedAt: Date.now(),
            report: data,
          });
          return;
        }


        // No URL param: restore the last-viewed report from cache (if any).
        const cached = await getActiveReport();
        if (cancelled) return;
        if (cached) {
          setReportState(cached.report);
          setSource(cached.source);
        } else {
          setReportState(null);
          setSource(null);
        }
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load report");
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);


  const uploadReport = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const data = parseReport(text, file.name);
      setReportState(data);
      setSource("upload");
      setReportId(null);
      setLoading(false);
      await putActiveReport({
        id: reportCacheId(data, "upload"),
        source: "upload",
        savedAt: Date.now(),
        report: data,
      });
      void recordReportIntoProfiles(data);
      void saveToArchive(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read file");
      setLoading(false);
    }
  }, []);


  const loadFromUrl = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch report (${res.status})`);
      const text = await res.text();
      const data = parseReport(text, url);
      setReportState(data);
      setSource("url");
      setReportId(null);
      setLoading(false);
      await putActiveReport({
        id: reportCacheId(data, "url"),
        source: "url",
        savedAt: Date.now(),
        report: data,
      });
      void recordReportIntoProfiles(data);
      void saveToArchive(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load URL";
      setError(msg);
      setLoading(false);
    }
  }, []);


  const reloadReport = useCallback(async () => {
    if (!report) {
      setError("No report is loaded to reload.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const permalinks = reportPermalinks(report);
      if (permalinks.length > 0) {
        const fights = await Promise.all(
          permalinks.map(async (permalink) => {
            const raw = await fetchDpsReportJson(permalink);
            return { summary: summarizeRawFight(raw, permalink), raw };
          }),
        );
        const data = buildReportFromFights(fights);
        const nextSource: ReportSource = source === "upload" ? "raw" : (source ?? "raw");
        setReportState(data);
        setSource(nextSource);
        setReportId(null);
        setLoading(false);
        await putActiveReport({
          id: reportCacheId(data, nextSource),
          source: nextSource,
          savedAt: Date.now(),
          report: data,
        });
        void recordReportIntoProfiles(data);
        void saveToArchive(data);
        return;
      }

      if (reportId) {
        const res = await fetch(`${import.meta.env.BASE_URL}reports/${reportId}/report.json`);
        if (!res.ok) throw new Error(`Report not found (${res.status})`);
        const data = parseReport(await res.text(), `Report ${reportId}`);
        setReportState(data);
        setSource("url");
        setLoading(false);
        await putActiveReport({
          id: reportCacheId(data, "url"),
          source: "url",
          savedAt: Date.now(),
          report: data,
        });
        void recordReportIntoProfiles(data);
        void saveToArchive(data);
        return;
      }

      throw new Error("This report cannot be reloaded automatically. Re-import the raw .zevtc logs or paste the dps.report links again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reload report");
      setLoading(false);
    }
  }, [report, reportId, source]);


  const setReport = useCallback(async (data: WvWReport) => {
    setLoading(true);
    setError(null);
    try {
      setReportState(data);
      setSource("raw");
      setReportId(null);
      setLoading(false);
      await putActiveReport({
        id: reportCacheId(data, "raw"),
        source: "raw",
        savedAt: Date.now(),
        report: data,
      });
      void recordReportIntoProfiles(data);
      void saveToArchive(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load combined report");
      setLoading(false);
    }
  }, []);


  const clearReport = useCallback(async () => {
    setReportState(null);
    setSource(null);
    setReportId(null);
    setError(null);
    setLoading(false);
    await clearActiveReport();
  }, []);


  return (
    <ReportContext.Provider
      value={{
        report,
        index,
        loading,
        error,
        reportId,
        source,
        uploadReport,
        loadFromUrl,
        reloadReport,
        setReport,
        clearReport,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}


export function useReport() {
  return useContext(ReportContext);
}
