import type { CSSProperties } from "react";

export const TOOLTIP_STYLE: CSSProperties = {
  background: "var(--entropy-surface-2)",
  border: "1px solid var(--entropy-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "var(--entropy-shadow-overlay)",
  padding: "9px 12px",
};

export const TOOLTIP_ITEM_STYLE: CSSProperties = { color: "var(--entropy-text-primary)" };
export const TOOLTIP_LABEL_STYLE: CSSProperties = { color: "var(--entropy-text-muted)", fontWeight: 600, marginBottom: 5, fontSize: 11 };

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
