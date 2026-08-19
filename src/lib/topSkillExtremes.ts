export interface FightExtremeSample {
  value: number;
  fightIndex: number;
  fightName: string;
  fightLabel: string;
}

export interface RankedFightExtremes {
  highest: FightExtremeSample[];
  lowest: FightExtremeSample[];
}

/**
 * Rank per-fight samples without inventing additional evidence.
 *
 * The helper is intentionally dumb about what the metric means: callers pass
 * already-derived per-fight damage/healing/etc. totals, and this only orders
 * those observed samples. Ties are deterministic by fight index so archived
 * reports and rebuilds render consistently.
 */
export function rankFightExtremes(
  samples: readonly FightExtremeSample[],
  limit = 3,
): RankedFightExtremes {
  const count = Math.max(0, Math.floor(limit));
  if (count === 0) return { highest: [], lowest: [] };

  const valid = samples.filter((sample) =>
    Number.isFinite(sample.value)
    && sample.value >= 0
    && Number.isInteger(sample.fightIndex)
    && sample.fightIndex >= 0,
  );

  const highest = [...valid]
    .sort((a, b) => b.value - a.value || a.fightIndex - b.fightIndex)
    .slice(0, count);

  const lowest = [...valid]
    .sort((a, b) => a.value - b.value || a.fightIndex - b.fightIndex)
    .slice(0, count);

  return { highest, lowest };
}
