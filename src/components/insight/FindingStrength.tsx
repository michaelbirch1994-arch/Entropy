const dimensions = [
  ['directness', 'Direct evidence'], ['scope', 'Player and time match'],
  ['alternatives', 'Alternative explanations'], ['completeness', 'Essential data'],
] as const;

export interface FindingRating {
  assessment?: Record<typeof dimensions[number][0], { points: number; reason: string; evidenceIds: string[] }>;
  strength?: { percent: number; earnedPoints: number; totalPoints: number; method: string; label: string; calibrated: boolean };
}

export default function FindingStrength({ finding, onEvidence }: { finding: FindingRating; onEvidence: (id: string) => void }) {
  const { assessment, strength } = finding;
  if (!assessment || !strength || !Number.isFinite(strength.percent)) return <p className="finding-strength-legacy">This answer predates numeric scoring. Run the investigation again for a rated answer.</p>;
  return <details className="finding-strength">
    <summary><strong>{strength.percent}%</strong><span>AI evidence strength<small>{strength.earnedPoints} / {strength.totalPoints} rubric points</small></span></summary>
    <p>AI judgment of the evidence, not a measured probability that the answer is correct or that a rescue would succeed. Four equally weighted checks, each scored 0 (missing), 1 (partial), or 2 (supported).</p>
    <dl>{dimensions.map(([key, label]) => <div key={key}><dt>{label}<b>{assessment[key].points}/2</b></dt><dd>{assessment[key].reason}<span className="insight-citations">{assessment[key].evidenceIds.map(id => <button type="button" key={id} onClick={() => onEvidence(id)} aria-label={`Open evidence ${id} for ${label}`}>{id}</button>)}</span></dd></div>)}</dl>
  </details>;
}
