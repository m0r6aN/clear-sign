// ============================================================================
// Labeled contract corpus — ground truth for high-severity red-flag recall
// ----------------------------------------------------------------------------
// Each contract is paired with the set of genuinely HIGH-severity risks a
// freelancer should be warned about. A model "recalls" a gold flag if any of
// its returned redFlags matches the flag's `match` regexes (see score.ts).
//
// Matchers are intentionally generous on phrasing (a model may call an
// uncapped-indemnity clause many things) but specific on concept, so a match
// means the model actually surfaced THAT risk, not merely used a keyword.
// ============================================================================

export interface GoldFlag {
  id: string;
  /** Human label for the report. */
  label: string;
  /** Concept matchers — flag is recalled if ANY group fully matches a redFlag. */
  match: RegExp[][];
}

export interface ContractCase {
  id: string;
  /** Filename under evals/contracts/. */
  file: string;
  kind: string;
  goldFlags: GoldFlag[];
}

// Helper: a "group" is an array of regexes that must ALL hit the same redFlag
// description (logical AND); `match` is an array of groups (logical OR).
const rx = (...parts: string[]): RegExp[] => parts.map((p) => new RegExp(p, 'i'));

export const CORPUS: ContractCase[] = [
  {
    id: 'mutual-nda',
    file: 'mutual-nda.txt',
    kind: 'Mutual NDA',
    goldFlags: [
      {
        id: 'nda-perpetual',
        label: 'Perpetual / indefinite confidentiality obligation',
        match: [rx('perpetu'), rx('indefinit'), rx('(no|without).{0,15}expir'), rx('survive', 'forever')],
      },
      {
        id: 'nda-overbroad-def',
        label: 'Overbroad definition of Confidential Information (incl. public info)',
        match: [rx('(broad|overbroad|vague|expansive).{0,30}(confidential|definition)'), rx('publicly (known|available)'), rx('definition.{0,30}confidential')],
      },
      {
        id: 'nda-nonsolicit',
        label: 'Broad 3-year worldwide non-solicitation',
        match: [rx('non-?solicit'), rx('solicit')],
      },
      {
        id: 'nda-liquidated',
        label: 'Punitive liquidated damages ($250k per breach)',
        match: [rx('liquidated damages'), rx('250'), rx('penalt')],
      },
      {
        id: 'nda-feedback-ip',
        label: 'Uncompensated assignment of feedback/ideas',
        match: [rx('feedback'), rx('(idea|suggestion).{0,30}(assign|property)')],
      },
      {
        id: 'nda-indemnity',
        label: 'Uncapped indemnification by recipient',
        match: [rx('indemnif'), rx('hold harmless')],
      },
    ],
  },
  {
    id: 'sow-design',
    file: 'sow-design.txt',
    kind: 'SOW (design)',
    goldFlags: [
      {
        id: 'sow-unlimited-rev',
        label: 'Unlimited revisions until "fully satisfied" at fixed fee',
        match: [rx('unlimited.{0,20}revision'), rx('revision'), rx('(fully )?satisf')],
      },
      {
        id: 'sow-ip-precreation',
        label: 'IP assigned on creation regardless of payment, incl. background IP',
        match: [rx('(pre-?existing|background).{0,30}(tool|material|ip|propert)'), rx('assign.{0,40}(irrespective|regardless).{0,20}payment'), rx('work.{0,5}made.{0,5}for.{0,5}hire')],
      },
      {
        id: 'sow-payment-discretion',
        label: 'Payment Net-60 contingent on sole-discretion acceptance / withholding',
        match: [rx('withhold'), rx('net-?60'), rx('sole.{0,20}(discretion|satisfaction)')],
      },
      {
        id: 'sow-term-convenience',
        label: 'Client termination for convenience with no compensation / no kill fee',
        match: [rx('terminat'), rx('kill fee'), rx('no compensation')],
      },
      {
        id: 'sow-indemnity-uncapped',
        label: 'Uncapped indemnification for third-party claims',
        match: [rx('indemnif'), rx('(no cap|uncapped|no limit|without limit)')],
      },
    ],
  },
  {
    id: 'ic-agreement',
    file: 'ic-agreement.txt',
    kind: 'IC Agreement (aggressive IP)',
    goldFlags: [
      {
        id: 'ic-ip-overreach',
        label: 'IP assignment incl. pre-existing/off-hours/unrelated inventions',
        match: [rx('(pre-?existing|background)'), rx('own time'), rx('whether or not.{0,40}(hours|resources|related)'), rx('all.{0,20}(invention|intellectual property|right, title)')],
      },
      {
        id: 'ic-moral-rights',
        label: 'Irrevocable worldwide moral-rights waiver',
        match: [rx('moral rights'), rx('attribution'), rx('integrity')],
      },
      {
        id: 'ic-noncompete',
        label: '2-year worldwide non-compete',
        match: [rx('non-?compete'), rx('compet')],
      },
      {
        id: 'ic-liability-personal',
        label: 'Personal, uncapped liability incl. consequential damages',
        match: [rx('personally liable'), rx('(no cap|uncapped|without.{0,10}(cap|limit))'), rx('consequential')],
      },
      {
        id: 'ic-indemnity',
        label: 'Indemnification of company by contractor',
        match: [rx('indemnif')],
      },
      {
        id: 'ic-forfeit-fees',
        label: 'Forfeiture of unpaid fees + asymmetric termination/notice',
        match: [rx('forfeit'), rx('(immediately|without notice).{0,30}terminat'), rx('60.{0,10}(day|notice)')],
      },
    ],
  },
  {
    id: 'msa-freelance',
    file: 'msa-freelance.txt',
    kind: 'Freelance MSA',
    goldFlags: [
      {
        id: 'msa-unilateral-amend',
        label: 'Unilateral amendment of terms by Client',
        match: [rx('(unilateral|modify|amend|change).{0,30}(term|agreement)'), rx('sole discretion.{0,30}(modify|amend|term)')],
      },
      {
        id: 'msa-asymmetric-liability',
        label: 'Asymmetric liability cap (Client capped at $100, Provider unlimited)',
        match: [rx('(liability|liable)'), rx('(cap|limit|unlimited|\\$100|asymmetr)')],
      },
      {
        id: 'msa-payment-offset',
        label: 'Net-90 with discretionary set-off/withholding, no late fees',
        match: [rx('net-?90'), rx('(set ?off|offset|withhold|deduct)')],
      },
      {
        id: 'msa-ip-unpaid',
        label: 'IP assigned on creation even if invoice unpaid',
        match: [rx('(assign|work product).{0,40}(unpaid|regardless|whether|paid)'), rx('upon creation')],
      },
      {
        id: 'msa-autorenew-exclusive',
        label: 'Auto-renewal + long notice + post-term exclusivity',
        match: [rx('auto.{0,5}renew'), rx('exclusiv'), rx('120.{0,10}(day|notice)')],
      },
      {
        id: 'msa-feeshift',
        label: 'One-sided prevailing-party / fee-shifting against Provider',
        match: [rx('(legal|attorney).{0,10}fee'), rx('prevailing party'), rx('fee-?shift')],
      },
    ],
  },
];

/** Pricing per 1M tokens (USD), from the claude-api skill model table. */
export const PRICING: Record<string, { input: number; output: number; label: string }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0, label: 'Haiku 4.5' },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, label: 'Sonnet 4.6' },
  'claude-opus-4-8': { input: 5.0, output: 25.0, label: 'Opus 4.8' },
};

/** Models under test, cheapest → most expensive. */
export const MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-8'];
