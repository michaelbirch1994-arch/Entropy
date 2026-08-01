import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { WvWReport, ReportIndex } from "../types/report";
import {
  type ReportSource,
  clearActiveReport,
  getActiveReport,
  putActiveReport,
} from "../utils/reportCache";

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
  clearReport: async () => {},
});

function getReportIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("report");
}

function parseReport(text: string, labelForError: string): WvWReport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${labelForError} is not valid JSON.`);
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("meta" in data) ||
    !("stats" in data)
  ) {
    throw new Error(
      `${labelForError} does not look like a WvW report (missing meta/stats).`,
    );
  }
  return data as WvWReport;
}

function reportCacheId(report: WvWReport, source: ReportSource): string {
  const base = report.meta?.id ?? (source === "upload" ? "upload" : "url");
  return `${source}:${base}`;
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<WvWReport | null>(null);
  const [index, setIndex] = useState<ReportIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [source, setSource] = useState<ReportSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = getReportIdFromUrl();
    setReportId(id);

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const idxRes = await fetch(`${import.meta.env.BASE_URL}reports/index.json`);
        if (idxRes.ok && !cancelled) {
          setIndex((await idxRes.json()) as ReportIndex);
        }

        if (id) {
          // URL param wins: fetch fresh, cache it.
          const res = await fetch(`${import.meta.env.BASE_URL}reports/${id}/report.json`);
          if (!res.ok) throw new Error(`Report not found (${res.status})`);
          const data = parseReport(await res.text(), `Report ${id}`);
          if (cancelled) return;
          setReport(data);
          setSource("url");
          setLoading(false);
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
          setReport(cached.report);
          setSource(cached.source);
        } else {
          setReport(null);
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
      setReport(data);
      setSource("upload");
      setReportId(null);
      setLoading(false);
      await putActiveReport({
        id: reportCacheId(data, "upload"),
        source: "upload",
        savedAt: Date.now(),
        report: data,
      });
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
      setReport(data);
      setSource("url");
      setReportId(null);
      setLoading(false);
      await putActiveReport({
        id: reportCacheId(data, "url"),
        source: "url",
        savedAt: Date.now(),
        report: data,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load URL";
      setError(msg);
      setLoading(false);
    }
  }, []);

  const clearReport = useCallback(async () => {
    setReport(null);
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
