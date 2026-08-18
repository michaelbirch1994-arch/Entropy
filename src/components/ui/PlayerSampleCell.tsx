import { getSampleReliability, sampleReliabilityClasses } from "../../lib/sampleReliability";
import type { PlayerSampleContextData } from "../../lib/playerSampleContext";
import { fmtDur } from "../../utils/format";

export default function PlayerSampleCell({ sample }: { sample: PlayerSampleContextData }) {
  if (!sample.known) {
    return (
      <span
        className="text-[10px] font-normal text-theme-muted"
        title="This archived report predates participation coverage. Re-import its logs to calculate a reliable sample."
      >
        Coverage unavailable
      </span>
    );
  }

  const reliability = getSampleReliability(sample.fights, sample.totalFights, sample.activeMs);

  return (
    <div className="min-w-[148px] text-right font-mono" title={reliability.detail}>
      <div className="whitespace-nowrap font-bold text-theme-text/85">
        {sample.fights}/{sample.totalFights} fights
        <span className="ml-1 text-[9px] font-normal text-theme-muted">
          ({Math.round(reliability.coverage * 100)}%)
        </span>
      </div>
      <div className="mt-1 flex items-center justify-end gap-1.5 whitespace-nowrap text-[9px] text-theme-muted">
        <span>{fmtDur(sample.activeMs)} active</span>
        <span className={`rounded-full border px-1.5 py-0.5 font-bold ${sampleReliabilityClasses(reliability.level)}`}>
          {reliability.label}
        </span>
      </div>
    </div>
  );
}
