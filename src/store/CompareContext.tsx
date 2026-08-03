// Holds the pair of archived-report ids selected for side-by-side Compare
// mode. Set by ArchiveView when the user picks two reports and clicks
// Compare, read by CompareView to know which two to load.
import { createContext, useContext, useState, type ReactNode } from "react";

export type CompareIds = [string, string] | null;

interface CompareContextValue {
  compareIds: CompareIds;
  setCompareIds: (ids: CompareIds) => void;
}

const CompareContext = createContext<CompareContextValue>({
  compareIds: null,
  setCompareIds: () => {},
});

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareIds, setCompareIds] = useState<CompareIds>(null);
  return <CompareContext.Provider value={{ compareIds, setCompareIds }}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  return useContext(CompareContext);
}
