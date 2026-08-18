type OffensiveDamageTotals = {
  damage?: number;
  damageAll?: number;
};

type OffensiveDamageRow = {
  offenseTotals: OffensiveDamageTotals;
};

export function nonPlayerObjectiveDamage(row: OffensiveDamageRow): number {
  const playerDamage = row.offenseTotals.damage ?? 0;
  const allDamage = row.offenseTotals.damageAll ?? playerDamage;
  return Math.max(0, allDamage - playerDamage);
}

export function hasNonPlayerObjectiveDamage(rows: OffensiveDamageRow[]): boolean {
  return rows.some((row) => nonPlayerObjectiveDamage(row) > 0);
}

