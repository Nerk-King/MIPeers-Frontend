export const agents = [
 { id: 'general', name: 'FlowMate', short: 'Productivity', description: 'Your everyday productivity partner — quick answers, summaries, and next steps across your whole workspace.', tags: ['Productivity', 'All-around'], color: 'purple', icon: 'Zap' },
 { id: 'settlement', name: 'BizWise', short: 'Business & operations', description: 'Your business specialist for settlement policies, clearing procedures, and operational calendars.', tags: ['Business', 'Operations'], color: 'blue', icon: 'Briefcase' },
 { id: 'product', name: 'DevMate', short: 'Developer', description: 'Your developer companion for API integration, product features, and technical documentation.', tags: ['Developer', 'Technical'], color: 'green', icon: 'Code2' }
]
export const documents = [
 { id: 'policy', name: 'Settlement Policy v3.2.pdf', category: 'Settlement & Clearing', folder: 'Settlement Policies', pages: '4–6', date: '03 Sep 2026', content: 'Illustrative document preview\n\nThis demo policy covers settlement timelines, cut-off times, settlement instructions, exception handling, and non-business days.\n\nConnect your knowledge service to retrieve the actual document and verified policy text. The original policy file is not included in this prototype.' },
 { id: 'old-policy', name: 'Settlement Policy v3.1.pdf', category: 'Settlement & Clearing', folder: 'Settlement Policies · Archive', pages: '3–5', date: '12 Jun 2026', content: 'Illustrative archived policy. This version is retained for reference. Connect the document service to load version history and original content.' },
 { id: 'procedures', name: 'Settlement Procedures Guide.docx', category: 'Settlement & Clearing', folder: 'Settlement Procedures', pages: '8', date: '01 Sep 2026', content: 'Illustrative procedure guide\n\n1. Review the settlement instruction.\n2. Validate required information.\n3. Monitor processing status.\n4. Escalate exceptions to the operations team.\n\nDemo content only; verify procedures against your connected source.' },
 { id: 'workflow', name: 'Settlement Workflow.pdf', category: 'Settlement & Clearing', folder: 'Settlement Procedures', pages: '1', date: '28 Aug 2026', content: 'Illustrative workflow\n\nInstruction received → Validation → Processing → Reconciliation → Completion.' },
 { id: 'calendar', name: 'Holiday Calendar 2026.pdf', category: 'Settlement & Clearing', folder: 'Calendars & Holidays', pages: '2', date: '15 Jan 2026', content: 'Illustrative calendar preview. Connect your approved business calendar to view holidays and settlement-day adjustments.' },
 { id: 'manual', name: 'Product User Manual.pdf', category: 'Product Documentation', folder: 'Getting Started', pages: '1–3', date: '02 Sep 2026', content: 'Getting started\n\nAsk a question from Home, select a specialist agent, review the sources attached to each response, and bookmark useful answers for later.' },
 { id: 'faq', name: 'Frequently Asked Questions.pdf', category: 'Product Documentation', folder: 'Getting Started', pages: '1–2', date: '10 Sep 2026', content: 'Illustrative FAQ\n\nCommon questions about workspace access, agent selection, and source citations. Connect your knowledge service to load the maintained FAQ content.' },
 { id: 'api', name: 'API Integration Guide.md', category: 'Source Code', folder: 'Developer Guides', pages: '1', date: '04 Sep 2026', content: 'Integration overview\n\nThe frontend calls a configurable application backend through src/services/rag.ts. Keep service credentials on the backend. Return an answer and source identifiers to render citations.' },
 { id: 'changelog', name: 'Changelog.md', category: 'Source Code', folder: 'Developer Guides', pages: '1', date: '12 Sep 2026', content: 'Illustrative changelog\n\nv0.1.0 — Initial prototype workspace, sample agents, and demo knowledge library.\n\nConnect your source control or release system to load the real changelog.' }
]
export type KnowledgeDocument = typeof documents[number]

export type KnowledgeFolder = { id: string; name: string; type: 'folder'; children: KnowledgeNode[] }
export type KnowledgeFile = { id: string; name: string; type: 'file'; documentId: string }
export type KnowledgeNode = KnowledgeFolder | KnowledgeFile

/**
 * Dummy folder/file tree for the Knowledge Library demo. Shaped to match what a
 * Progress Agentic RAG "list folders/files" endpoint would return, so services/knowledge.ts
 * can swap this static tree for a live one without changing any component code.
 */
export const knowledgeTree: KnowledgeFolder[] = [
 {
  id: 'settlement-clearing', name: 'Settlement & Clearing', type: 'folder', children: [
   {
    id: 'settlement-policies', name: 'Settlement Policies', type: 'folder', children: [
     { id: 'f-policy', name: 'Settlement Policy v3.2.pdf', type: 'file', documentId: 'policy' },
     { id: 'settlement-policies-archive', name: 'Archive', type: 'folder', children: [
      { id: 'f-old-policy', name: 'Settlement Policy v3.1.pdf', type: 'file', documentId: 'old-policy' }
     ] }
    ]
   },
   {
    id: 'settlement-procedures', name: 'Settlement Procedures', type: 'folder', children: [
     { id: 'f-procedures', name: 'Settlement Procedures Guide.docx', type: 'file', documentId: 'procedures' },
     { id: 'f-workflow', name: 'Settlement Workflow.pdf', type: 'file', documentId: 'workflow' }
    ]
   },
   {
    id: 'calendars-holidays', name: 'Calendars & Holidays', type: 'folder', children: [
     { id: 'f-calendar', name: 'Holiday Calendar 2026.pdf', type: 'file', documentId: 'calendar' }
    ]
   }
  ]
 },
 {
  id: 'product-documentation', name: 'Product Documentation', type: 'folder', children: [
   {
    id: 'getting-started', name: 'Getting Started', type: 'folder', children: [
     { id: 'f-manual', name: 'Product User Manual.pdf', type: 'file', documentId: 'manual' },
     { id: 'f-faq', name: 'Frequently Asked Questions.pdf', type: 'file', documentId: 'faq' }
    ]
   },
   { id: 'onboarding-videos', name: 'Onboarding Videos', type: 'folder', children: [] }
  ]
 },
 {
  id: 'source-code', name: 'Source Code', type: 'folder', children: [
   {
    id: 'developer-guides', name: 'Developer Guides', type: 'folder', children: [
     { id: 'f-api', name: 'API Integration Guide.md', type: 'file', documentId: 'api' },
     { id: 'f-changelog', name: 'Changelog.md', type: 'file', documentId: 'changelog' }
    ]
   }
  ]
 }
]
