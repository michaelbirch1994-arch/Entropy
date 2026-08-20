import ReplayIntelligenceAnchorRail from "../components/replay/ReplayIntelligenceAnchorRail";
import ReplayViewV2 from "./ReplayViewV2";

export default function ReplayView() {
  return (
    <div className="space-y-4">
      <ReplayIntelligenceAnchorRail />
      <ReplayViewV2 />
    </div>
  );
}
