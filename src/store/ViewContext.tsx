// Which sidebar view is currently visible. Lifted out of ReportShell's local
// state into a context so other views (e.g. ArchiveView) can navigate the
// user to a different view programmatically - e.g. "open this archived
// report, then take me to Compare mode with it selected".
import { createContext, useContext, useState, type ReactNode } from "react";

interface ViewContextValue {
  activeView: string;
  setActiveView: (view: string) => void;
}

const ViewContext = createContext<ViewContextValue>({
  activeView: "overview",
  setActiveView: () => {},
});

export function ViewProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState("overview");
  return <ViewContext.Provider value={{ activeView, setActiveView }}>{children}</ViewContext.Provider>;
}

export function useView() {
  return useContext(ViewContext);
}
