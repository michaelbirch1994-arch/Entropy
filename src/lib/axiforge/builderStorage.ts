import type { BuilderWorkspace } from "../../types/buildEditor";
import { BUILDER_STORAGE_KEY, createEmptyBuilder, normalizeBuilderState } from "./builderModel";

export function createEmptyWorkspace(): BuilderWorkspace {
  return { draft: createEmptyBuilder(), builds: [], compositions: [], activeCompositionId: null };
}

export function loadBuilderWorkspace(): BuilderWorkspace {
  if (typeof localStorage === "undefined") return createEmptyWorkspace();
  try {
    const parsed = JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY) ?? "null") as Partial<BuilderWorkspace> | null;
    if (!parsed) return createEmptyWorkspace();
    return {
      draft: normalizeBuilderState(parsed.draft),
      builds: Array.isArray(parsed.builds) ? parsed.builds.map((build) => ({ ...build, state: normalizeBuilderState(build.state) })) : [],
      compositions: Array.isArray(parsed.compositions) ? parsed.compositions : [],
      activeCompositionId: typeof parsed.activeCompositionId === "string" ? parsed.activeCompositionId : null,
    };
  } catch {
    return createEmptyWorkspace();
  }
}

export function saveBuilderWorkspace(workspace: BuilderWorkspace): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // A full or disabled browser store should not make the editor unusable.
  }
}
