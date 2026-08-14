import type { CSSProperties } from "react";

export const TOOLTIP_STYLE: CSSProperties = {
  background: "rgba(12, 9, 7, 0.96)",
  border: "1px solid rgba(138, 60, 34, 0.68)",
  borderRadius: 3,
  fontSize: 12,
  backdropFilter: "blur(14px) saturate(0.8)",
  boxShadow: "inset 3px 0 0 #e64e24, 0 14px 38px rgba(0, 0, 0, 0.58)",
  padding: "9px 12px",
};

export const TOOLTIP_ITEM_STYLE: CSSProperties = { color: "#f3e9dc" };
export const TOOLTIP_LABEL_STYLE: CSSProperties = { color: "#a09388", fontWeight: 700, marginBottom: 5, fontSize: 11 };

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

export const CHART_CURSOR = { fill: "rgba(230, 78, 36, 0.08)" };
