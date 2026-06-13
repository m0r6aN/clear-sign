// ============================================================================
// Centralized UI copy — placeholder strings
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
    tagline: 'Understand what you sign.',
    subtitle: 'AI Contract Analyzer',
  },

  input: {
    heading: 'Document Text',
    placeholder: 'Paste contract text here, or drag & drop a .txt or .docx file...',
    scanButton: 'Scan Doc',
    uploadButton: 'Upload File',
    analyzeButton: 'Analyze Contract',
    analyzing: 'Analyzing Contract...',
  },

  results: {
    heading: 'Analysis Results',
    emptyTitle: 'No contract analyzed yet.',
    emptySubtitle: 'Paste your text and click Analyze to begin.',
    summaryHeading: 'Executive Summary',
    redFlagsHeading: 'Red Flags & Risks',
    redFlagsEmpty: 'No significant red flags detected.',
    obligationsHeading: 'Key Obligations',
    obligationsEmpty: 'No major obligations identified.',
  },

  qa: {
    askButton: 'Ask AI',
    modalHeading: 'Contract Q&A',
    empty: 'Ask any questions about the contract!',
    inputPlaceholder: 'Ask a question about this contract...',
    contextLabel: 'Context',
  },

  scanner: {
    heading: 'Scan Document',
    extracting: 'Extracting text...',
  },

  billing: {
    creditsLabel: 'Credits',
    outOfCreditsTitle: 'You’re out of credits',
    outOfCreditsBody: 'Buy a credit pack to keep analyzing contracts.',
    buyButton: 'Buy Credits',
    checkoutCta: 'Continue to checkout',
  },

  errors: {
    fileRead: 'Failed to read the file. Please try a different .txt or .docx file.',
    analyze: 'Failed to analyze the contract. Please try again.',
    ask: 'Failed to answer. Please try again.',
    ocr: 'Failed to extract text from the image.',
    camera: 'Could not access camera.',
    insufficientCredits: 'You don’t have enough credits for this action.',
    generic: 'Something went wrong. Please try again.',
  },
} as const;

export type Copy = typeof copy;
