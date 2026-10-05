// Lightweight local heuristic — no network call. Strips common question filler from the first
// message and shortens it into a compact chat title, e.g. "What are the current settlement rules?"
// -> "Settlement rules". Good enough for a sidebar label without spending an extra ragAsk call per
// new chat just to generate one.
const FILLER_PREFIXES = [
 /^(please\s+)?(can|could|would)\s+you\s+(please\s+)?(tell me|explain|describe)\s+(about\s+)?/i,
 /^(please\s+)?(tell me|explain|describe)\s+(about\s+)?/i,
 /^what('s|\s+is|\s+are|\s+was|\s+were)\s+/i,
 /^how\s+(do|does|can|could|should)\s+i\s+/i,
 /^how\s+(do|does|can|could|should)\s+/i,
 /^why\s+(is|are|do|does|did)\s+/i,
 /^where\s+(is|are|can|do)\s+/i,
 /^when\s+(is|are|do|does|did|should)\s+/i,
 /^who\s+(is|are|was|were)\s+/i,
]

// Only capitalize the first letter of a normal lowercase word — leave an intentionally-cased
// first word (custCreate, iPhone, eBay: lowercase then an uppercase later) exactly as written.
function capitalizeFirst(text: string): string {
 const firstWord = text.match(/^\S+/)?.[0] ?? ''
 if (/[a-z].*[A-Z]/.test(firstWord)) return text
 return text.charAt(0).toUpperCase() + text.slice(1)
}

export function summarizeTitle(question: string, maxWords = 6, maxChars = 42): string {
 const trimmed = question.trim()
 let text = trimmed.replace(/[?!.]+$/, '')
 for (const pattern of FILLER_PREFIXES) {
  if (pattern.test(text)) { text = text.replace(pattern, ''); break }
 }
 text = text.trim() || trimmed
 if (!text) return 'New conversation'

 const words = text.split(/\s+/)
 let short = words.slice(0, maxWords).join(' ')
 if (words.length > maxWords) short += '…'
 if (short.length > maxChars) short = short.slice(0, maxChars - 1).trimEnd() + '…'

 return capitalizeFirst(short)
}
