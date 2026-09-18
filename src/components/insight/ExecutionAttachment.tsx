import { ArrowLeft, FileSearch } from 'lucide-react';
import type { InsightEvidence } from '../../lib/insight/evidence';

export default function ExecutionAttachment({ record, onInspect, onReturn }: {
  record: InsightEvidence; onInspect: () => void; onReturn: () => void;
}) {
  const data = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : null;
  const context = data?.executionContext && typeof data.executionContext === 'object' ? data.executionContext as Record<string, unknown> : null;
  return <section className="execution-attachment" aria-label="Attached combat evidence">
    <div><strong>{record.id} · {record.label}</strong>
      {context && <p>Fight {String(context.fightId ?? 'unknown')} · {typeof context.timeMs === 'number' ? `${(context.timeMs / 1000).toFixed(1)}s` : 'Unknown time'} · Focused player {String(context.account ?? 'unknown')}</p>}
      <small>Attached moment evidence is separate from the investigation roster's report-wide player context.</small>
    </div><div><button type="button" onClick={onInspect}><FileSearch size={15}/> Inspect evidence</button><button type="button" onClick={onReturn}><ArrowLeft size={15}/> Return to moment</button></div>
  </section>;
}
