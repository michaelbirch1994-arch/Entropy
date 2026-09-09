import { AlignJustify, Rows3, Monitor, Contrast } from "lucide-react";
import WorkspaceDialog from "../ui/WorkspaceDialog";
import { SegmentedControl } from "../ui/SegmentedControl";
import { useWorkspacePreferences } from "../../theme/WorkspacePreferences";

export default function AppearanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { preferences, updatePreference } = useWorkspacePreferences();
  return <WorkspaceDialog open={open} onClose={onClose} title="Workspace appearance">
    <div className="entropy-settings-body">
      <section className="entropy-setting">
        <h3>Table density</h3>
        <SegmentedControl ariaLabel="Table density" value={preferences.density} onChange={(value) => updatePreference("density", value)} options={[
          { value: "comfortable", label: "Comfortable", icon: <Rows3 size={16} /> },
          { value: "compact", label: "Compact", icon: <AlignJustify size={16} /> },
        ]} />
      </section>
      <section className="entropy-setting">
        <h3>Contrast</h3>
        <SegmentedControl ariaLabel="Workspace contrast" value={preferences.contrast} onChange={(value) => updatePreference("contrast", value)} options={[
          { value: "standard", label: "Standard", icon: <Monitor size={16} /> },
          { value: "high", label: "High", icon: <Contrast size={16} /> },
        ]} />
      </section>
      <label className="entropy-setting entropy-setting-toggle">
        <span>Reduce motion</span>
        <input type="checkbox" role="switch" checked={preferences.motion === "reduced"} onChange={(event) => updatePreference("motion", event.target.checked ? "reduced" : "system")} />
      </label>
    </div>
  </WorkspaceDialog>;
}
