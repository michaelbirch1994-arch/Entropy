import { useId, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import ProfessionIcon from "./ProfessionIcon";
import { fmtNum, PROFESSION_FAMILY, normalizeProfessionLabel } from "../../utils/format";

export type RankedMetricEntry = {
  account: string;
  profession: string;
  value: number;
};

export default function RankedMetricList({ entries, metric, onOpen }: {
  entries: RankedMetricEntry[];
  metric: string;
  onOpen: (entry: RankedMetricEntry) => void;
}) {
  const labelId = useId();
  const max = Math.max(...entries.map((entry) => entry.value), 0);
  return (
    <div className="entropy-ranked-metrics">
      <span id={labelId} className="sr-only">{metric}</span>
      {entries.length ? <ol aria-labelledby={labelId}>
        {entries.map((entry, index) => (
          <li key={entry.account} data-profession-family={PROFESSION_FAMILY[normalizeProfessionLabel(entry.profession)] ?? "default"}>
            <button type="button" onClick={() => onOpen(entry)} aria-label={`View ${entry.account} for ${metric}`}>
              <span className="entropy-ranked-place">{String(index + 1).padStart(2, "0")}</span>
              <span className="entropy-ranked-emblem" aria-hidden="true"><ProfessionIcon profession={entry.profession} /></span>
              <span className="entropy-ranked-identity"><strong>{entry.account}</strong><small>{entry.profession}</small></span>
              <strong className="entropy-ranked-value">{fmtNum(entry.value)}</strong>
              <ArrowUpRight size={14} aria-hidden="true" />
              <span className="entropy-ranked-track" aria-hidden="true"><span style={{ "--ranked-fill": `${max > 0 ? entry.value / max * 100 : 0}%` } as CSSProperties} /></span>
            </button>
          </li>
        ))}
      </ol> : <p className="entropy-ranked-empty">No recorded {metric.toLowerCase()}.</p>}
    </div>
  );
}
