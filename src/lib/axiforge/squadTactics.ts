import type { AttributeProfile, AttributePressureScores } from "../gw2/computeAttributes";
import { computeAttributeProfile } from "../gw2/computeAttributes";
import type { BuilderComposition, SavedBuilderBuild } from "../../types/buildEditor";

export type BuilderPressureIdentity = AttributeProfile["primaryIdentity"];

export interface SquadTacticalBuild {
  buildId: string;
  name: string;
  professionId: string;
  role: string;
  primaryIdentity: BuilderPressureIdentity;
  score: number;
  pressure: AttributePressureScores;
}

export interface SquadTacticalReadout {
  assignedSlots: number;
  capacity: number;
  openSlots: number;
  identityCounts: Record<BuilderPressureIdentity, number>;
  averagePressure: AttributePressureScores;
  topBuilds: SquadTacticalBuild[];
}

const PRESSURE_IDENTITIES: BuilderPressureIdentity[] = ["strike", "condition", "support", "sustain"];

function emptyPressure(): AttributePressureScores {
  return { strike: 0, condition: 0, support: 0, sustain: 0 };
}

export function computeSquadTacticalReadout(
  composition: BuilderComposition,
  builds: SavedBuilderBuild[],
  profileFor: (build: SavedBuilderBuild) => AttributeProfile = (build) => computeAttributeProfile(build.state, null),
): SquadTacticalReadout {
  const byId = new Map(builds.map((build) => [build.id, build]));
  const slottedIds = composition.parties.flatMap((party) => party.slots).filter((id): id is string => Boolean(id));
  const capacity = composition.parties.reduce((total, party) => total + party.slots.length, 0);
  const identityCounts: Record<BuilderPressureIdentity, number> = { strike: 0, condition: 0, support: 0, sustain: 0 };
  const pressureTotals = emptyPressure();

  const tacticalBuilds = slottedIds
    .map((id) => byId.get(id))
    .filter((build): build is SavedBuilderBuild => Boolean(build))
    .map((build) => {
      const profile = profileFor(build);
      identityCounts[profile.primaryIdentity] += 1;
      PRESSURE_IDENTITIES.forEach((identity) => {
        pressureTotals[identity] += profile.pressure[identity];
      });
      return {
        buildId: build.id,
        name: build.name,
        professionId: build.state.professionId,
        role: build.state.role,
        primaryIdentity: profile.primaryIdentity,
        score: profile.pressure[profile.primaryIdentity],
        pressure: profile.pressure,
      };
    });

  const assignedSlots = tacticalBuilds.length;
  const averagePressure = PRESSURE_IDENTITIES.reduce((next, identity) => {
    next[identity] = assignedSlots ? Math.round(pressureTotals[identity] / assignedSlots) : 0;
    return next;
  }, emptyPressure());

  return {
    assignedSlots,
    capacity,
    openSlots: Math.max(0, capacity - assignedSlots),
    identityCounts,
    averagePressure,
    topBuilds: tacticalBuilds.sort((left, right) => right.score - left.score).slice(0, 3),
  };
}