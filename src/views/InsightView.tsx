import { Sparkles } from 'lucide-react';
import { useReport } from '../store/ReportContext';
import '../Styles/InsightWorkspace.css';
import SquadExecution from '../components/insight/SquadExecution';

export default function InsightView() {
  const { report } = useReport();

  return <div className="insight-workspace">
    <header className="insight-heading">
      <div>
        <span className="insight-eyebrow"><Sparkles size={14} /> ENTROPY / COMBAT INTELLIGENCE</span>
        <h1>Insight<span>.</span></h1>
        <p>Understand the fight. Find the next improvement.</p>
      </div>
    </header>
    <main className="insight-main">
      {report ? <SquadExecution report={report} /> : <p>No report is loaded. Upload combat data to open Squad Execution.</p>}
    </main>
  </div>;
}
