import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Crosshair, Gauge, Shield, ShieldCheck, Sparkles, UserRoundSearch, Users, Zap } from 'lucide-react';
import type { Gw2Skill } from '../../types/buildEditor';
import type { WvWReport } from '../../types/report';
import { fetchGw2Skills } from '../../lib/gw2/gw2Api';
import { buildUtilityEffectiveness, utilityEffectivenessSkillIds } from '../../lib/insight/utilityEffectiveness';
import { classIconSrc } from '../../data/classIconAssets';
import './UtilityEffectiveness.css';

const percent = (value: number | null) => value === null ? 'No sample' : `${Math.round(value * 100)}%`;
const range = (value: [number, number] | null) => value === null ? 'No range' : `${Math.round(value[0] * 100)}–${Math.round(value[1] * 100)}%`;
const seconds = (value: number | null, digits = 2) => value === null ? 'Unavailable' : `${value.toFixed(digits)}s`;
const timestamp = (value: number) => {
  const totalSeconds = Math.max(0, value) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${(totalSeconds % 60).toFixed(1).padStart(4, '0')}`;
};

export default function UtilityEffectiveness({ report, fightId, onPlayer, onMoment }: {
  report: WvWReport;
  fightId: string;
  onPlayer: (account: string) => void;
  onMoment: (account: string, skillId: number, timeMs: number) => void;
}) {
  const [mode, setMode] = useState<'stability' | 'resistance' | 'aegis' | 'stunbreak'>('stability');
  const [selectedProvider, setSelectedProvider] = useState<Partial<Record<'stability' | 'resistance' | 'aegis' | 'stunbreak', string>>>({});
  const [selectedResistanceCondition, setSelectedResistanceCondition] = useState<string | null>(null);
  const skillIds = useMemo(() => utilityEffectivenessSkillIds(report, fightId), [report, fightId]);
  const referenceKey = skillIds.join(',');
  const [references, setReferences] = useState<{ key: string; skills: Gw2Skill[]; failed: boolean }>();
  useEffect(() => {
    let live = true;
    if (!skillIds.length) { setReferences({ key: referenceKey, skills: [], failed: false }); return () => { live = false; }; }
    fetchGw2Skills(skillIds).then(skills => { if (live) setReferences({ key: referenceKey, skills, failed: false }); })
      .catch(() => { if (live) setReferences({ key: referenceKey, skills: [], failed: true }); });
    return () => { live = false; };
  }, [referenceKey]);
  const currentReferences = references?.key === referenceKey ? references.skills : [];
  const loading = Boolean(skillIds.length && references?.key !== referenceKey);
  const model = useMemo(() => buildUtilityEffectiveness(report, fightId, currentReferences), [report, fightId, currentReferences]);
  const stabilityIsEstimated = model.coverage.incomingControlSource === 'mechanic-boon-inference';
  const aegisIsEstimated = model.coverage.incomingAttackSource === 'boon-transition-inference';
  const totalBreaks = model.stunbreak.reduce((sum, row) => sum + row.confirmedBreaks, 0);
  const removedSeconds = model.stunbreak.reduce((sum, row) => sum + row.removedControlSeconds, 0);
  const totalResponses = model.stunbreak.reduce((sum, row) => sum + row.correlatedResponses, 0);
  const weightedDelay = model.stunbreak.reduce((sum, row) => sum + (row.averageCorrelatedDelayMs ?? 0) * row.correlatedResponses, 0);
  const activeResistanceCondition = selectedResistanceCondition
    && model.overall.resistance.conditions.some(entry => entry.condition === selectedResistanceCondition)
    ? selectedResistanceCondition : null;
  const resistanceConditionSummary = activeResistanceCondition
    ? model.overall.resistance.conditions.find(entry => entry.condition === activeResistanceCondition) : undefined;
  const resistanceSummary = resistanceConditionSummary ?? model.overall.resistance;
  const resistanceRows = activeResistanceCondition
    ? model.resistance.filter(row => row.conditions.some(entry => entry.condition === activeResistanceCondition))
    : model.resistance;
  const selectedStability = model.stability.find(row => row.account === selectedProvider.stability) ?? model.stability[0];
  const selectedResistance = resistanceRows.find(row => row.account === selectedProvider.resistance) ?? resistanceRows[0];
  const selectedResistanceMetric = activeResistanceCondition
    ? selectedResistance?.conditions.find(entry => entry.condition === activeResistanceCondition)
    : selectedResistance;
  const selectedResistanceApplications = selectedResistance?.applications.filter(application => !activeResistanceCondition
    || application.conditions.some(entry => entry.condition === activeResistanceCondition)) ?? [];
  const selectedAegis = model.aegis.find(row => row.account === selectedProvider.aegis) ?? model.aegis[0];
  const selectedStunbreak = model.stunbreak.find(row => row.account === selectedProvider.stunbreak)
    ?? model.stunbreak.find(row => row.responseEvents.length > 0)
    ?? model.stunbreak[0];

  return <section className="utility-effectiveness" aria-label="Utility effectiveness chart">
    <header className="utility-effectiveness-head">
      <div><span><Sparkles size={15}/> OUTCOME-AWARE SUPPORT</span><h2>Utility effectiveness</h2><p>Reconstructs what defensive utility accomplished at the moment pressure arrived.</p></div>
      <nav aria-label="Utility effectiveness view">
        <button type="button" aria-pressed={mode === 'stability'} onClick={() => setMode('stability')}><ShieldCheck size={16}/> Stability</button>
        <button type="button" aria-pressed={mode === 'resistance'} onClick={() => setMode('resistance')}><Activity size={16}/> Resistance</button>
        <button type="button" aria-pressed={mode === 'aegis'} onClick={() => setMode('aegis')}><Shield size={16}/> Aegis</button>
        <button type="button" aria-pressed={mode === 'stunbreak'} onClick={() => setMode('stunbreak')}><Zap size={16}/> Stun breaks</button>
      </nav>
    </header>

    <div className="utility-scoreboard" data-mode={mode}>
      {mode === 'stability' ? <>
        <div><Gauge size={18}/><span><small>{stabilityIsEstimated ? 'ESTIMATED EFFECT' : 'REALIZED EFFECT'}</small><strong>{percent(model.overall.stability.effectiveRating)}</strong><em>{model.overall.stability.coveredControls}/{model.overall.stability.eligibleControls} {stabilityIsEstimated ? 'candidate consumptions or landed controls' : 'resolved contests intercepted'}</em></span></div>
        <div><ShieldCheck size={18}/><span><small>{stabilityIsEstimated ? 'STATE READINESS' : 'THREAT READINESS'}</small><strong>{percent(model.overall.stability.readinessRating)}</strong><em>{model.overall.stability.protectedAttempts}/{model.overall.stability.knownThreatAttempts} known events · {model.overall.stability.unknownThreatAttempts} unknown · range {range(model.overall.stability.readinessBounds)}</em></span></div>
        <div><Activity size={18}/><span><small>{stabilityIsEstimated ? 'TIMELINE COVERAGE' : 'EVIDENCE COVERAGE'}</small><strong>{percent(model.coverage.evidenceCoverage)}</strong><em>{stabilityIsEstimated ? `${model.coverage.stabilityTrackedPlayers}/${model.coverage.replayRosterPlayers} player Stability timelines` : `${model.coverage.incomingControlAttempts} classified attempts · ${model.coverage.unresolvedAttempts} unresolved`}</em></span></div>
      </> : mode === 'resistance' ? <>
        <div><Gauge size={18}/><span><small>{activeResistanceCondition ? `${activeResistanceCondition.toUpperCase()} SUPPRESSION` : 'SUPPRESSED PRESSURE'}</small><strong>{percent(resistanceSummary.effectiveRating)}</strong><em>{seconds(resistanceSummary.suppressedConditionMs / 1000, 1)} of {seconds(resistanceSummary.conditionPressureMs / 1000, 1)} observed condition time</em></span></div>
        <div><ShieldCheck size={18}/><span><small>ARRIVAL READINESS</small><strong>{percent(resistanceSummary.readinessRating)}</strong><em>{resistanceSummary.coveredArrivals}/{resistanceSummary.knownArrivals} known arrivals · {resistanceSummary.unknownArrivals} unknown · range {range(resistanceSummary.readinessBounds)}</em></span></div>
        <div><Activity size={18}/><span><small>OBSERVED EVIDENCE</small><strong>{resistanceConditionSummary ? resistanceConditionSummary.affectedPlayers : model.coverage.observedConditionIntervals}</strong><em>{resistanceConditionSummary ? `players affected · ${resistanceConditionSummary.conditionArrivals} arrivals` : `${model.coverage.conditionTrackedPlayers} condition · ${model.coverage.resistanceTrackedPlayers} Resistance player timelines`}</em></span></div>
      </> : mode === 'aegis' ? <>
        <div><Gauge size={18}/><span><small>{aegisIsEstimated ? 'ESTIMATED CONVERSION' : 'CAST CONVERSION'}</small><strong>{percent(model.overall.aegis.castConversion)}</strong><em>{model.overall.aegis.realizedCasts}/{model.overall.aegis.casts} casts {aegisIsEstimated ? 'had an early Aegis consumption' : 'produced a uniquely attributable block'}</em></span></div>
        <div><Shield size={18}/><span><small>{aegisIsEstimated ? 'CANDIDATE CONSUMPTIONS' : 'CONFIRMED BLOCKS'}</small><strong>{aegisIsEstimated ? model.overall.aegis.inferredConsumptions : model.overall.aegis.confirmedBlocks}</strong><em>{aegisIsEstimated ? 'early removals; native hit result unavailable' : `${model.coverage.ambiguousAegisBlocks} blocks retained without provider credit`}</em></span></div>
        <div><Activity size={18}/><span><small>{aegisIsEstimated ? 'TIMELINE COVERAGE' : 'ATTACK READINESS'}</small><strong>{percent(aegisIsEstimated ? model.overall.aegis.evidenceCoverage : model.overall.aegis.readinessRating)}</strong><em>{aegisIsEstimated ? `${model.coverage.aegisTrackedPlayers}/${model.coverage.replayRosterPlayers} player Aegis timelines` : `${model.overall.aegis.readyAttempts}/${model.overall.aegis.knownThreatAttempts} known attacks · ${model.overall.aegis.unknownThreatAttempts} unknown · range ${range(model.overall.aegis.readinessBounds)}`}</em></span></div>
      </> : <>
        <div><Zap size={18}/><span><small>CONFIRMED BREAKS</small><strong>{totalBreaks}</strong><em>Elite Insights report aggregate</em></span></div>
        <div><ShieldCheck size={18}/><span><small>CONTROL PREVENTED</small><strong>{seconds(removedSeconds, 1)}</strong><em>{totalBreaks ? seconds(removedSeconds / totalBreaks) : 'Unavailable'} per break</em></span></div>
        <div><Clock3 size={18}/><span><small>CORRELATED DELAY</small><strong>{totalResponses ? seconds(weightedDelay / totalResponses / 1000) : 'Unavailable'}</strong><em>{totalResponses} event-to-cast matches</em></span></div>
      </>}
    </div>

    {mode === 'resistance' && model.overall.resistance.conditions.length ? <section className="utility-condition-lens" aria-label="Resistance condition lens">
      <header><span><Crosshair size={14}/> CONDITION LENS</span><small>Filter every rating and evidence window by the pressure Resistance neutralized</small></header>
      <div role="list">
        <button type="button" role="listitem" aria-pressed={!activeResistanceCondition} onClick={() => setSelectedResistanceCondition(null)}>
          <span>All pressure</span><strong>{percent(model.overall.resistance.effectiveRating)}</strong><small>{seconds(model.overall.resistance.suppressedConditionMs / 1000, 1)} suppressed · {percent(model.overall.resistance.readinessRating)} of known arrivals ready</small>
        </button>
        {model.overall.resistance.conditions.map(condition => <button type="button" role="listitem" key={condition.condition} aria-pressed={activeResistanceCondition === condition.condition} onClick={() => setSelectedResistanceCondition(condition.condition)}>
          <span>{condition.condition}</span><strong>{percent(condition.effectiveRating)}</strong><small>{seconds(condition.suppressedConditionMs / 1000, 1)} / {seconds(condition.conditionPressureMs / 1000, 1)} · {condition.coveredArrivals}/{condition.knownArrivals} known arrivals{condition.unknownArrivals ? ` · ${condition.unknownArrivals} unknown` : ''}</small>
        </button>)}
      </div>
      {resistanceConditionSummary ? <aside className="utility-condition-sources" aria-label={`${resistanceConditionSummary.condition} hostile source candidates`}>
        <header><span><Crosshair size={13}/> HOSTILE SOURCE ATTRIBUTION</span><small>{resistanceConditionSummary.verifiedArrivals} API-verified · {resistanceConditionSummary.candidateArrivals} timing candidates · {resistanceConditionSummary.ambiguousArrivals} ambiguous</small></header>
        <div>
          {resistanceConditionSummary.sources.length ? resistanceConditionSummary.sources.slice(0, 6).map(source => <article key={source.skillId}>
            {source.icon ? <img src={source.icon} alt=""/> : <span className="utility-source-fallback"><Activity size={16}/></span>}
            <span><strong>{source.skillName}</strong><em>{source.matchedArrivals} attributed · {source.unprotectedArrivals} without Resistance{source.unknownArrivals ? ` · ${source.unknownArrivals} state unknown` : ''}</em><small>{Math.round(source.averageCertainty)}% attribution certainty · {source.referenceSource === 'timing-candidate' ? 'timing candidate, API effect unverified' : source.referenceSource.replaceAll('-', ' ')}{source.sourceNames.length ? ` · ${source.sourceNames.join(', ')}` : ''}</small></span>
          </article>) : <p>{model.coverage.incomingSkillEvents === 0
            ? 'This saved report has no native hostile-hit timeline. Re-import the original ZEVTC to enable source attribution; the condition and Resistance timing shown here remains measured.'
            : 'Native hostile hits are present, but no unique hit could be linked to these arrivals. The condition timing remains measured; its source stays unknown.'}</p>}
        </div>
      </aside> : null}
    </section> : null}

    <section className="utility-subgroup-summary" aria-label={`${mode === 'stability' ? 'Stability' : mode === 'resistance' ? 'Resistance' : mode === 'aegis' ? 'Aegis' : 'Stun-break'} effectiveness by subgroup`}>
      <header><span><Users size={14}/> SUBGROUP EFFECTIVENESS</span><small>Same-party event/provider scope · Overall preserves cross-party support</small></header>
      <div role="list">
        {[...model.subgroups, model.overall].map(scope => {
          const scopedResistanceCondition = activeResistanceCondition
            ? scope.resistance.conditions.find(entry => entry.condition === activeResistanceCondition) : undefined;
          const scopedResistance = activeResistanceCondition ? scopedResistanceCondition : scope.resistance;
          const rating = mode === 'stability' ? scope.stability.effectiveRating : mode === 'resistance' ? scopedResistance?.effectiveRating ?? null
            : mode === 'aegis' ? scope.aegis.castConversion : scope.stunbreak.effectiveRating;
          const providers = mode === 'stability' ? scope.stability.providerAccounts : mode === 'resistance' ? scope.resistance.providerAccounts
            : mode === 'aegis' ? scope.aegis.providerAccounts : scope.stunbreak.providerAccounts;
          const resultLabel = mode === 'stability'
            ? `${scope.stability.coveredControls}/${scope.stability.eligibleControls} ${stabilityIsEstimated ? 'candidate consumptions or landed controls' : 'resolved contests intercepted'}`
            : mode === 'resistance'
              ? `${seconds((scopedResistance?.suppressedConditionMs ?? 0) / 1000, 1)} / ${seconds((scopedResistance?.conditionPressureMs ?? 0) / 1000, 1)} ${activeResistanceCondition ?? 'pressure'} suppressed`
              : mode === 'aegis' ? `${scope.aegis.realizedCasts}/${scope.aegis.casts} casts converted`
                : `${scope.stunbreak.matchedResponses}/${scope.stunbreak.eligibleControls} responses matched`;
          return <article role="listitem" key={scope.key} data-overall={scope.group === null}>
            <span><strong>{scope.label}</strong><small>{scope.memberCount} member{scope.memberCount === 1 ? '' : 's'} · {providers.length} observed provider{providers.length === 1 ? '' : 's'}</small></span>
            <i><b style={{ width: `${(rating ?? 0) * 100}%` }}/></i>
            <strong>{percent(rating)}</strong>
            <em>{resultLabel}</em>
            <small>{mode === 'stability'
              ? `${percent(scope.stability.readinessRating)} of known events ready · ${scope.stability.unknownThreatAttempts} unknown · range ${range(scope.stability.readinessBounds)}`
              : mode === 'resistance'
                ? `${percent(scopedResistance?.readinessRating ?? null)} of known arrivals ready · ${scopedResistance?.unknownArrivals ?? 0} unknown · range ${range(scopedResistance?.readinessBounds ?? null)}`
              : mode === 'aegis' ? (aegisIsEstimated
                ? `${scope.aegis.inferredConsumptions} candidate consumptions · ${percent(scope.aegis.evidenceCoverage)} timeline coverage`
                : `${scope.aegis.confirmedBlocks} confirmed blocks · ${percent(scope.aegis.readinessRating)} of known attacks ready · ${scope.aegis.unknownThreatAttempts} unknown`)
              : `${scope.stunbreak.confirmedBreaks} confirmed breaks · ${seconds(scope.stunbreak.averageCorrelatedDelayMs === null ? null : scope.stunbreak.averageCorrelatedDelayMs / 1000)} response`}</small>
          </article>;
        })}
      </div>
    </section>

    <div className="utility-workspace">
      {mode === 'stability' ? <div className="utility-chart" role="table" aria-label="Stability effectiveness by player">
        <div className="utility-chart-header" role="row"><span>Provider</span><span>{stabilityIsEstimated ? 'Estimated effect' : 'Realized effect'}</span><span>{stabilityIsEstimated ? 'State readiness' : 'Threat readiness'}</span><span>Generation efficiency</span></div>
        <div className="utility-chart-rows">
          {model.stability.length ? model.stability.map(row => <button type="button" role="row" aria-selected={selectedStability?.account === row.account} key={row.account} onClick={() => setSelectedProvider(current => ({ ...current, stability: row.account }))}>
            <span className="utility-provider" role="cell"><img src={classIconSrc(row.profession)} alt=""/><i><strong>{row.account}</strong><small>{row.group > 0 ? `Party ${row.group}` : 'Unassigned'} · {row.profession} · {row.skills.map(skill => skill.name).join(', ')}</small></i></span>
            <span className="utility-rating" role="cell" data-label={stabilityIsEstimated ? 'Estimated effect' : 'Realized effect'}><i><b style={{ width: `${(row.realizedEffectiveness ?? 0) * 100}%` }}/></i><strong>{percent(row.realizedEffectiveness)}</strong><small>{stabilityIsEstimated ? row.inferredInterceptions : row.realizedInterceptions}/{row.resolvedControlContests} {stabilityIsEstimated ? 'candidate consumptions and landed controls' : 'contests uniquely attributed'}</small></span>
            <span role="cell" data-label={stabilityIsEstimated ? 'State readiness' : 'Threat readiness'}><strong>{percent(row.readinessRating)}</strong><small>{row.protectedAttempts}/{row.knownThreatAttempts} known events · {row.unknownThreatAttempts} unknown · range {range(row.readinessBounds)}</small></span>
            <span role="cell" data-label="Generation efficiency"><strong>{percent(row.generationEfficiency)}</strong><small>{row.generatedStackSeconds === null ? 'Aggregate unavailable' : `${Math.round(row.generatedStackSeconds)} generated · ${Math.round(row.wastedStackSeconds ?? 0)} wasted stack-s`}</small></span>
          </button>) : <p className="utility-empty">{loading ? 'Loading skill references…' : 'No recorded Stability-granting casts could be established for this fight.'}</p>}
        </div>
      </div> : mode === 'resistance' ? <div className="utility-chart" role="table" aria-label="Resistance effectiveness by player">
        <div className="utility-chart-header" role="row"><span>Provider</span><span>{activeResistanceCondition ? `${activeResistanceCondition} suppression` : 'Suppressed pressure'}</span><span>Arrival readiness</span><span>Generation efficiency</span></div>
        <div className="utility-chart-rows">
          {resistanceRows.length ? resistanceRows.map(row => {
            const metric = activeResistanceCondition
              ? row.conditions.find(entry => entry.condition === activeResistanceCondition)! : row;
            return <button type="button" role="row" aria-selected={selectedResistance?.account === row.account} key={row.account} onClick={() => setSelectedProvider(current => ({ ...current, resistance: row.account }))}>
              <span className="utility-provider" role="cell"><img src={classIconSrc(row.profession)} alt=""/><i><strong>{row.account}</strong><small>{row.group > 0 ? `Party ${row.group}` : 'Unassigned'} · {row.profession} · {row.skills.map(skill => skill.name).join(', ')}</small></i></span>
              <span className="utility-rating" role="cell" data-label="Suppressed pressure"><i><b style={{ width: `${(metric.effectiveRating ?? 0) * 100}%` }}/></i><strong>{percent(metric.effectiveRating)}</strong><small>{seconds(metric.suppressedConditionMs / 1000, 1)} of {seconds(metric.conditionPressureMs / 1000, 1)} inside correlated cast windows</small></span>
              <span role="cell" data-label="Arrival readiness"><strong>{percent(metric.readinessRating)}</strong><small>{metric.coveredArrivals}/{metric.knownArrivals} known arrivals · {metric.unknownArrivals} unknown · range {range(metric.readinessBounds)}</small></span>
              <span role="cell" data-label="Generation efficiency"><strong>{percent(row.generationEfficiency)}</strong><small>{row.generatedSeconds === null ? 'Aggregate unavailable' : `${Math.round(row.generatedSeconds)} generated · ${Math.round(row.wastedSeconds ?? 0)} wasted seconds`}</small></span>
            </button>;
          }) : <p className="utility-empty">{loading ? 'Loading skill references…' : `No recorded allied Resistance cast overlapped ${activeResistanceCondition ?? 'condition pressure'} in this fight.`}</p>}
        </div>
      </div> : mode === 'aegis' ? <div className="utility-chart" role="table" aria-label="Aegis effectiveness by player">
        <div className="utility-chart-header" role="row"><span>Provider</span><span>{aegisIsEstimated ? 'Estimated conversion' : 'Cast conversion'}</span><span>{aegisIsEstimated ? 'Candidate impact' : 'Confirmed impact'}</span><span>{aegisIsEstimated ? 'Evidence basis' : 'Attack readiness'}</span></div>
        <div className="utility-chart-rows">
          {model.aegis.length ? model.aegis.map(row => <button type="button" role="row" aria-selected={selectedAegis?.account === row.account} key={row.account} onClick={() => setSelectedProvider(current => ({ ...current, aegis: row.account }))}>
            <span className="utility-provider" role="cell"><img src={classIconSrc(row.profession)} alt=""/><i><strong>{row.account}</strong><small>{row.group > 0 ? `Party ${row.group}` : 'Unassigned'} · {row.profession} · {row.skills.map(skill => skill.name).join(', ')}</small></i></span>
            <span className="utility-rating" role="cell" data-label={aegisIsEstimated ? 'Estimated conversion' : 'Cast conversion'}><i><b style={{ width: `${(row.castConversion ?? 0) * 100}%` }}/></i><strong>{percent(row.castConversion)}</strong><small>{row.realizedCasts}/{row.casts} casts {aegisIsEstimated ? 'had candidate consumption' : 'produced a block'}</small></span>
            <span role="cell" data-label={aegisIsEstimated ? 'Candidate impact' : 'Confirmed impact'}><strong>{aegisIsEstimated ? `${row.inferredConsumptions} consumptions` : `${row.confirmedBlocks} blocks`}</strong><small>{aegisIsEstimated ? 'Early Aegis removals, not confirmed blocks' : `${row.otherBlocks} other blocks · ${row.otherDefenses} other defenses`}</small></span>
            <span role="cell" data-label={aegisIsEstimated ? 'Evidence basis' : 'Attack readiness'}><strong>{aegisIsEstimated ? percent(model.overall.aegis.evidenceCoverage) : percent(row.readinessRating)}</strong><small>{aegisIsEstimated ? 'Player Aegis timeline coverage' : `${row.readyAttempts}/${row.knownThreatAttempts} known attacks · ${row.unknownThreatAttempts} unknown · range ${range(row.readinessBounds)}`}</small></span>
          </button>) : <p className="utility-empty">{loading ? 'Loading skill references…' : 'No recorded allied Aegis-granting casts could be established for this fight.'}</p>}
        </div>
      </div> : <div className="utility-chart" role="table" aria-label="Stun-break effectiveness by player">
        <div className="utility-chart-header" role="row"><span>Provider</span><span>Confirmed impact</span><span>Average prevented</span><span>Correlated response</span></div>
        <div className="utility-chart-rows">
          {model.stunbreak.length ? model.stunbreak.map(row => <button type="button" role="row" aria-selected={selectedStunbreak?.account === row.account} key={row.account} onClick={() => setSelectedProvider(current => ({ ...current, stunbreak: row.account }))}>
            <span className="utility-provider" role="cell"><img src={classIconSrc(row.profession)} alt=""/><i><strong>{row.account}</strong><small>{row.group > 0 ? `Party ${row.group}` : 'Unassigned'} · {row.profession}{row.skills.length ? ` · ${row.skills.map(skill => skill.name).join(', ')}` : ' · no selected-fight skill match'}</small></i></span>
            <span role="cell" data-label="Confirmed impact"><strong>{row.confirmedBreaks} breaks</strong><small>{seconds(row.removedControlSeconds, 1)} total control prevented</small></span>
            <span role="cell" data-label="Average prevented"><strong>{seconds(row.averagePreventedSeconds)}</strong><small>remaining duration removed per break</small></span>
            <span role="cell" data-label="Correlated response"><strong>{seconds(row.averageCorrelatedDelayMs === null ? null : row.averageCorrelatedDelayMs / 1000)}</strong><small>{row.correlatedResponses}/{model.coverage.targetableControlEvents} event-to-cast matches</small></span>
          </button>) : <p className="utility-empty">{loading ? 'Loading skill references…' : 'No stun-break totals or allied stun-break casts are available in this report.'}</p>}
        </div>
      </div>}

      {mode === 'stability' && selectedStability ? <aside className="utility-evidence" aria-label={`${selectedStability.account} Stability evidence`}>
        <header><span><Crosshair size={14}/> APPLICATION EVIDENCE</span><h3>{selectedStability.account}</h3><p>{stabilityIsEstimated
          ? `${selectedStability.inferredInterceptions} candidate stack consumptions across ${selectedStability.threatAttempts} inferred contests.`
          : `${selectedStability.realizedInterceptions} uniquely attributed interceptions across ${selectedStability.threatAttempts} observed attempts.`}</p><button type="button" onClick={() => onPlayer(selectedStability.account)}><UserRoundSearch size={15}/> Open palette</button></header>
        <div className="utility-event-list">
          {selectedStability.applications.map(application => <button type="button" key={application.key} onClick={() => onMoment(selectedStability.account, application.skillId, application.timeMs)}>
            <img src={application.icon || classIconSrc(selectedStability.profession)} alt=""/>
            <span><small>{timestamp(application.timeMs)} · {seconds((application.endMs - application.timeMs) / 1000, 1)} window</small><strong>{application.skillName}</strong><em>{application.controlAttempts.length ? `${application.controlAttempts.length} attempt${application.controlAttempts.length === 1 ? '' : 's'} · ${application.controlAttempts.slice(0, 2).map(event => `${event.skillName} (${event.outcome})`).join(', ')}` : 'No classified incoming CC attempt in this window'}</em></span>
            <i data-active={(stabilityIsEstimated ? application.inferredInterceptions : application.realizedInterceptions) > 0}><b>{stabilityIsEstimated ? application.inferredInterceptions : application.realizedInterceptions}</b><small>{stabilityIsEstimated ? 'candidate' : 'blocked'}</small><b>{application.correlatedRecipientGains}</b><small>gains</small></i>
          </button>)}
        </div>
        <footer>Select an application to inspect its skill and cooldown state at that fight moment.</footer>
      </aside> : null}

      {mode === 'resistance' && selectedResistance ? <aside className="utility-evidence" aria-label={`${selectedResistance.account} Resistance evidence`}>
        <header><span><Activity size={14}/> {activeResistanceCondition ? `${activeResistanceCondition.toUpperCase()} WINDOWS` : 'CORRELATED WINDOWS'}</span><h3>{selectedResistance.account}</h3><p>{seconds((selectedResistanceMetric?.suppressedConditionMs ?? 0) / 1000, 1)} of observed {activeResistanceCondition ?? 'condition'} pressure overlapped Resistance inside this provider’s recorded cast windows.</p><button type="button" onClick={() => onPlayer(selectedResistance.account)}><UserRoundSearch size={15}/> Open palette</button></header>
        <div className="utility-event-list">
          {selectedResistanceApplications.length ? selectedResistanceApplications.map(application => {
            const metric = activeResistanceCondition
              ? application.conditions.find(entry => entry.condition === activeResistanceCondition)! : application;
            return <button type="button" key={application.key} onClick={() => onMoment(selectedResistance.account, application.skillId, application.timeMs)}>
              <img src={application.icon || classIconSrc(selectedResistance.profession)} alt=""/>
              <span><small>{timestamp(application.timeMs)} · {seconds((application.endMs - application.timeMs) / 1000, 1)} reference window</small><strong>{application.skillName}</strong><em>{activeResistanceCondition ? `${metric.coveredArrivals}/${metric.knownArrivals} known ${activeResistanceCondition} arrivals covered${metric.unknownArrivals ? ` · ${metric.unknownArrivals} unknown` : ''}` : application.conditionNames.length ? `${application.conditionNames.join(', ')} · ${application.coveredArrivals}/${application.knownArrivals} known arrivals covered${application.unknownArrivals ? ` · ${application.unknownArrivals} unknown` : ''}` : 'No observed non-damaging condition pressure in this window'}</em></span>
              <i data-active={metric.suppressedConditionMs > 0}><b>{percent(metric.conditionPressureMs ? metric.suppressedConditionMs / metric.conditionPressureMs : null)}</b><small>suppressed</small><b>{application.correlatedRecipientGains}</b><small>gains</small></i>
            </button>;
          }) : <p>No recorded cast window overlapped {activeResistanceCondition ?? 'condition'} pressure for this provider.</p>}
        </div>
        <footer>These are correlated cast windows. Resistance is not consumed, so overlapping providers are not given unique credit.</footer>
      </aside> : null}

      {mode === 'stunbreak' && selectedStunbreak ? <aside className="utility-evidence" aria-label={`${selectedStunbreak.account} stun-break evidence`}>
        <header><span><Clock3 size={14}/> RESPONSE EVIDENCE</span><h3>{selectedStunbreak.account}</h3><p>{selectedStunbreak.correlatedResponses} selected-fight response matches; {selectedStunbreak.confirmedBreaks} confirmed report-wide breaks.</p><button type="button" onClick={() => onPlayer(selectedStunbreak.account)}><UserRoundSearch size={15}/> Open palette</button></header>
        <div className="utility-event-list">
          {selectedStunbreak.responseEvents.length ? selectedStunbreak.responseEvents.map(response => <button type="button" key={response.key} onClick={() => onMoment(selectedStunbreak.account, response.skillId, response.eventTimeMs)}>
            <img src={response.icon || classIconSrc(selectedStunbreak.profession)} alt=""/>
            <span><small>{timestamp(response.eventTimeMs)} mechanic · {timestamp(response.castTimeMs)} response</small><strong>{response.label}</strong><em>{response.targetAccount || response.targetActor} → {response.skillName}</em></span>
            <i data-active={response.delayMs <= 1_000}><b>{seconds(response.delayMs / 1000, 2)}</b><small>delay</small></i>
          </button>) : <p>No selected-fight mechanic could be time-matched to this provider’s recorded casts.</p>}
        </div>
        <footer>Select an event-to-cast match to inspect that skill's modeled timeline at the mechanic.</footer>
      </aside> : null}

      {mode === 'aegis' && selectedAegis ? <aside className="utility-evidence" aria-label={`${selectedAegis.account} Aegis evidence`}>
        <header><span><Shield size={14}/> APPLICATION EVIDENCE</span><h3>{selectedAegis.account}</h3><p>{model.coverage.incomingAttackSource === 'native-evtc'
          ? `${selectedAegis.confirmedBlocks} uniquely attributed blocks across ${selectedAegis.casts} recorded casts.`
          : `${selectedAegis.inferredConsumptions} early Aegis consumptions across ${selectedAegis.casts} recorded casts.`}</p><button type="button" onClick={() => onPlayer(selectedAegis.account)}><UserRoundSearch size={15}/> Open palette</button></header>
        <div className="utility-event-list">
          {selectedAegis.applications.map(application => <button type="button" key={application.key} onClick={() => onMoment(selectedAegis.account, application.skillId, application.timeMs)}>
            <img src={application.icon || classIconSrc(selectedAegis.profession)} alt=""/>
            <span><small>{timestamp(application.timeMs)} · {seconds((application.endMs - application.timeMs) / 1000, 1)} reference window</small><strong>{application.skillName}</strong><em>{model.coverage.incomingAttackSource !== 'native-evtc'
              ? `${application.inferredConsumptions} candidate consumption${application.inferredConsumptions === 1 ? '' : 's'} · native hit result unavailable`
              : application.attackAttempts.length ? `${application.attackAttempts.length} attack${application.attackAttempts.length === 1 ? '' : 's'} · ${application.attackAttempts.slice(0, 2).map(event => `${event.skillName} (${event.outcome})`).join(', ')}` : 'No recorded incoming attack in this window'}</em></span>
            <i data-active={(aegisIsEstimated ? application.inferredConsumptions : application.confirmedBlocks) > 0}><b>{aegisIsEstimated ? application.inferredConsumptions : application.confirmedBlocks}</b><small>{aegisIsEstimated ? 'candidate' : 'blocks'}</small><b>{application.correlatedRecipientGains}</b><small>gains</small></i>
          </button>)}
        </div>
        <footer>{model.coverage.incomingAttackSource === 'native-evtc'
          ? 'Confirmed blocks require Aegis state, a native block result, and matching boon consumption.'
          : 'Estimated conversion uses early Aegis disappearance. Re-import the original EVTC or ZEVTC to distinguish blocks from strips or corrupts.'}</footer>
      </aside> : null}
    </div>

    <footer className="utility-effectiveness-footer">
      <span>{model.fightName}</span><span>{model.coverage.stabilityTrackedPlayers} Stability · {model.coverage.resistanceTrackedPlayers} Resistance · {model.coverage.aegisTrackedPlayers} Aegis timelines / {model.coverage.replayRosterPlayers} players</span><span>{model.subgroupEvidence.source === 'fight-replay' ? 'Selected-fight parties' : model.subgroupEvidence.source === 'mixed' ? 'Mixed party evidence' : 'Aggregate party fallback'}</span><span>{loading ? 'Loading ArenaNet references' : references?.failed ? 'API references unavailable; wiki WvW references retained' : `${currentReferences.length}/${model.coverage.observedFightSkills} fight skills referenced`}</span>
    </footer>
    <details className="utility-method"><summary>How the ratings are calculated</summary><ul>{model.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul><p>Incoming skills are classified from ArenaNet facts and descriptions. Stability and Aegis consumption are matched within ±{model.constants.stabilityTransitionMatchMs / 1000}s of impact; Resistance uses direct timeline overlap plus API-verified same-target source matching within {model.constants.conditionSourceMatchMs / 1000}s, with a separate ≤{model.constants.conditionTemporalCandidateMs}ms timing-candidate tier when the API has no condition fact; stun-break correlation uses the first allied break cast within {model.constants.responseWindowMs / 1000}s. {model.coverage.ambiguousStabilityLossUnits} Stability interceptions, {model.coverage.ambiguousAegisBlocks} Aegis blocks, and {model.coverage.ambiguousConditionArrivals} condition arrivals remain unattributed because competing candidates overlap.</p></details>
  </section>;
}
