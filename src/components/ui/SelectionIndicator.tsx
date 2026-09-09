import { motion, useReducedMotion } from "framer-motion";
import { useWorkspacePreferences } from "../../theme/WorkspacePreferences";

export default function SelectionIndicator({ id, variant = "tab" }: {
  id: string;
  variant?: "tab" | "navigation";
}) {
  const systemReduced = useReducedMotion();
  const { preferences } = useWorkspacePreferences();
  const reduced = systemReduced || preferences.motion === "reduced";

  return <motion.span
    aria-hidden="true"
    className={`entropy-selection-indicator is-${variant}`}
    layoutId={reduced ? undefined : id}
    initial={false}
    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42, mass: 0.7 }}
  />;
}
