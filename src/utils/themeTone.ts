export type SurfaceTone = "system" | "info" | "success" | "warning" | "danger" | "violet";

export function inferSurfaceTone(accent?: string): SurfaceTone {
  if (!accent) return "system";
  if (/(orange|amber|yellow)/.test(accent)) return "warning";
  if (/(emerald|green|lime)/.test(accent)) return "success";
  if (/(rose|red|pink)/.test(accent)) return "danger";
  if (/(violet|purple|indigo)/.test(accent)) return "violet";
  if (/(sky|blue|cyan|teal)/.test(accent)) return "info";
  return "system";
}
