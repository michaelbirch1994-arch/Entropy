export interface ChartSelectionRow {
  index?: number;
  name?: string;
  label?: string;
  id?: string;
}

interface ChartSelectionEvent {
  activeIndex?: unknown;
  activeTooltipIndex?: unknown;
  activeLabel?: unknown;
  activePayload?: Array<{ payload?: ChartSelectionRow }>;
}

function asIndex(value: unknown): number | null {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

export function resolveChartSelectionIndex(
  event: unknown,
  rows: readonly ChartSelectionRow[],
): number | null {
  const chartEvent = event as ChartSelectionEvent | null | undefined;
  const candidates = [
    chartEvent?.activePayload?.[0]?.payload?.index,
    chartEvent?.activeIndex,
    chartEvent?.activeTooltipIndex,
  ];

  for (const candidate of candidates) {
    const index = asIndex(candidate);
    if (index !== null && index >= 0 && index < rows.length) return index;
  }

  if (typeof chartEvent?.activeLabel === "string") {
    const index = rows.findIndex((row) =>
      row.name === chartEvent.activeLabel ||
      row.label === chartEvent.activeLabel ||
      row.id === chartEvent.activeLabel,
    );
    if (index >= 0) return index;
  }

  return null;
}
