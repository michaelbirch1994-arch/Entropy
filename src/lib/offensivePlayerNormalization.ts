import type { OffensePlayer, OffenseTotals } from "../types/report";

function groupByAccount<T extends { account: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const current = grouped.get(row.account) ?? [];
    current.push(row);
    grouped.set(row.account, current);
  }
  return grouped;
}

function sumNumericRecords<T extends object>(rows: T[]): T {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, raw] of Object.entries(row)) {
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      totals[key] = (totals[key] ?? 0) + raw;
    }
  }
  return totals as T;
}

function professionListFor(rows: OffensePlayer[]): string[] {
  return Array.from(
    new Set(
      rows
        .flatMap((row) => [row.profession, ...(row.professionList ?? [])])
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

/**
 * Modern combined reports already contain one offense row per account.
 * Older archived reports can contain one row per profession after a build swap;
 * recombine those slices so additive totals, rate numerators/denominators, and
 * tracked fight time all describe the whole account instead of the last build.
 */
export function normalizeOffensePlayers(players: OffensePlayer[] | undefined): OffensePlayer[] {
  return Array.from(groupByAccount(players ?? []).values()).map((rows) => {
    const primary = [...rows].sort((a, b) => (b.totalFightMs ?? 0) - (a.totalFightMs ?? 0))[0];
    return {
      account: primary.account,
      profession: primary.profession,
      professionList: professionListFor(rows),
      offenseTotals: sumNumericRecords(rows.map((row) => row.offenseTotals)) as OffenseTotals,
      offenseRateWeights: sumNumericRecords(rows.map((row) => row.offenseRateWeights ?? {})),
      totalFightMs: rows.reduce((sum, row) => sum + Math.max(0, Number(row.totalFightMs) || 0), 0),
    };
  });
}
