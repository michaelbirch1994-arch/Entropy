import type { Gw2Specialization, SavedBuilderBuild } from "../../types/buildEditor";

export interface BuilderLibraryFilters {
  query: string;
  profession: string;
  specialization: string;
  role: string;
  mode: string;
  tag: string;
}

export function matchesBuilderLibraryFilters(
  build: SavedBuilderBuild,
  filters: BuilderLibraryFilters,
  specsById: Map<number, Gw2Specialization>,
): boolean {
  const specializationIds = build.state.specializationIds
    .filter((id): id is number => id != null)
    .map(String);
  const specializationNames = specializationIds.map((id) => specsById.get(Number(id))?.name ?? "");
  const haystack = [
    build.name,
    build.state.professionId,
    build.state.role,
    ...specializationNames,
    ...build.state.tags,
  ].join(" ").toLowerCase();

  return haystack.includes(filters.query.trim().toLowerCase())
    && (!filters.profession || build.state.professionId === filters.profession)
    && (!filters.specialization || specializationIds.includes(filters.specialization))
    && (!filters.role || build.state.role === filters.role)
    && (!filters.mode || build.state.gameMode === filters.mode)
    && (!filters.tag || build.state.tags.includes(filters.tag));
}
