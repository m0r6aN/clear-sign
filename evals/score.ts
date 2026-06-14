// ============================================================================
// Scoring — high-severity red-flag recall
// ----------------------------------------------------------------------------
// recall (primary)      = gold high-severity flags surfaced as ANY redFlag
// recallHigh (severity) = gold flags surfaced AND marked severity 'high'
//
// A gold flag is "surfaced" if at least one returned redFlag satisfies one of
// the flag's matcher groups. A matcher group is a list of regexes that must all
// hit the SAME redFlag description (concept AND); the flag's `match` is the OR
// of its groups. This rewards surfacing the concept, not keyword bingo.
// ============================================================================

import type { GoldFlag } from './corpus';

export interface AnalyzedRedFlag {
  description: string;
  severity: 'high' | 'medium' | 'low' | string;
  lineReference?: string;
}

export interface FlagOutcome {
  id: string;
  label: string;
  surfaced: boolean;
  markedHigh: boolean;
}

function groupHits(text: string, group: RegExp[]): boolean {
  return group.every((re) => re.test(text));
}

/** Does any single redFlag satisfy any matcher group of this gold flag? */
function matchFlag(flag: GoldFlag, redFlags: AnalyzedRedFlag[]): AnalyzedRedFlag | null {
  for (const rf of redFlags) {
    const text = `${rf.description} ${rf.lineReference ?? ''}`;
    if (flag.match.some((group) => groupHits(text, group))) return rf;
  }
  return null;
}

export interface RecallResult {
  outcomes: FlagOutcome[];
  total: number;
  surfaced: number;
  markedHigh: number;
  recall: number; // surfaced / total
  recallHigh: number; // markedHigh / total
}

export function scoreRecall(goldFlags: GoldFlag[], redFlags: AnalyzedRedFlag[]): RecallResult {
  const outcomes: FlagOutcome[] = goldFlags.map((flag) => {
    const hit = matchFlag(flag, redFlags);
    return {
      id: flag.id,
      label: flag.label,
      surfaced: hit !== null,
      markedHigh: hit !== null && String(hit.severity).toLowerCase() === 'high',
    };
  });
  const total = outcomes.length;
  const surfaced = outcomes.filter((o) => o.surfaced).length;
  const markedHigh = outcomes.filter((o) => o.markedHigh).length;
  return {
    outcomes,
    total,
    surfaced,
    markedHigh,
    recall: total ? surfaced / total : 0,
    recallHigh: total ? markedHigh / total : 0,
  };
}
