export type FightOutcome = boolean | null | undefined;

export function fightOutcomeLabel(outcome: FightOutcome): "Win" | "Loss" | "Unclassified" {
  if (outcome === true) return "Win";
  if (outcome === false) return "Loss";
  return "Unclassified";
}

export function fightOutcomeSortValue(outcome: FightOutcome): number {
  if (outcome === true) return 2;
  if (outcome === false) return 1;
  return 0;
}

export function fightOutcomeTextClass(outcome: FightOutcome): string {
  if (outcome === true) return "text-emerald-400";
  if (outcome === false) return "text-rose-400";
  return "text-theme-muted";
}

export function fightOutcomeBadgeClass(outcome: FightOutcome): string {
  if (outcome === true) return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  if (outcome === false) return "border-rose-400/30 bg-rose-500/10 text-rose-300";
  return "border-theme-border bg-theme-surface-inset/70 text-theme-muted";
}

export function fightOutcomeMarkerClass(outcome: FightOutcome): string {
  if (outcome === true) return "bg-emerald-600/30 text-emerald-400 border-emerald-500/40";
  if (outcome === false) return "bg-rose-600/30 text-rose-400 border-rose-500/40";
  return "bg-theme-surface-elevated text-theme-muted border-theme-border";
}
