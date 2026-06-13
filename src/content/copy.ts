// ============================================================================
// Centralized UI copy — freelancer/contractor voice
// ----------------------------------------------------------------------------
// One place for user-facing text so the copy/marketing lane can iterate without
// touching component logic, and so other lanes import stable keys.
//
// L0 ships the KEY STRUCTURE with placeholder values. The copy lane fills in
// the final wording. Keys are stable; downstream lanes reference `copy.<key>`.
// ============================================================================

export const copy = {
  app: {
    name: 'ClearSign',
    tagline: 'Know before you sign.',
    subtitle: 'AI contract analysis for freelancers & contractors',
  },

  // Hero section — landing page / above-the-fold (Lane C renders this)
  hero: {
    headline: 'Is this contract going to screw you?',
    body: 'A lawyer charges $250+ to read this — ClearSign does it in 30 seconds for the price of a coffee.',
    cta: 'Analyze My Contract — It\'s Free',
    freeNote: 'First 2 contracts are on us. No credit card, no account required.',
    scaryClauses:
      'Catches IP grabs, auto-renewal traps, non-competes, liability landmines, and payment gotchas — before you sign.',
    trustNote: 'Built for freelancers who\'ve been burned by a client contract before.',
  },

  input: {
    heading: 'Drop your contract here',
    placeholder: 'Paste contract text, or drag & drop a .txt or .docx file...',
    scanButton: 'Scan Document',
    uploadButton: 'Upload Contract',
    analyzeButton: 'Analyze My Contract',
    analyzing: 'Reading the fine print...',
  },

  results: {
    heading: "Here's what you need to know",
    emptyTitle: 'No contract analyzed yet.',
    emptySubtitle: "Drop your contract above to find out what they're actually asking you to agree to.",
    summaryHeading: 'What this contract actually says',
    redFlagsHeading: 'Red Flags — clauses that could hurt you',
    redFlagsEmpty: 'No major red flags found.',
    obligationsHeading: "What you're agreeing to",
    obligationsEmpty: 'No major obligations identified.',
  },

  qa: {
    askButton: 'Ask a Question',
    modalHeading: 'Ask About This Contract',
    empty:
      "Got questions about a specific clause? Ask anything — \"Can I moonlight for other clients?\", \"What if I miss a deadline?\", \"Who owns the IP?\"",
    inputPlaceholder: 'e.g. "Can they terminate me without notice?"',
    contextLabel: 'Related clause',
  },

  scanner: {
    heading: 'Scan a Physical Document',
    extracting: 'Reading your document...',
  },

  // Credit pack options — $7 / $15 / $29 (Lane C renders the pack picker)
  packs: {
    heading: 'Pick a credit pack',
    subheading: 'One credit = one contract analyzed. Q&A is always free.',
    badgePopular: 'Most popular',
    single: {
      label: 'Starter',
      credits: '1 analysis',
      price: '$7',
      description: 'Got one tricky contract? Start here.',
    },
    triple: {
      label: 'Freelancer',
      credits: '3 analyses',
      price: '$15',
      description: 'One per client — covers a busy quarter.',
    },
    ten: {
      label: 'Power User',
      credits: '10 analyses',
      price: '$29',
      description: 'Best value for active contractors.',
    },
  },

  billing: {
    creditsLabel: 'Credits remaining',
    outOfCreditsTitle: "You've used your free analyses",
    outOfCreditsBody: "Get a credit pack to keep finding the clauses that could cost you.",
    buyButton: 'Get More Credits',
    checkoutCta: 'Continue to Checkout',
  },

  errors: {
    fileRead: "Couldn't read that file. Try a .txt or .docx instead.",
    analyze:
      "Analysis failed. Please try again — if it keeps happening, try pasting the text directly.",
    ask: "Couldn't answer that. Try rephrasing your question.",
    ocr: "Couldn't extract text from the image. Try better lighting or a clearer photo.",
    camera: 'Camera access denied. Check your browser permissions and try again.',
    insufficientCredits: "You're out of credits. Grab a pack to keep going.",
    generic: 'Something went wrong. Please try again.',
  },
} as const;

export type Copy = typeof copy;
