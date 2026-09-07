import type { BuilderParty } from "../../types/buildEditor";

export interface SubgroupCoverageProvider {
  partyId: string;
  estimatedUptimePercent?: number;
}

/**
 * Boons prioritize a player's subgroup, so providers in different subgroups
 * cannot be added into one shared timer. Estimate each subgroup independently,
 * then weight it by the number of assigned players who receive that coverage.
 */
export function estimateSquadBoonUptime(
  parties: BuilderParty[],
  providers: SubgroupCoverageProvider[],
): number | undefined {
  const assignedCount = parties.reduce(
    (total, party) => total + party.slots.filter(Boolean).length,
    0,
  );
  if (!assignedCount) return undefined;

  let hasKnownUptime = false;
  let weightedUptime = 0;
  for (const party of parties) {
    const memberCount = party.slots.filter(Boolean).length;
    if (!memberCount) continue;
    const knownSources = providers
      .filter((provider) => provider.partyId === party.id)
      .map((provider) => provider.estimatedUptimePercent)
      .filter((uptime): uptime is number => uptime != null);
    if (!knownSources.length) continue;
    hasKnownUptime = true;
    const subgroupUptime = Math.min(100, knownSources.reduce((sum, uptime) => sum + uptime, 0));
    weightedUptime += subgroupUptime * memberCount;
  }

  return hasKnownUptime ? weightedUptime / assignedCount : undefined;
}

