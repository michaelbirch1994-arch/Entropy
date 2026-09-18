import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import InsightEvidenceDetails from './InsightEvidenceDetails';

describe('Insight readiness evidence details', () => {
  it('renders the measurement ledger and keeps the full record collapsed', () => {
    const markup = renderToStaticMarkup(<InsightEvidenceDetails data={{ selectedEvidence: {
      methodVersion: 'readiness-v3', timeMs: 6000, selection: 'Calculated candidate',
      analysisAnchor: { label: 'Enemy-player activity 2', scope: 'recorded-enemy-players', evidenceStatus: 'calculated', resolutionMs: 1000 },
      results: [{ name: 'Stability', total: 3, present: 1, absent: 1, unknown: 1, observedCoverage: .5, evidenceCoverage: 2 / 3, bounds: [1 / 3, 2 / 3] }],
      boundarySensitivity: { boundsMs: [6000, 6999], results: [{ name: 'Stability', observedCoverageRange: [.5, 1], fullSquadBoundsEnvelope: [1 / 3, 1], boundarySensitive: true }] },
      continuity: { boon: 'Stability', before: { startMs: 3000, endMs: 6000, observedCoverage: .5, evidenceCoverage: .75, bounds: [.25, .75] }, after: { startMs: 6000, endMs: 9000, observedCoverage: 1, evidenceCoverage: .75, bounds: [.75, 1] } },
      limitations: ['Missing states remain unknown.'],
    } }}/>);
    expect(markup).toContain('Squad boon-state measurements');
    expect(markup).toContain('50%–100%');
    expect(markup).toContain('Changes inside bin');
    expect(markup).toContain('<summary>Full evidence record</summary>');
    expect(markup).not.toContain('<h4>Selected Evidence</h4>');
  });
});
