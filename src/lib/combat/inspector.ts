/**
 * Plain-text CombatEvent inspector — a developer tool, not a UI feature.
 *
 * Deliberately not a React view: this phase explicitly does not touch
 * navigation or add new dashboards (see docs/COMBAT_EVENT_ARCHITECTURE.md).
 * Use from a dev console or a temporary `console.log` while debugging a
 * normalizer: `debugCombatEvents(set.events).forEach(l => console.log(l))`.
 */

import { describeAgent } from './agentIdentity';
import type { CombatEvent } from './CombatEvent';

const fmtTimestamp = (ms: number | null): string => (ms === null ? 'phase-aggregate' : (ms / 1000).toFixed(3));

/** Render one CombatEvent as a multi-line block, matching the architecture doc's example format. */
export function formatCombatEvent(e: CombatEvent): string {
  const lines = [
    `Timestamp:  ${fmtTimestamp(e.timestampMs)}`,
    `Category:   ${e.category}`,
    `Subtype:    ${e.subcategory}`,
    `Source:     ${describeAgent(e.source)}`,
    `Target:     ${e.target ? describeAgent(e.target) : '-'}`,
    `Amount:     ${e.amount.toLocaleString()}`,
    `Origin:     ${e.origin}`,
    `Confidence: ${e.confidence}`,
    `Coverage:   ${e.coverage}`,
  ];
  if (e.skillName) lines.push(`Skill:      ${e.skillName}`);
  if (e.metadata && Object.keys(e.metadata).length > 0) {
    lines.push(`Metadata:   ${JSON.stringify(e.metadata)}`);
  }
  return lines.join('\n');
}

/** Render a list of events as separate blocks, sorted by timestamp for readability. */
export function debugCombatEvents(events: CombatEvent[]): string[] {
  const sorted = [...events].sort((a, b) => {
    if (a.timestampMs === null && b.timestampMs === null) return 0;
    if (a.timestampMs === null) return 1;
    if (b.timestampMs === null) return -1;
    return a.timestampMs - b.timestampMs;
  });
  return sorted.map(formatCombatEvent);
}

/** One-line summary for a whole event set — counts by category/origin/confidence. */
export function summarizeCombatEvents(events: CombatEvent[]): string {
  const byCategory = new Map<string, number>();
  const byConfidence = new Map<string, number>();
  for (const e of events) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);
    byConfidence.set(e.confidence, (byConfidence.get(e.confidence) ?? 0) + 1);
  }
  const cat = [...byCategory.entries()].map(([k, v]) => `${k}:${v}`).join(', ');
  const conf = [...byConfidence.entries()].map(([k, v]) => `${k}:${v}`).join(', ');
  return `${events.length} events — categories [${cat}] — confidence [${conf}]`;
}
