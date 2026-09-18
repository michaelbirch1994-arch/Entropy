import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EvidenceProvenance from './EvidenceProvenance';

describe('EvidenceProvenance', () => {
  it('separates source tiers and preserves reference links', () => {
    const html = renderToStaticMarkup(<EvidenceProvenance items={[
      { id: 'event', kind: 'recorded-event', label: 'Recorded cast', detail: 'Cast at 12.4 seconds.' },
      { id: 'parser', kind: 'parser-derived-state', label: 'Effect state', detail: 'Alacrity was active.' },
      { id: 'api', kind: 'arena-net-api', label: 'Base skill facts', detail: 'Skill identity and recharge.', source: 'https://api.guildwars2.com/v2/skills/9153' },
      { id: 'inference', kind: 'bounded-inference', label: 'Cooldown estimate', detail: 'Ready inside the modeled interval.' },
    ]} title="Response evidence chain"/>);

    expect(html).toContain('Response evidence chain');
    expect(html).toContain('1 observed · 1 derived · 1 reference · 1 inferred');
    expect(html).toContain('data-tier="observed"');
    expect(html).toContain('data-tier="inferred"');
    expect(html).toContain('https://api.guildwars2.com/v2/skills/9153');
  });

  it('renders nothing without evidence', () => {
    expect(renderToStaticMarkup(<EvidenceProvenance items={[]}/>)).toBe('');
  });
});
