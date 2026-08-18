import type { CSSProperties } from "react";

export const TOOLTIP_STYLE: CSSProperties = {
  background: "rgba(3, 12, 18, 0.98)",
  border: "1px solid rgba(77, 200, 255, 0.58)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "inset 3px 0 0 #4dc8ff, 0 14px 38px rgba(0, 0, 0, 0.58), 0 0 24px rgba(77, 200, 255, 0.12)",
  padding: "9px 12px",
};

export const TOOLTIP_ITEM_STYLE: CSSProperties = { color: "#e8fcff" };
export const TOOLTIP_LABEL_STYLE: CSSProperties = { color: "#9ec3cb", fontWeight: 700, marginBottom: 5, fontSize: 11 };

export const CHART_COLORS = {
  blue: "#6f9eff",
  sky: "#4dc8ff",
  orange: "#ff9d42",
  red: "#ff5d7d",
  amber: "#ffc14f",
  emerald: "#51edab",
  rose: "#ff6f9f",
  teal: "#28dfc1",
  cyan: "#40ddff",
} as const;

export const CHART_CURSOR = { fill: "rgba(77, 200, 255, 0.09)" };
