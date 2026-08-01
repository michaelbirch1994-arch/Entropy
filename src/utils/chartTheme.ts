import type { CSSProperties } from "react";

export const TOOLTIP_STYLE: CSSProperties = {
  background: "rgba(10, 16, 31, 0.95)",
  border: "1px solid rgba(148, 163, 184, 0.15)",
  borderRadius: 10,
  fontSize: 12,
  backdropFilter: "blur(12px)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  padding: "8px 12px",
};

export const TOOLTIP_ITEM_STYLE: CSSProperties = { color: "#e2e8f0" };
export const TOOLTIP_LABEL_STYLE: CSSProperties = { color: "#94a3b8", fontWeight: 600, marginBottom: 4, fontSize: 11 };

export const CHART_COLORS = {
  blue: "#3b82f6",
  sky: "#38bdf8",
  orange: "#f97316",
  red: "#ef4444",
  amber: "#f59e0b",
  emerald: "#10b981",
  rose: "#f43f5e",
  teal: "#14b8a6",
  cyan: "#06b6d4",
} as const;

export const CHART_CURSOR = { fill: "rgba(148, 163, 184, 0.06)" };
